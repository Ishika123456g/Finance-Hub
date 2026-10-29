/* Reports interface: historical activity, current snapshots and forward bill readiness. */
(function () {
  var u = window.FH.utils;
  var f = window.FH.finance;
  var reports = window.FH.reports;
  var store = window.FH.store;
  if (!u.requireConsent()) return;

  var content = window.FH.nav.renderShell({
    active: "reports",
    title: "Reports",
    brandTag: "Aggregation + Payments",
    paymentDisclaimer: true,
    footerNote: "Reports use local demo data only. No audited statements or live provider feeds."
  });
  var linkedAccounts = f.linkedAccounts(store.getState());
  var periodField = f.field("report-period", "Reporting period", {}, reports.REPORT_PERIODS);
  periodField.control.value = "monthly";
  var accountField = f.field("report-account", "Account", {}, [{ value: "all", label: "All linked NGN accounts" }].concat(
    linkedAccounts.map(function (account) {
      return { value: account.id, label: account.nickname + " (\u2022\u2022" + account.last4 + ")" };
    })
  ));
  var typeField = f.field("report-type", "Report view", {}, [
    { value: "all", label: "Complete financial report" },
    { value: "overview", label: "Financial position overview" },
    { value: "cashflow", label: "Account cash flow" },
    { value: "spending", label: "Spending by category" },
    { value: "bills", label: "Bill readiness" },
    { value: "goals", label: "Savings goal progress" },
    { value: "portfolio", label: "Shareholding snapshot" },
    { value: "transactions", label: "Transaction activity" }
  ]);
  var generated = u.el("div", { class: "field-hint", id: "report-generated", "aria-live": "polite" });
  var reportRoot = u.el("div", { id: "report-output" });
  var currentReport = null;

  function statCard(label, value, note, tone) {
    return u.el("div", { class: "card stat-card" }, [
      u.el("span", { class: "stat-label" }, [label]),
      u.el("span", { class: "stat-value" + (tone ? " " + tone : "") }, [value]),
      u.el("span", { class: "field-hint" }, [note])
    ]);
  }

  function reportSection(key, title, description, children) {
    return u.el("section", { class: "report-section", "data-report-section": key }, [
      u.el("div", { class: "report-section-header" }, [
        u.el("div", {}, [u.el("h2", {}, [title]), u.el("p", {}, [description])])
      ])
    ].concat(children));
  }

  function empty(message) {
    return u.el("div", { class: "report-empty" }, [message]);
  }

  function renderOverview(report) {
    return reportSection("overview", "Financial position overview",
      "Current balances are snapshots. Income, outflows and transactions use the selected historical range.", [
        u.el("div", { class: "grid grid-cols-3" }, [
          statCard("Current linked balance", u.formatCurrency(report.summary.currentBalance), "Not a historical opening balance"),
          statCard("Posted income", u.formatCurrency(report.summary.income), report.range.start + " to " + report.range.end, "amount-positive"),
          statCard("Posted outflows", u.formatCurrency(report.summary.outflows), "Includes savings contributions", "amount-negative"),
          statCard("Net cash flow", u.formatCurrency(report.summary.netCashFlow), "Posted income minus posted outflows",
            report.summary.netCashFlow >= 0 ? "amount-positive" : "amount-negative"),
          statCard("Pending outflows", u.formatCurrency(report.summary.pendingOutflows), "Excluded from net cash flow"),
          statCard("Open disputes", String(report.openDisputes.length), "Current unresolved dispute snapshot")
        ])
      ]);
  }

  function renderCashFlow(report) {
    var rows = report.accountRows.map(function (item) {
      return u.el("tr", {}, [
        u.el("td", {}, [item.account.nickname]),
        u.el("td", {}, [u.formatCurrency(item.account.balance)]),
        u.el("td", { class: "amount-positive" }, [u.formatCurrency(item.income)]),
        u.el("td", { class: "amount-negative" }, [u.formatCurrency(item.outflows)]),
        u.el("td", { class: item.net >= 0 ? "amount-positive" : "amount-negative" }, [u.formatCurrency(item.net)]),
        u.el("td", {}, [u.formatCurrency(item.pendingOutflows)])
      ]);
    });
    return reportSection("cashflow", "Account cash flow",
      "Posted activity in the report range, grouped by source account. Pending debits are shown separately.", [
        u.el("div", { class: "card card-flush" }, [
          f.table(["Account", "Current balance", "Income", "Outflows", "Net cash flow", "Pending outflows"], rows)
        ])
      ]);
  }

  function renderSpending(report) {
    if (!report.categories.length) {
      return reportSection("spending", "Spending by category",
        "Posted negative transactions, including savings contributions.", [empty("No posted outflows in this report range.")]);
    }
    var max = Math.max.apply(null, report.categories.map(function (item) { return item.amount; }));
    var rows = report.categories.map(function (item) {
      return u.el("div", { class: "report-category-row" }, [
        u.el("div", {}, [
          u.el("strong", {}, [item.name]),
          u.el("span", { class: "field-hint" }, [item.share.toFixed(1) + "% of posted outflows"])
        ]),
        u.el("div", { class: "category-track" }, [
          u.el("div", { class: "category-fill", style: "width:" + (item.amount / max * 100) + "%;" })
        ]),
        u.el("strong", {}, [u.formatCurrency(item.amount)])
      ]);
    });
    return reportSection("spending", "Spending by category",
      "Posted negative transactions. Savings is reported separately below because it is an outflow but not consumption.", [
        u.el("div", { class: "grid grid-cols-2" }, [
          u.el("div", { class: "card" }, rows),
          u.el("div", { class: "card" }, [
            u.el("div", { class: "stat-card" }, [
              u.el("span", { class: "stat-label" }, ["Consumption spending"]),
              u.el("span", { class: "stat-value" }, [u.formatCurrency(report.summary.spending)]),
              u.el("span", { class: "field-hint" }, ["Posted outflows excluding savings category"])
            ]),
            u.el("div", { class: "stat-card", style: "margin-top:24px;" }, [
              u.el("span", { class: "stat-label" }, ["Savings contributions"]),
              u.el("span", { class: "stat-value" }, [u.formatCurrency(report.summary.savings)]),
              u.el("span", { class: "field-hint" }, ["Demo savings outflows in this range"])
            ])
          ])
        ])
      ]);
  }

  function renderBills(report) {
    var coverageRows = report.bills.accounts.map(function (item) {
      return u.el("tr", {}, [
        u.el("td", {}, [item.account.nickname]),
        u.el("td", {}, [u.formatCurrency(item.available)]),
        u.el("td", {}, [report.bills.total === 0 ? "No bills due" :
          item.enough ? "Can cover all bills" : "Short by " + u.formatCurrency(item.shortfall)])
      ]);
    });
    var occurrenceRows = report.bills.occurrences.map(function (item) {
      return u.el("tr", {}, [
        u.el("td", {}, [item.bill.name]),
        u.el("td", {}, [u.formatDate(item.dueDate)]),
        u.el("td", {}, [item.bill.frequency]),
        u.el("td", {}, [u.formatCurrency(item.bill.amount)]),
        u.el("td", {}, [item.overdue ? "Overdue" : "Upcoming"])
      ]);
    });
    return reportSection("bills", "Bill readiness",
      "Forward-looking from the report end date through the selected planning horizon; this is not historical cash flow.", [
        u.el("div", { class: "grid grid-cols-3", style: "margin-bottom:20px;" }, [
          statCard("Pending bill total", u.formatCurrency(report.bills.total), "Through " + u.formatDate(report.bills.end)),
          statCard("Occurrences", String(report.bills.occurrences.length), "Overdue plus upcoming"),
          statCard("Accounts covering all", String(report.bills.accounts.filter(function (item) { return item.enough; }).length),
            "After pending bank debits")
        ]),
        u.el("div", { class: "grid grid-cols-2" }, [
          u.el("div", { class: "card card-flush" }, [
            u.el("div", { class: "report-card-title" }, ["Account coverage"]),
            f.table(["Account", "Available", "Readiness"], coverageRows)
          ]),
          u.el("div", { class: "card card-flush" }, [
            u.el("div", { class: "report-card-title" }, ["Pending occurrences"]),
            f.table(["Bill", "Due", "Repeat", "Amount", "Status"], occurrenceRows)
          ])
        ])
      ]);
  }

  function renderGoals(report) {
    if (!report.goals.length) {
      return reportSection("goals", "Savings goal progress",
        "Current goal snapshot plus contributions made in the selected historical range.", [empty("No savings goals have been created.")]);
    }
    var cards = report.goals.map(function (item) {
      return u.el("div", { class: "card" }, [
        u.el("h3", {}, [item.goal.name]),
        u.el("p", { class: "field-hint" }, [item.goal.category + " \u2022 target " + u.formatDate(item.goal.targetDate)]),
        u.el("p", {}, [u.formatCurrency(item.goal.saved) + " of " + u.formatCurrency(item.goal.target)]),
        u.el("progress", { class: "goal-progress", value: String(item.plan.progress), max: "100",
          "aria-label": item.goal.name + " report progress" }),
        u.el("p", {}, ["Contributed in range: " + u.formatCurrency(item.periodContributions) +
          " across " + item.contributionCount + " contribution(s)."]),
        u.el("p", { class: "field-hint" }, [item.plan.remaining === 0 ? "Target reached." :
          item.plan.contribution === null ? "Target date has passed." :
          "Suggested " + item.goal.frequency + " contribution: " + u.formatCurrency(item.plan.contribution)])
      ]);
    });
    return reportSection("goals", "Savings goal progress",
      "Current saved balances and progress, with contribution activity limited to the report range and account filter.", [
        u.el("div", { class: "grid grid-cols-2" }, cards)
      ]);
  }

  function renderPortfolio(report) {
    var rows = report.holdings.map(function (item) {
      return u.el("tr", {}, [
        u.el("td", {}, [item.holding.symbol + " \u2022 " + item.holding.name]),
        u.el("td", {}, [String(item.holding.units)]),
        u.el("td", {}, [u.formatCurrency(item.analysis.value)]),
        u.el("td", { class: item.analysis.gain >= 0 ? "amount-positive" : "amount-negative" }, [u.formatCurrency(item.analysis.gain)]),
        u.el("td", {}, [item.analysis.change === null ? "Unavailable" :
          (item.analysis.change >= 0 ? "+" : "") + item.analysis.change.toFixed(2) + "%"]),
        u.el("td", {}, [item.analysis.signal]),
        u.el("td", { class: "field-hint" }, [u.formatDate(item.holding.asOf)])
      ]);
    });
    return reportSection("portfolio", "Shareholding snapshot",
      "Current entered valuation and unrealised gain/loss. Signals are educational, price-only and not personalised advice.", [
        u.el("div", { class: "grid grid-cols-3", style: "margin-bottom:20px;" }, [
          statCard("Portfolio value", u.formatCurrency(report.summary.portfolioValue), "Current entered prices"),
          statCard("Unrealised gain / loss", u.formatCurrency(report.summary.portfolioGain),
            "Excludes fees, dividends, taxes and FX", report.summary.portfolioGain >= 0 ? "amount-positive" : "amount-negative"),
          statCard("Holdings", String(report.holdings.length), report.range.period === "quarterly" ?
            "Quarterly action signals unavailable" : "Signals use " + report.range.period + " reference prices")
        ]),
        report.holdings.length ? u.el("div", { class: "card card-flush" }, [
          f.table(["Holding", "Units", "Value", "Gain / loss", "Period change", "Signal", "Price date"], rows)
        ]) : empty("No shareholdings have been recorded.")
      ]);
  }

  function renderTransactions(report) {
    var names = {};
    report.accounts.forEach(function (account) { names[account.id] = account.nickname; });
    var rows = report.transactions.map(function (transaction) {
      return u.el("tr", {}, [
        u.el("td", {}, [u.formatDate(transaction.date)]),
        u.el("td", {}, [transaction.description]),
        u.el("td", {}, [names[transaction.accountId] || transaction.accountId]),
        u.el("td", {}, [transaction.category || "other"]),
        u.el("td", { class: transaction.amount >= 0 ? "amount-positive" : "amount-negative" }, [u.formatCurrency(transaction.amount)]),
        u.el("td", {}, [transaction.status])
      ]);
    });
    return reportSection("transactions", "Transaction activity",
      "Posted and pending entries in the selected range. Pending entries are excluded from income, outflow and net totals.", [
        report.transactions.length ? u.el("div", { class: "card card-flush" }, [
          f.table(["Date", "Description", "Account", "Category", "Amount", "Status"], rows)
        ]) : empty("No transactions match this report period and account filter.")
      ]);
  }

  function renderNotes(report) {
    var notes = [
      "Report range is rolling and inclusive: " + report.range.start + " through " + report.range.end + ".",
      "Current account balances, open disputes, goal balances and portfolio values are present-time snapshots, not reconstructed historical closing balances.",
      "Cash-flow totals use posted transactions only. Pending negative entries appear separately and are reserved in bill-readiness calculations.",
      "Reports include linked NGN accounts only. No currency conversion, fees, interest, dividends, taxes or external provider reconciliation is available.",
      "Bill readiness is forward-looking from the report end date and does not reserve funds or initiate payment.",
      "The account filter applies to cash flow, spending, bill coverage, transactions and in-range goal contributions. Current goal balances and shareholdings are product-level snapshots and are not attributed to a bank account.",
      "All data is local demo data and these reports are not audited bank statements, tax records or investment reports."
    ];
    if (report.quality.invalidTransactionDates) {
      notes.push(report.quality.invalidTransactionDates + " transaction(s) with invalid dates were excluded.");
    }
    if (report.range.period === "quarterly") {
      notes.push("No quarterly share-price reference is captured, so quarterly reports do not show an action signal.");
    }
    return u.el("section", { class: "report-notes" }, [
      u.el("h2", {}, ["Methodology and data-quality notes"]),
      u.el("ul", {}, notes.map(function (note) { return u.el("li", {}, [note]); }))
    ]);
  }

  function applyView() {
    var selected = typeField.control.value;
    u.qsa("[data-report-section]", reportRoot).forEach(function (section) {
      section.hidden = selected !== "all" && section.getAttribute("data-report-section") !== selected;
    });
  }

  function render() {
    try {
      currentReport = reports.buildReport(store.getState(), {
        period: periodField.control.value,
        accountId: accountField.control.value
      });
      reportRoot.replaceChildren(
        renderOverview(currentReport),
        renderCashFlow(currentReport),
        renderSpending(currentReport),
        renderBills(currentReport),
        renderGoals(currentReport),
        renderPortfolio(currentReport),
        renderTransactions(currentReport),
        renderNotes(currentReport)
      );
      generated.textContent = "Generated " + u.formatDate(currentReport.generatedAt) + " at " +
        u.formatDate(currentReport.generatedAt, "time") + " \u2022 rolling " + currentReport.range.period +
        " range " + currentReport.range.start + " to " + currentReport.range.end;
      applyView();
    } catch (error) {
      console.error("FinanceHub report generation failed:", error);
      reportRoot.replaceChildren(u.el("div", { class: "disclaimer-banner" }, [
        u.el("span", {}, ["Report generation failed: " + error.message])
      ]));
    }
  }

  function downloadCsv(filename, rows) {
    try {
      var blob = new Blob(["\uFEFF" + reports.csv(rows)], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var anchor = u.el("a", { href: url, download: filename });
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    } catch (error) {
      console.error("FinanceHub CSV export failed:", error);
      window.alert("Could not export the report: " + error.message);
    }
  }

  periodField.control.addEventListener("change", render);
  accountField.control.addEventListener("change", render);
  typeField.control.addEventListener("change", applyView);

  content.appendChild(u.el("div", { class: "page-header no-print" }, [
    u.el("div", {}, [
      u.el("h2", {}, ["Financial reports"]),
      u.el("p", {}, ["Review activity, current financial position, future bill readiness, savings goals and shareholdings."])
    ])
  ]));
  content.appendChild(u.el("div", { class: "card report-controls no-print" }, [
    u.el("div", { class: "report-filter-grid" }, [periodField.node, accountField.node, typeField.node]),
    u.el("div", { class: "feature-actions" }, [
      u.el("button", { class: "btn btn-primary", onClick: function () { window.print(); } }, ["Print / save PDF"]),
      u.el("button", { class: "btn btn-secondary", onClick: function () {
        if (currentReport) downloadCsv("financehub-report-" + currentReport.range.period + "-" + currentReport.range.end + ".csv",
          reports.reportRows(currentReport));
      } }, ["Export complete CSV"]),
      u.el("button", { class: "btn btn-ghost", onClick: function () {
        if (currentReport) downloadCsv("financehub-transactions-" + currentReport.range.start + "-to-" +
          currentReport.range.end + ".csv", reports.transactionRows(currentReport));
      } }, ["Export transactions CSV"])
    ]),
    generated
  ]));
  content.appendChild(u.el("div", { class: "print-only report-print-header" }, [
    u.el("h1", {}, ["FinanceHub financial report"]),
    u.el("p", {}, ["Local demonstration report \u2022 not an audited statement"])
  ]));
  content.appendChild(reportRoot);
  render();
  window.addEventListener("focus", render);
})();
