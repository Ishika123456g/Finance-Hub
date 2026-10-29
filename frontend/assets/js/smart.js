/* Explainable decision, protection and household calculations for local demo data. */
(function () {
  window.FH = window.FH || {};
  var HORIZONS = ["weekly", "monthly", "quarterly", "annually"];

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function nonNegative(value, label) {
    var number = Number(value || 0);
    if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(Math.round(number * 100))) {
      throw new Error((label || "Amount") + " must be zero or a positive amount.");
    }
    return round(number);
  }

  function occurrenceCount(start, end, frequency) {
    var f = window.FH.finance;
    var count = 0;
    var next = start;
    while (next <= end) {
      count++;
      next = f.advanceDate(start, frequency, count);
    }
    return count;
  }

  function goalCommitments(state, horizon, today) {
    var f = window.FH.finance;
    var end = f.advanceDate(today, horizon);
    return round(state.goals.reduce(function (total, goal) {
      if (goal.targetDate < today) return total;
      var plan = f.goalPlan(goal, today);
      if (!plan.contribution || !plan.remaining) return total;
      var finalDate = goal.targetDate < end ? goal.targetDate : end;
      var count = occurrenceCount(today, finalDate, goal.frequency);
      return total + Math.min(plan.remaining, plan.contribution * count);
    }, 0));
  }

  function resilience(state, today) {
    var f = window.FH.finance;
    var report = window.FH.reports.buildReport(state, { period: "monthly", endDate: today });
    var funding = f.funding(state, "monthly", today);
    var available = round(funding.accounts.reduce(function (sum, item) { return sum + item.available; }, 0));
    var liquidityBase = Math.max(report.summary.outflows, funding.total, 1);
    var liquidityRatio = available / liquidityBase;
    var liquidity = Math.round(30 * Math.min(1, liquidityRatio / 1.5));
    var billCoverage = funding.total === 0 ? 1 : Math.min(1, available / funding.total);
    var bills = Math.round(25 * billCoverage);
    var cashFlow;
    if (report.summary.income === 0 && report.summary.outflows === 0) {
      cashFlow = 10;
    } else {
      var margin = report.summary.income ? report.summary.netCashFlow / report.summary.income : -1;
      cashFlow = Math.round(20 * Math.max(0, Math.min(1, (margin + 0.25) / 0.5)));
    }
    var savingsRate = report.summary.income ? report.summary.savings / report.summary.income : 0;
    var savings = report.summary.income ? Math.round(15 * Math.min(1, savingsRate / 0.2)) :
      (state.goals.some(function (goal) { return goal.saved > 0; }) ? 7 : 3);
    var data = Math.min(10, Math.round(Math.min(5, report.transactions.length / 4) +
      Math.min(3, f.linkedAccounts(state).length) + (state.bills.length || state.goals.length ? 2 : 0)));
    var score = Math.max(0, Math.min(100, liquidity + bills + cashFlow + savings + data));
    var grade = score >= 80 ? "Strong" : score >= 60 ? "Stable" : score >= 40 ? "Developing" : "Needs attention";
    return {
      score: score,
      grade: grade,
      components: [
        { name: "Liquidity buffer", score: liquidity, maximum: 30, note: liquidityRatio.toFixed(1) + "x monthly outflows / bills" },
        { name: "Bill readiness", score: bills, maximum: 25, note: Math.round(billCoverage * 100) + "% combined coverage" },
        { name: "Cash-flow margin", score: cashFlow, maximum: 20, note: window.FH.utils.formatCurrency(report.summary.netCashFlow) + " monthly net" },
        { name: "Savings momentum", score: savings, maximum: 15, note: (savingsRate * 100).toFixed(1) + "% of income recorded as savings" },
        { name: "Data confidence", score: data, maximum: 10, note: report.transactions.length + " in-range transactions" }
      ],
      report: report,
      funding: funding,
      available: available
    };
  }

  function decision(state, options) {
    options = options || {};
    var f = window.FH.finance;
    var today = options.today || f.dateOnly(new Date());
    var horizon = options.horizon || "monthly";
    if (HORIZONS.indexOf(horizon) === -1) throw new Error("Select a supported planning horizon.");
    var expectedIncome = nonNegative(options.expectedIncome, "Expected income");
    var plannedPurchase = nonNegative(options.plannedPurchase, "Planned purchase");
    var extraGoal = nonNegative(options.extraGoal, "Extra goal contribution");
    var reserve = nonNegative(options.reserve, "Reserve");
    var health = resilience(state, today);
    var funding = f.funding(state, horizon, today);
    var available = round(funding.accounts.reduce(function (sum, item) { return sum + item.available; }, 0));
    var goals = goalCommitments(state, horizon, today);
    var safeToSpend = round(available + expectedIncome - funding.total - goals - plannedPurchase - extraGoal - reserve);
    var actions = [];
    if (safeToSpend < 0) actions.push({ priority: "High", title: "Close the projected shortfall",
      detail: "Reduce planned spending or add " + window.FH.utils.formatCurrency(Math.abs(safeToSpend)) + " before committing." });
    if (funding.total > available) actions.push({ priority: "High", title: "Bills exceed available funds",
      detail: "Pending bills exceed combined linked-account availability by " + window.FH.utils.formatCurrency(funding.total - available) + "." });
    if (health.report.summary.netCashFlow < 0) actions.push({ priority: "Medium", title: "Review monthly outflows",
      detail: "Posted monthly outflows exceed income by " + window.FH.utils.formatCurrency(Math.abs(health.report.summary.netCashFlow)) + "." });
    if (health.report.summary.income > 0 && health.report.summary.savings / health.report.summary.income < 0.1) {
      actions.push({ priority: "Medium", title: "Build savings momentum", detail: "Recorded savings are below 10% of monthly income." });
    }
    if (!state.goals.length) actions.push({ priority: "Low", title: "Create a named savings goal",
      detail: "A dated goal makes planned contributions visible in the forecast." });
    if (!state.bills.length) actions.push({ priority: "Low", title: "Add recurring obligations",
      detail: "The forecast is more useful after rent, utilities and subscriptions are recorded as bills." });
    if (!actions.length) actions.push({ priority: "Low", title: "Maintain the plan",
      detail: "No immediate pressure is visible in the current local demo data." });
    return {
      today: today,
      horizon: horizon,
      end: f.advanceDate(today, horizon),
      available: available,
      expectedIncome: expectedIncome,
      bills: funding.total,
      goalCommitments: goals,
      plannedPurchase: plannedPurchase,
      extraGoal: extraGoal,
      reserve: reserve,
      safeToSpend: safeToSpend,
      health: health,
      actions: actions
    };
  }

  function calendar(state, horizon, today) {
    var f = window.FH.finance;
    today = today || f.dateOnly(new Date());
    var end = f.advanceDate(today, horizon || "quarterly");
    var events = f.funding(state, horizon || "quarterly", today).occurrences.map(function (item) {
      return { date: item.dueDate, type: "Bill", title: item.bill.name, amount: item.bill.amount,
        note: item.overdue ? "Overdue" : item.bill.frequency };
    });
    state.goals.forEach(function (goal) {
      if (goal.targetDate >= today && goal.targetDate <= end) {
        events.push({ date: goal.targetDate, type: "Goal target", title: goal.name,
          amount: Math.max(0, round(goal.target - goal.saved)), note: goal.frequency + " plan" });
      }
    });
    (state.household.requests || []).filter(function (request) { return request.status === "pending"; }).forEach(function (request) {
      events.push({ date: window.FH.finance.dateOnly(new Date(request.createdAt)), type: "Household approval",
        title: request.description, amount: request.amount, note: "Pending decision" });
    });
    return events.sort(function (left, right) { return left.date.localeCompare(right.date); });
  }

  function merchantKey(description) {
    return String(description || "").toLowerCase().replace(/\u2014.*$/, "").replace(/\d+/g, "").replace(/[^a-z]+/g, " ").trim();
  }

  function daysBetween(left, right) {
    return Math.abs(new Date(left).getTime() - new Date(right).getTime()) / 86400000;
  }

  function protection(state, today) {
    today = today || window.FH.finance.dateOnly(new Date());
    var accountIds = window.FH.finance.linkedAccounts(state).map(function (account) { return account.id; });
    var debits = state.transactions.filter(function (transaction) {
      return accountIds.indexOf(transaction.accountId) !== -1 && transaction.amount < 0;
    });
    var groups = {};
    debits.filter(function (transaction) { return transaction.status === "posted"; }).forEach(function (transaction) {
      var key = merchantKey(transaction.description);
      if (!key) return;
      groups[key] = (groups[key] || []).concat([transaction]).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    });
    var recurring = Object.keys(groups).map(function (key) {
      var items = groups[key];
      if (items.length < 2) return null;
      var amounts = items.map(function (item) { return Math.abs(item.amount); });
      var average = amounts.reduce(function (sum, amount) { return sum + amount; }, 0) / amounts.length;
      var variance = amounts.reduce(function (sum, amount) { return sum + Math.pow(amount - average, 2); }, 0) / amounts.length;
      var intervals = [];
      for (var index = 1; index < items.length; index++) intervals.push(daysBetween(items[index].date, items[index - 1].date));
      var averageInterval = intervals.reduce(function (sum, days) { return sum + days; }, 0) / intervals.length;
      if (averageInterval < 14 || Math.sqrt(variance) / Math.max(average, 1) > 0.35) return null;
      return { id: "recurring_" + key.replace(/\s+/g, "_"), merchant: items[0].description, count: items.length,
        average: round(average), averageInterval: Math.round(averageInterval),
        monthlyEstimate: round(average * 30 / averageInterval), lastDate: items[items.length - 1].date };
    }).filter(Boolean).sort(function (a, b) { return b.monthlyEstimate - a.monthlyEstimate; });

    var duplicates = [];
    for (var i = 0; i < debits.length; i++) {
      for (var j = i + 1; j < debits.length; j++) {
        var left = debits[i], right = debits[j];
        if (left.accountId !== right.accountId || merchantKey(left.description) !== merchantKey(right.description)) continue;
        var amountDifference = Math.abs(Math.abs(left.amount) - Math.abs(right.amount));
        if (daysBetween(left.date, right.date) <= 2 && amountDifference <= Math.max(1, Math.abs(left.amount) * 0.01)) {
          duplicates.push({ id: "duplicate_" + [left.id, right.id].sort().join("_"), left: left, right: right,
            amount: round(Math.abs(left.amount)), reviewed: false });
        }
      }
    }

    var byCategory = {};
    debits.filter(function (transaction) { return transaction.status === "posted"; }).forEach(function (transaction) {
      var key = transaction.category || "other";
      byCategory[key] = (byCategory[key] || []).concat([transaction]);
    });
    var unusual = [];
    Object.keys(byCategory).forEach(function (category) {
      var items = byCategory[category];
      if (items.length < 3) return;
      var amounts = items.map(function (item) { return Math.abs(item.amount); });
      var average = amounts.reduce(function (sum, amount) { return sum + amount; }, 0) / amounts.length;
      var variance = amounts.reduce(function (sum, amount) { return sum + Math.pow(amount - average, 2); }, 0) / amounts.length;
      var threshold = Math.max(average * 1.75, average + Math.sqrt(variance) * 1.5);
      items.forEach(function (item) {
        if (Math.abs(item.amount) > threshold) unusual.push({ id: "unusual_" + item.id, transaction: item,
          average: round(average), threshold: round(threshold), reviewed: false });
      });
    });
    var reviewed = state.reviewedProtectionAlerts || [];
    duplicates.concat(unusual).forEach(function (item) { item.reviewed = reviewed.indexOf(item.id) !== -1; });
    var pending = debits.filter(function (transaction) { return transaction.status === "pending"; });
    return {
      recurring: recurring,
      duplicates: duplicates,
      unusual: unusual.sort(function (a, b) { return Math.abs(b.transaction.amount) - Math.abs(a.transaction.amount); }),
      pending: pending,
      recurringMonthlyEstimate: round(recurring.reduce(function (sum, item) { return sum + item.monthlyEstimate; }, 0)),
      unreviewedCount: duplicates.concat(unusual).filter(function (item) { return !item.reviewed; }).length
    };
  }

  function scamCheck(answers) {
    answers = answers || {};
    var weights = { urgent: 2, otp: 3, remoteAccess: 3, guaranteedReturn: 2, changedDetails: 2, unknownRecipient: 1 };
    var score = Object.keys(weights).reduce(function (total, key) { return total + (answers[key] ? weights[key] : 0); }, 0);
    var level = score >= 5 ? "High risk" : score >= 2 ? "Caution" : "Lower risk";
    var actions = ["Verify the recipient using a trusted phone number or official channel before paying."];
    if (answers.otp) actions.unshift("Never share an OTP, PIN, password or card security code.");
    if (answers.remoteAccess) actions.unshift("Do not install remote-access software or let anyone control your device.");
    if (answers.changedDetails) actions.push("Confirm changed account details with a known contact using a separate channel.");
    if (answers.guaranteedReturn) actions.push("Treat guaranteed or pressure-based investment returns as a major warning sign.");
    if (score >= 5) actions.push("Pause the payment and contact the relevant bank or provider fraud team.");
    return { score: score, level: level, actions: actions };
  }

  function householdBudget(state, today) {
    var report = window.FH.reports.buildReport(state, { period: "monthly", endDate: today });
    var actuals = {};
    report.categories.forEach(function (category) { actuals[category.id] = category.amount; });
    return (state.household.budgets || []).map(function (budget) {
      var actual = actuals[budget.category] || 0;
      var remaining = round(budget.limit - actual);
      return { budget: budget, actual: actual, remaining: remaining,
        percentage: budget.limit ? actual / budget.limit * 100 : 0,
        status: actual > budget.limit ? "Over budget" : actual > budget.limit * 0.8 ? "Watch" : "On track" };
    });
  }

  window.FH.smart = {
    HORIZONS: HORIZONS,
    nonNegative: nonNegative,
    goalCommitments: goalCommitments,
    resilience: resilience,
    decision: decision,
    calendar: calendar,
    merchantKey: merchantKey,
    protection: protection,
    scamCheck: scamCheck,
    householdBudget: householdBudget
  };
})();
