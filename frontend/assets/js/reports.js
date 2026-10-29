/* Pure report calculations and CSV helpers for the local FinanceHub demo. */
(function () {
  window.FH = window.FH || {};

  var REPORT_PERIODS = ["weekly", "monthly", "quarterly", "annually"];

  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }

  function reportRange(period, endDate) {
    var f = window.FH.finance;
    if (REPORT_PERIODS.indexOf(period) === -1) throw new Error("Select a supported report period.");
    endDate = endDate || f.dateOnly(new Date());
    f.parseDate(endDate);
    var start;
    if (period === "weekly") {
      start = f.advanceDate(endDate, "daily", -6);
    } else {
      start = f.advanceDate(f.advanceDate(endDate, period, -1), "daily", 1);
    }
    return { start: start, end: endDate, period: period };
  }

  function transactionDate(transaction) {
    var date = new Date(transaction.date);
    return Number.isFinite(date.getTime()) ? window.FH.finance.dateOnly(date) : null;
  }

  function inRange(value, range) {
    return value !== null && value >= range.start && value <= range.end;
  }

  function selectedAccounts(state, accountId) {
    var accounts = window.FH.finance.linkedAccounts(state);
    if (!accountId || accountId === "all") return accounts;
    var account = accounts.find(function (item) { return item.id === accountId; });
    if (!account) throw new Error("Select a linked NGN account.");
    return [account];
  }

  function categoryName(categoryId) {
    var category = window.FH.data.CATEGORIES.find(function (item) { return item.id === categoryId; });
    return category ? category.name : "Other";
  }

  function buildReport(state, options) {
    options = options || {};
    var period = options.period || "monthly";
    var accountId = options.accountId || "all";
    var range = reportRange(period, options.endDate);
    var accounts = selectedAccounts(state, accountId);
    var accountIds = accounts.map(function (account) { return account.id; });
    var invalidTransactionDates = 0;
    var transactions = state.transactions.filter(function (transaction) {
      if (accountIds.indexOf(transaction.accountId) === -1) return false;
      var date = transactionDate(transaction);
      if (date === null) invalidTransactionDates++;
      return inRange(date, range);
    }).sort(function (left, right) {
      return new Date(right.date) - new Date(left.date);
    });
    var posted = transactions.filter(function (transaction) { return transaction.status === "posted"; });
    var pending = transactions.filter(function (transaction) { return transaction.status === "pending"; });
    var income = roundMoney(posted.filter(function (transaction) {
      return transaction.amount > 0;
    }).reduce(function (sum, transaction) { return sum + transaction.amount; }, 0));
    var outflows = roundMoney(posted.filter(function (transaction) {
      return transaction.amount < 0;
    }).reduce(function (sum, transaction) { return sum + Math.abs(transaction.amount); }, 0));
    var savings = roundMoney(posted.filter(function (transaction) {
      return transaction.amount < 0 && transaction.category === "savings";
    }).reduce(function (sum, transaction) { return sum + Math.abs(transaction.amount); }, 0));
    var spending = roundMoney(outflows - savings);
    var pendingOutflows = roundMoney(pending.filter(function (transaction) {
      return transaction.amount < 0;
    }).reduce(function (sum, transaction) { return sum + Math.abs(transaction.amount); }, 0));
    var currentBalance = roundMoney(accounts.reduce(function (sum, account) { return sum + account.balance; }, 0));

    var categoryTotals = {};
    posted.forEach(function (transaction) {
      if (transaction.amount >= 0) return;
      var category = transaction.category || "other";
      categoryTotals[category] = roundMoney((categoryTotals[category] || 0) + Math.abs(transaction.amount));
    });
    var categories = Object.keys(categoryTotals).map(function (category) {
      return {
        id: category,
        name: categoryName(category),
        amount: categoryTotals[category],
        share: outflows ? categoryTotals[category] / outflows * 100 : 0
      };
    }).sort(function (left, right) { return right.amount - left.amount; });

    var accountRows = accounts.map(function (account) {
      var items = transactions.filter(function (transaction) { return transaction.accountId === account.id; });
      var accountPosted = items.filter(function (transaction) { return transaction.status === "posted"; });
      var accountIncome = roundMoney(accountPosted.filter(function (transaction) {
        return transaction.amount > 0;
      }).reduce(function (sum, transaction) { return sum + transaction.amount; }, 0));
      var accountOutflows = roundMoney(accountPosted.filter(function (transaction) {
        return transaction.amount < 0;
      }).reduce(function (sum, transaction) { return sum + Math.abs(transaction.amount); }, 0));
      var accountPending = roundMoney(items.filter(function (transaction) {
        return transaction.status === "pending" && transaction.amount < 0;
      }).reduce(function (sum, transaction) { return sum + Math.abs(transaction.amount); }, 0));
      return {
        account: account,
        income: accountIncome,
        outflows: accountOutflows,
        net: roundMoney(accountIncome - accountOutflows),
        pendingOutflows: accountPending
      };
    });

    var billReport = window.FH.finance.funding(state, period, range.end);
    if (accountId !== "all") {
      billReport = Object.assign({}, billReport, {
        accounts: billReport.accounts.filter(function (item) { return item.account.id === accountId; })
      });
    }

    var goals = state.goals.map(function (goal) {
      var plan = window.FH.finance.goalPlan(goal, range.end);
      var contributions = goal.contributions.filter(function (contribution) {
        if (accountId !== "all" && contribution.accountId !== accountId) return false;
        return inRange(transactionDate({ date: contribution.createdAt }), range);
      });
      return {
        goal: goal,
        plan: plan,
        periodContributions: roundMoney(contributions.reduce(function (sum, contribution) {
          return sum + contribution.amount;
        }, 0)),
        contributionCount: contributions.length
      };
    });

    var analysisPeriod = period === "quarterly" ? null : (period === "annually" ? "annually" : period);
    var holdings = state.holdings.map(function (holding) {
      var analysis = analysisPeriod ? window.FH.finance.analyze(holding, analysisPeriod, range.end) : {
        value: holding.units * holding.price,
        gain: holding.units * (holding.price - holding.cost),
        change: null,
        signal: "No quarterly signal",
        reason: "Quarterly reference prices are not captured by this demo."
      };
      return { holding: holding, analysis: analysis };
    });
    var portfolioValue = roundMoney(holdings.reduce(function (sum, item) { return sum + item.analysis.value; }, 0));
    var portfolioGain = roundMoney(holdings.reduce(function (sum, item) { return sum + item.analysis.gain; }, 0));
    var openDisputes = state.disputes.filter(function (dispute) { return dispute.status !== "resolved"; });

    return {
      generatedAt: new Date().toISOString(),
      range: range,
      accountId: accountId,
      accounts: accounts,
      accountRows: accountRows,
      transactions: transactions,
      categories: categories,
      bills: billReport,
      goals: goals,
      holdings: holdings,
      openDisputes: openDisputes,
      summary: {
        currentBalance: currentBalance,
        income: income,
        outflows: outflows,
        spending: spending,
        savings: savings,
        netCashFlow: roundMoney(income - outflows),
        pendingOutflows: pendingOutflows,
        transactionCount: transactions.length,
        portfolioValue: portfolioValue,
        portfolioGain: portfolioGain
      },
      quality: {
        invalidTransactionDates: invalidTransactionDates,
        hasTransactions: transactions.length > 0,
        hasBills: billReport.occurrences.length > 0,
        hasGoals: goals.length > 0,
        hasHoldings: holdings.length > 0,
        historicalBalanceAvailable: false,
        quarterlyPortfolioSignalAvailable: period !== "quarterly"
      }
    };
  }

  function csvCell(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(value);
    var text = String(value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function csv(rows) {
    return rows.map(function (row) {
      return row.map(csvCell).join(",");
    }).join("\r\n");
  }

  function reportRows(report) {
    var rows = [["Section", "Item", "Detail", "Amount NGN", "Status / note"]];
    rows.push(["Report", "Period", report.range.period, "", report.range.start + " to " + report.range.end]);
    rows.push(["Summary", "Current linked balance", "", report.summary.currentBalance, "Current snapshot, not opening balance"]);
    rows.push(["Summary", "Posted income", "", report.summary.income, "Within report range"]);
    rows.push(["Summary", "Posted outflows", "", report.summary.outflows, "Includes savings contributions"]);
    rows.push(["Summary", "Net cash flow", "", report.summary.netCashFlow, "Income minus posted outflows"]);
    rows.push(["Summary", "Pending outflows", "", report.summary.pendingOutflows, "Not included in net cash flow"]);
    report.accountRows.forEach(function (item) {
      rows.push(["Account cash flow", item.account.nickname, "Net " + item.net, item.account.balance,
        "Income " + item.income + "; outflows " + item.outflows + "; pending " + item.pendingOutflows]);
    });
    report.categories.forEach(function (item) {
      rows.push(["Spending category", item.name, item.share.toFixed(2) + "% of outflows", item.amount, ""]);
    });
    report.bills.occurrences.forEach(function (item) {
      rows.push(["Bill readiness", item.bill.name, item.dueDate, item.bill.amount, item.overdue ? "Overdue" : "Due"]);
    });
    report.goals.forEach(function (item) {
      rows.push(["Savings goal", item.goal.name, "Saved " + item.goal.saved + " of " + item.goal.target,
        item.periodContributions, item.contributionCount + " contribution(s) in range"]);
    });
    report.holdings.forEach(function (item) {
      rows.push(["Shareholding", item.holding.symbol, "Value " + roundMoney(item.analysis.value),
        roundMoney(item.analysis.gain), item.analysis.signal + ": " + item.analysis.reason]);
    });
    report.transactions.forEach(function (item) {
      rows.push(["Transaction", item.description, transactionDate(item), item.amount, item.status]);
    });
    return rows;
  }

  function transactionRows(report) {
    var accountNames = {};
    report.accounts.forEach(function (account) { accountNames[account.id] = account.nickname; });
    return [["Date", "Description", "Account", "Category", "Amount NGN", "Status"]].concat(
      report.transactions.map(function (transaction) {
        return [transactionDate(transaction), transaction.description, accountNames[transaction.accountId] || transaction.accountId,
          categoryName(transaction.category), transaction.amount, transaction.status];
      })
    );
  }

  window.FH.reports = {
    REPORT_PERIODS: REPORT_PERIODS,
    reportRange: reportRange,
    buildReport: buildReport,
    csvCell: csvCell,
    csv: csv,
    reportRows: reportRows,
    transactionRows: transactionRows
  };
})();
