/* App state store - localStorage-backed, no backend, single source of truth */
(function () {
  window.FH = window.FH || {};

  var STORAGE_KEY = "financehub_payments_state_v1";

  function defaultState() {
    return {
      onboardingComplete: false,
      consentGiven: false,
      linkedBankIds: [],
      user: { name: "Amaka Chukwu", email: "amaka.chukwu@example.com" },
      accounts: window.FH.data.SEED_ACCOUNTS,
      transactions: window.FH.data.SEED_TRANSACTIONS,
      disputes: window.FH.data.SEED_DISPUTES,
      beneficiaries: window.FH.data.SEED_BENEFICIARIES,
      transfers: window.FH.data.SEED_TRANSFERS,
      bills: [],
      billAlertPeriod: "monthly",
      goals: [],
      holdings: [],
      portfolioLinked: false,
      analysisPeriod: "daily",
      reviewedProtectionAlerts: [],
      household: { enabled: false, name: "", members: [], budgets: [], requests: [] }
    };
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      parsed.household = Object.assign(defaultState().household, parsed.household || {});
      return Object.assign(defaultState(), parsed);
    } catch (err) {
      return defaultState();
    }
  }

  var state = load();

  function persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getState() {
    return state;
  }

  function setState(patch) {
    var next = Object.assign({}, state, patch);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return state;
  }

  function completeOnboarding(bankIds) {
    return setState({
      onboardingComplete: true,
      consentGiven: true,
      linkedBankIds: bankIds
    });
  }

  function addDispute(dispute) {
    var disputes = state.disputes.concat([dispute]);
    return setState({ disputes: disputes });
  }

  function addTransfer(transfer) {
    var f = window.FH.finance;
    var amount = f.money(transfer.amount);
    var account = f.linkedAccounts(state).find(function (item) { return item.id === transfer.accountId; });
    if (!account) throw new Error("Select a linked NGN account.");
    if (!state.beneficiaries.some(function (item) { return item.id === transfer.beneficiaryId; })) throw new Error("Select a saved beneficiary.");
    var available = f.funding(state, state.billAlertPeriod).accounts.find(function (item) { return item.account.id === account.id; }).available;
    if (amount > available) throw new Error("Transfer exceeds funds available after pending bank debits.");
    transfer = Object.assign({}, transfer, { amount: amount });
    var accounts = state.accounts.map(function (acc) {
      if (acc.id !== transfer.accountId) return acc;
      return Object.assign({}, acc, { balance: Math.round((acc.balance - transfer.amount) * 100) / 100 });
    });
    var transfers = state.transfers.concat([transfer]);
    var beneficiary = state.beneficiaries.filter(function (b) { return b.id === transfer.beneficiaryId; })[0];
    var transaction = {
      id: transfer.id.replace("trf_", "txn_"),
      accountId: transfer.accountId,
      date: transfer.createdAt,
      description: "Transfer to " + (beneficiary ? beneficiary.name : "beneficiary") + (transfer.note ? " \u2014 " + transfer.note : ""),
      category: "other",
      amount: -Math.abs(transfer.amount),
      status: "posted"
    };
    var transactions = [transaction].concat(state.transactions);
    return setState({ accounts: accounts, transfers: transfers, transactions: transactions });
  }

  function addBeneficiary(beneficiary) {
    var beneficiaries = state.beneficiaries.concat([beneficiary]);
    return setState({ beneficiaries: beneficiaries });
  }

  function addBill(bill) {
    var f = window.FH.finance;
    if (!bill.name.trim()) throw new Error("Enter a bill name.");
    f.parseDate(bill.dueDate);
    if (["once"].concat(f.PERIODS).indexOf(bill.frequency) === -1) throw new Error("Select a bill frequency.");
    return setState({ bills: state.bills.concat([Object.assign({}, bill, {
      name: bill.name.trim(), amount: f.money(bill.amount), status: "pending"
    })]) });
  }

  function closeBill(id) {
    if (!state.bills.some(function (bill) { return bill.id === id && bill.status === "pending"; })) {
      throw new Error("Pending bill not found.");
    }
    return setState({ bills: state.bills.map(function (bill) {
      return bill.id === id ? Object.assign({}, bill, { status: "closed" }) : bill;
    }) });
  }

  function addGoal(goal) {
    var f = window.FH.finance;
    if (!goal.name.trim()) throw new Error("Enter a goal name.");
    f.parseDate(goal.targetDate);
    if (goal.targetDate < f.dateOnly(new Date())) throw new Error("Choose today or a future target date.");
    if (f.PERIODS.indexOf(goal.frequency) === -1) throw new Error("Select a savings frequency.");
    return setState({ goals: state.goals.concat([Object.assign({}, goal, {
      name: goal.name.trim(), target: f.money(goal.target), saved: 0, contributions: []
    })]) });
  }

  function contribute(goalId, accountId, value, memberId) {
    var f = window.FH.finance;
    var amount = f.money(value);
    var goal = state.goals.find(function (item) { return item.id === goalId; });
    var account = f.linkedAccounts(state).find(function (item) { return item.id === accountId; });
    if (!goal || !account) throw new Error("Select a goal and a linked NGN account.");
    if (memberId && !state.household.members.some(function (member) { return member.id === memberId; })) {
      throw new Error("Select a valid household member.");
    }
    var available = f.funding(state, state.billAlertPeriod).accounts.find(function (item) { return item.account.id === accountId; }).available;
    if (amount > available) throw new Error("Contribution exceeds funds available after pending bank debits.");
    if (Math.round((goal.saved + amount) * 100) > Math.round(goal.target * 100)) throw new Error("Contribution exceeds the remaining goal target.");
    var createdAt = new Date().toISOString();
    var transaction = { id: window.FH.utils.uid("txn"), accountId: accountId, date: createdAt,
      description: "Simulated savings: " + goal.name, category: "savings", amount: -amount, status: "posted" };
    return setState({
      accounts: state.accounts.map(function (item) {
        return item.id === accountId ? Object.assign({}, item, { balance: Math.round((item.balance - amount) * 100) / 100 }) : item;
      }),
      goals: state.goals.map(function (item) {
        return item.id === goalId ? Object.assign({}, item, {
          saved: Math.round((item.saved + amount) * 100) / 100,
          contributions: item.contributions.concat([{ accountId: accountId, amount: amount, createdAt: createdAt, memberId: memberId || null }])
        }) : item;
      }),
      transactions: [transaction].concat(state.transactions)
    });
  }

  function saveHolding(holding) {
    var f = window.FH.finance;
    if (!holding.symbol.trim() || !holding.name.trim()) throw new Error("Enter the symbol and company name.");
    var units = Number(holding.units);
    if (!Number.isFinite(units) || units <= 0 || units > 1000000000) throw new Error("Enter valid positive units (maximum one billion).");
    f.parseDate(holding.asOf);
    if (holding.asOf > f.dateOnly(new Date())) throw new Error("Current price date cannot be in the future.");
    Object.keys(holding.references).forEach(function (period) {
      if (f.ANALYSIS_PERIODS.indexOf(period) === -1) throw new Error("Invalid reference period.");
      var reference = holding.references[period];
      f.money(reference.price);
      f.parseDate(reference.date);
      if (reference.date >= holding.asOf) throw new Error("Reference prices must be dated before the current price.");
    });
    var record = Object.assign({}, holding, { symbol: holding.symbol.trim().toUpperCase(), name: holding.name.trim(),
      units: units, cost: f.money(holding.cost), price: f.money(holding.price) });
    var existing = state.holdings.find(function (item) { return item.symbol === record.symbol && item.id !== record.id; });
    if (existing) throw new Error("This symbol is already recorded. Use Update prices / holding.");
    var found = state.holdings.some(function (item) { return item.id === record.id; });
    return setState({ holdings: found ? state.holdings.map(function (item) { return item.id === record.id ? record : item; }) :
      state.holdings.concat([record]) });
  }

  function linkDemoPortfolio() {
    if (state.portfolioLinked) throw new Error("The demo portfolio is already linked.");
    var today = window.FH.finance.dateOnly(new Date());
    var references = {};
    var demoPrices = { daily: 100, weekly: 105, monthly: 120, annually: 80 };
    window.FH.finance.ANALYSIS_PERIODS.forEach(function (period) {
      references[period] = { date: window.FH.finance.advanceDate(today, period, -1), price: demoPrices[period] };
    });
    var demo = { id: "holding_demo", symbol: "DEMO", name: "Fictional Demo Company", units: 100,
      cost: 90, price: 106, asOf: today, references: references, source: "Demo brokerage" };
    return setState({ portfolioLinked: true, holdings: state.holdings.some(function (item) { return item.symbol === "DEMO"; }) ?
      state.holdings : state.holdings.concat([demo]) });
  }

  function unlinkDemoPortfolio() {
    return setState({ portfolioLinked: false, holdings: state.holdings.filter(function (item) { return item.source !== "Demo brokerage"; }) });
  }

  function reviewProtectionAlert(id) {
    if (!id || typeof id !== "string") throw new Error("Select a valid protection alert.");
    if (state.reviewedProtectionAlerts.indexOf(id) !== -1) return state;
    return setState({ reviewedProtectionAlerts: state.reviewedProtectionAlerts.concat([id]) });
  }

  function createHousehold(name) {
    name = String(name || "").trim();
    if (!name) throw new Error("Enter a household name.");
    var members = state.household.members;
    if (!members.length) {
      members = [{ id: window.FH.utils.uid("member"), name: state.user.name, email: state.user.email,
        role: "organiser", contributionTarget: 0 }];
    }
    return setState({ household: Object.assign({}, state.household, { enabled: true, name: name, members: members }) });
  }

  function addHouseholdMember(member) {
    var allowedRoles = ["organiser", "contributor", "viewer"];
    var name = String(member.name || "").trim();
    var email = String(member.email || "").trim();
    if (!name) throw new Error("Enter the member's name.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address or leave it blank.");
    if (allowedRoles.indexOf(member.role) === -1) throw new Error("Select a household role.");
    var target = Number(member.contributionTarget || 0);
    if (!Number.isFinite(target) || target < 0) throw new Error("Contribution target must be zero or positive.");
    var record = Object.assign({}, member, { name: name, email: email, contributionTarget: Math.round(target * 100) / 100 });
    return setState({ household: Object.assign({}, state.household, {
      members: state.household.members.concat([record])
    }) });
  }

  function addHouseholdBudget(budget) {
    var limit = window.FH.finance.money(budget.limit);
    if (!window.FH.data.CATEGORIES.some(function (category) { return category.id === budget.category; })) {
      throw new Error("Select a valid budget category.");
    }
    if (state.household.budgets.some(function (item) { return item.category === budget.category; })) {
      throw new Error("A household budget already exists for this category.");
    }
    return setState({ household: Object.assign({}, state.household, {
      budgets: state.household.budgets.concat([Object.assign({}, budget, { limit: limit })])
    }) });
  }

  function addHouseholdRequest(request) {
    var description = String(request.description || "").trim();
    if (!description) throw new Error("Enter a request description.");
    if (!state.household.members.some(function (member) { return member.id === request.requesterId; })) {
      throw new Error("Select a valid requester.");
    }
    var record = Object.assign({}, request, { description: description, amount: window.FH.finance.money(request.amount),
      status: "pending", createdAt: new Date().toISOString(), decidedAt: null });
    return setState({ household: Object.assign({}, state.household, {
      requests: state.household.requests.concat([record])
    }) });
  }

  function decideHouseholdRequest(id, decision) {
    if (["approved", "rejected"].indexOf(decision) === -1) throw new Error("Select approve or reject.");
    var request = state.household.requests.find(function (item) { return item.id === id; });
    if (!request || request.status !== "pending") throw new Error("Pending request not found.");
    return setState({ household: Object.assign({}, state.household, {
      requests: state.household.requests.map(function (item) {
        return item.id === id ? Object.assign({}, item, { status: decision, decidedAt: new Date().toISOString() }) : item;
      })
    }) });
  }

  function resetDemo() {
    window.localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    persist();
    return state;
  }

  window.FH.store = {
    STORAGE_KEY: STORAGE_KEY,
    getState: getState,
    setState: setState,
    completeOnboarding: completeOnboarding,
    addDispute: addDispute,
    addTransfer: addTransfer,
    addBeneficiary: addBeneficiary,
    addBill: addBill,
    closeBill: closeBill,
    addGoal: addGoal,
    contribute: contribute,
    saveHolding: saveHolding,
    linkDemoPortfolio: linkDemoPortfolio,
    unlinkDemoPortfolio: unlinkDemoPortfolio,
    reviewProtectionAlert: reviewProtectionAlert,
    createHousehold: createHousehold,
    addHouseholdMember: addHouseholdMember,
    addHouseholdBudget: addHouseholdBudget,
    addHouseholdRequest: addHouseholdRequest,
    decideHouseholdRequest: decideHouseholdRequest,
    resetDemo: resetDemo
  };
})();
