/* Calendar-based planning and illustrative portfolio analytics (no provider APIs). */
(function () {
  window.FH = window.FH || {};
  var PERIODS = ["weekly", "monthly", "quarterly", "annually"];
  var ANALYSIS_PERIODS = ["daily", "weekly", "monthly", "annually"];

  function dateOnly(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function parseDate(value) {
    var date = new Date(value + "T00:00:00");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || dateOnly(date) !== value) {
      throw new Error("Enter a valid calendar date.");
    }
    return date;
  }

  function advanceDate(value, period, count) {
    var date = parseDate(value);
    count = count === undefined ? 1 : count;
    if (!Number.isInteger(count)) throw new Error("Invalid period count.");
    if (period === "daily" || period === "weekly") {
      date.setDate(date.getDate() + count * (period === "daily" ? 1 : 7));
    } else {
      var months = { monthly: 1, quarterly: 3, annually: 12 }[period];
      if (!months) throw new Error("Select a supported period.");
      var day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + months * count);
      var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(day, lastDay));
    }
    return dateOnly(date);
  }

  function money(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
      throw new Error("Enter a positive amount with at most two decimal places.");
    }
    return Math.round(amount * 100) / 100;
  }

  function linkedAccounts(state) {
    return state.accounts.filter(function (account) {
      return state.linkedBankIds.indexOf(account.bankId) !== -1 && account.currency === "NGN";
    });
  }

  function funding(state, period, today) {
    if (PERIODS.indexOf(period) === -1) throw new Error("Select a supported alert period.");
    today = today || dateOnly(new Date());
    var end = advanceDate(today, period);
    var occurrences = [];
    state.bills.filter(function (bill) { return bill.status === "pending"; }).forEach(function (bill) {
      var next = bill.dueDate;
      var index = 0;
      while (next <= end) {
        occurrences.push({ bill: bill, dueDate: next, overdue: next < today });
        if (bill.frequency === "once") break;
        index++;
        next = advanceDate(bill.dueDate, bill.frequency, index);
      }
    });
    occurrences.sort(function (a, b) { return a.dueDate.localeCompare(b.dueDate); });
    var total = occurrences.reduce(function (sum, item) { return sum + Math.round(item.bill.amount * 100); }, 0) / 100;
    var accounts = linkedAccounts(state).map(function (account) {
      var pending = state.transactions.filter(function (transaction) {
        return transaction.accountId === account.id && transaction.status === "pending" && transaction.amount < 0;
      }).reduce(function (sum, transaction) { return sum + Math.round(Math.abs(transaction.amount) * 100); }, 0) / 100;
      var available = Math.max(0, Math.round((account.balance - pending) * 100) / 100);
      return { account: account, available: available, pending: pending, enough: available >= total,
        shortfall: Math.max(0, Math.round((total - available) * 100) / 100) };
    }).sort(function (a, b) { return b.available - a.available; });
    return { total: total, end: end, occurrences: occurrences, accounts: accounts };
  }

  function goalPlan(goal, today) {
    today = today || dateOnly(new Date());
    var remaining = Math.max(0, Math.round((goal.target - goal.saved) * 100) / 100);
    var periods = 0;
    var next = today;
    while (next <= goal.targetDate) {
      periods++;
      next = advanceDate(today, goal.frequency, periods);
    }
    return { remaining: remaining, periods: periods,
      contribution: periods ? Math.ceil(remaining * 100 / periods) / 100 : null,
      progress: Math.min(100, goal.saved / goal.target * 100) };
  }

  function analyze(holding, period, today) {
    if (ANALYSIS_PERIODS.indexOf(period) === -1) throw new Error("Select a supported analysis period.");
    today = today || dateOnly(new Date());
    var reference = holding.references[period];
    var base = { value: holding.units * holding.price, gain: holding.units * (holding.price - holding.cost),
      change: null, signal: "Insufficient data", reason: "Add a dated reference price for this period." };
    if (holding.asOf !== today) {
      base.signal = "Stale data";
      base.reason = "Update the current price as of today before reviewing a signal.";
      return base;
    }
    if (!reference) return base;
    if (reference.date !== advanceDate(holding.asOf, period, -1)) {
      base.reason = "The reference date must be one " + period + " period before the current price date.";
      return base;
    }
    base.change = (holding.price / reference.price - 1) * 100;
    if (base.change >= 5 - 0.00000001) {
      base.signal = "Consider investing";
      base.reason = "Price momentum is at least +5%; research valuation and risk before adding.";
    } else if (base.change <= -5 + 0.00000001) {
      base.signal = "Review selling";
      base.reason = "Price momentum is at most -5%; review your thesis, costs and risk before selling.";
    } else {
      base.signal = "Hold / monitor";
      base.reason = "Price momentum is between -5% and +5%; monitor rather than act on this signal alone.";
    }
    return base;
  }

  function field(id, label, attrs, options) {
    var u = window.FH.utils;
    var control = u.el(options ? "select" : "input", Object.assign({ id: id, name: id }, attrs),
      options ? options.map(function (item) {
        return u.el("option", { value: item.value === undefined ? item : item.value }, [item.label || item]);
      }) : []);
    return { control: control, node: u.el("div", { class: "field" }, [u.el("label", { for: id }, [label]), control]) };
  }

  function handleForm(form, action) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      try {
        action();
      } catch (error) {
        console.error("FinanceHub action failed:", error);
        window.alert(error.message || "The action failed. Please try again.");
      }
    });
  }

  function table(headers, rows) {
    var u = window.FH.utils;
    return u.el("div", { class: "table-wrap" }, [u.el("table", { class: "data-table" }, [
      u.el("thead", {}, [u.el("tr", {}, headers.map(function (header) { return u.el("th", {}, [header]); }))]),
      u.el("tbody", {}, rows.length ? rows : [u.el("tr", {}, [u.el("td", { colspan: String(headers.length) }, ["No items yet."])])])
    ])]);
  }

  function fundingNotice(state) {
    var u = window.FH.utils;
    var report = funding(state, state.billAlertPeriod);
    var enough = report.accounts.filter(function (item) { return item.enough; });
    var message = !report.occurrences.length ? "No pending bills in this planning window." :
      u.formatCurrency(report.total) + " pending (" + state.billAlertPeriod + "). " +
      (enough.length ? "Accounts that can cover all bills: " + enough.map(function (item) { return item.account.nickname; }).join(", ") :
        "No single linked account has enough available funds. Review shortfalls.");
    return u.el("div", { class: "card funding-notice", role: "status", "aria-live": "polite" }, [
      u.el("h3", {}, ["Bill-funding alert"]),
      u.el("p", {}, [message]),
      u.el("a", { class: "btn btn-secondary btn-sm", href: "bills.html" }, ["Review bills and alert period"])
    ]);
  }

  window.FH.finance = { PERIODS: PERIODS, ANALYSIS_PERIODS: ANALYSIS_PERIODS,
    dateOnly: dateOnly, parseDate: parseDate, advanceDate: advanceDate, money: money,
    linkedAccounts: linkedAccounts, funding: funding, goalPlan: goalPlan, analyze: analyze,
    field: field, handleForm: handleForm, table: table, fundingNotice: fundingNotice };
})();
