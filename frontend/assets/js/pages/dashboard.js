/* Dashboard page */
(function () {
  var u = window.FH.utils;
  var store = window.FH.store;
  var data = window.FH.data;

  if (!u.requireConsent()) return;

  var content = window.FH.nav.renderShell({
    active: "dashboard",
    title: "Dashboard",
    brandTag: "Aggregation + Payments",
    paymentDisclaimer: true,
    footerNote: "Demo data only. No live bank or payment integration."
  });
  var state = store.getState();

  function bankName(bankId) {
    var bank = data.BANKS.filter(function (b) { return b.id === bankId; })[0];
    return bank ? bank.name : bankId;
  }

  function totalBalance() {
    return state.accounts.reduce(function (sum, acc) { return sum + acc.balance; }, 0);
  }

  function monthlySpend() {
    var now = new Date();
    return state.transactions
      .filter(function (t) {
        var d = new Date(t.date);
        return t.amount < 0 && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce(function (sum, t) { return sum + Math.abs(t.amount); }, 0);
  }

  function pendingDisputes() {
    return state.disputes.filter(function (d) { return d.status !== "resolved"; }).length;
  }

  function statCards() {
    return u.el("div", { class: "grid grid-cols-4", style: "margin-bottom:28px;" }, [
      statCard("Total balance", u.formatCurrency(totalBalance()), "+2.4% vs last month", "up"),
      statCard("Linked accounts", String(state.accounts.length), state.linkedBankIds.length + " institutions", null),
      statCard("Spend this month", u.formatCurrency(monthlySpend()), "-6.1% vs last month", "down"),
      statCard("Open disputes", String(pendingDisputes()), pendingDisputes() ? "Needs attention" : "All clear", pendingDisputes() ? "down" : "up")
    ]);
  }

  function statCard(label, value, delta, direction) {
    return u.el("div", { class: "card stat-card" }, [
      u.el("span", { class: "stat-label" }, [label]),
      u.el("span", { class: "stat-value" }, [value]),
      u.el("span", { class: "stat-delta" + (direction ? " " + direction : "") }, [delta])
    ]);
  }

  function accountsSummary() {
    var tiles = state.accounts.map(function (acc) {
      return u.el("div", { class: "account-tile" }, [
        u.el("div", { class: "account-identity" }, [
          u.el("div", { class: "account-logo" }, [u.initials(acc.nickname)]),
          u.el("div", {}, [
            u.el("div", { class: "account-name" }, [acc.nickname]),
            u.el("div", { class: "account-meta" }, [bankName(acc.bankId) + " \u2022 " + acc.type + " \u2022 \u2022\u2022" + acc.last4])
          ])
        ]),
        u.el("div", { class: "account-balance" }, [
          u.el("strong", {}, [u.formatCurrency(acc.balance, acc.currency)]),
          u.el("span", { class: "badge " + (acc.health === "good" ? "badge-success" : "badge-warning") }, [
            acc.health === "good" ? "Healthy" : "Needs attention"
          ])
        ])
      ]);
    });

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [
        u.el("h3", {}, ["Your accounts"]),
        u.el("a", { href: "accounts.html", class: "btn btn-ghost btn-sm" }, ["View all"])
      ]),
      u.el("div", {}, tiles)
    ]);
  }

  function recentTransactions() {
    var rows = state.transactions.slice(0, 6).map(function (t) {
      var acc = state.accounts.filter(function (a) { return a.id === t.accountId; })[0];
      return u.el("tr", {}, [
        u.el("td", {}, [t.description]),
        u.el("td", { class: "cell-muted" }, [acc ? acc.nickname : ""]),
        u.el("td", { class: "cell-muted" }, [u.formatDate(t.date, "short")]),
        u.el("td", { class: t.amount < 0 ? "amount-negative" : "amount-positive" }, [u.formatCurrency(t.amount)])
      ]);
    });

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [
        u.el("h3", {}, ["Recent transactions"]),
        u.el("a", { href: "transactions.html", class: "btn btn-ghost btn-sm" }, ["View all"])
      ]),
      u.el("div", { class: "table-wrap" }, [
        u.el("table", { class: "data-table" }, [
          u.el("thead", {}, [u.el("tr", {}, [
            u.el("th", {}, ["Description"]), u.el("th", {}, ["Account"]), u.el("th", {}, ["Date"]), u.el("th", {}, ["Amount"])
          ])]),
          u.el("tbody", {}, rows)
        ])
      ])
    ]);
  }

  function categoryBreakdown() {
    var totals = {};
    state.transactions.forEach(function (t) {
      if (t.amount >= 0) return;
      totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
    });
    var max = Math.max.apply(null, Object.keys(totals).map(function (k) { return totals[k]; }).concat([1]));

    var rows = data.CATEGORIES.filter(function (c) { return totals[c.id]; }).map(function (c) {
      var value = totals[c.id] || 0;
      var pct = Math.round((value / max) * 100);
      return u.el("div", { class: "category-row" }, [
        u.el("span", { class: "category-name" }, [c.name]),
        u.el("div", { class: "category-track" }, [
          u.el("div", { class: "category-fill", style: "width:" + pct + "%;background:" + c.color + ";" })
        ]),
        u.el("span", { class: "category-amount" }, [u.formatCurrency(value)])
      ]);
    });

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [
        u.el("h3", {}, ["Spending by category"]),
        u.el("a", { href: "insights.html", class: "btn btn-ghost btn-sm" }, ["Full insights"])
      ]),
      u.el("div", {}, rows)
    ]);
  }

  function recentTransfers() {
    var rows = state.transfers.slice().reverse().slice(0, 4).map(function (t) {
      var ben = state.beneficiaries.filter(function (b) { return b.id === t.beneficiaryId; })[0];
      return u.el("tr", {}, [
        u.el("td", {}, [ben ? ben.name : "Beneficiary"]),
        u.el("td", { class: "cell-muted" }, [u.formatDate(t.createdAt, "short")]),
        u.el("td", { class: "amount-negative" }, [u.formatCurrency(-t.amount)]),
        u.el("td", {}, [u.el("span", { class: "badge badge-success" }, [t.status])])
      ]);
    });

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [
        u.el("h3", {}, ["Recent transfers"]),
        u.el("a", { href: "payments.html", class: "btn btn-ghost btn-sm" }, ["Send money"])
      ]),
      u.el("div", { class: "table-wrap" }, [
        u.el("table", { class: "data-table" }, [
          u.el("thead", {}, [u.el("tr", {}, [
            u.el("th", {}, ["Beneficiary"]), u.el("th", {}, ["Date"]), u.el("th", {}, ["Amount"]), u.el("th", {}, ["Status"])
          ])]),
          u.el("tbody", {}, rows.length ? rows : [u.el("tr", {}, [u.el("td", { colspan: "4", class: "cell-muted" }, ["No transfers yet."])])])
        ])
      ])
    ]);
  }

  function quickActions() {
    return u.el("div", { class: "card", style: "margin-bottom:24px;display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between;" }, [
      u.el("div", {}, [
        u.el("h3", { style: "margin-bottom:4px;" }, ["Quick actions"]),
        u.el("p", { style: "margin:0;font-size:0.85rem;" }, ["Send money or pay a saved beneficiary from a linked account."])
      ]),
      u.el("div", { class: "feature-actions" }, [
        u.el("a", { href: "payments.html", class: "btn btn-primary" }, ["+ Send money"]),
        u.el("a", { href: "payments.html", class: "btn btn-secondary" }, ["Pay taxes"]),
        u.el("a", { href: "goals.html", class: "btn btn-secondary" }, ["Savings goals"]),
        u.el("a", { href: "investments.html", class: "btn btn-secondary" }, ["Shareholdings"]),
        u.el("a", { href: "reports.html", class: "btn btn-secondary" }, ["Reports"])
      ])
    ]);
  }

  function smartTools() {
    return u.el("div", { class: "grid grid-cols-3", style: "margin-bottom:24px;" }, [
      u.el("a", { href: "decision.html", class: "card smart-tool-card" }, [
        u.el("span", { class: "badge badge-info" }, ["Decision Intelligence"]),
        u.el("h3", {}, ["Safe-to-spend & what-if planning"]),
        u.el("p", {}, ["See an explainable resilience score, test scenarios and review a prioritised money calendar."])
      ]),
      u.el("a", { href: "protection.html", class: "card smart-tool-card" }, [
        u.el("span", { class: "badge badge-info" }, ["Financial Protection"]),
        u.el("h3", {}, ["Review patterns and warning signs"]),
        u.el("p", {}, ["Inspect possible recurring, duplicate, unusual and pending activity, plus run a scam sense-check."])
      ]),
      u.el("a", { href: "household.html", class: "card smart-tool-card" }, [
        u.el("span", { class: "badge badge-info" }, ["Household Finance"]),
        u.el("h3", {}, ["Plan together with clear approvals"]),
        u.el("p", {}, ["Coordinate members, monthly budgets, shared goals, contributions and spending requests."])
      ])
    ]);
  }

  content.appendChild(u.el("div", { class: "page-header" }, [
    u.el("div", {}, [
      u.el("h2", {}, ["Welcome back, " + state.user.name.split(" ")[0]]),
      u.el("p", {}, ["Here's a unified view of everything linked to FinanceHub, including your recent transfers."])
    ])
  ]));
  content.appendChild(statCards());
  content.appendChild(quickActions());
  content.appendChild(smartTools());
  var fundingAlert = u.el("div");
  function refreshFundingAlert() {
    fundingAlert.replaceChildren(window.FH.finance.fundingNotice(store.getState()));
  }
  refreshFundingAlert();
  content.appendChild(fundingAlert);
  window.setInterval(refreshFundingAlert, 60000);
  window.addEventListener("focus", refreshFundingAlert);
  content.appendChild(u.el("div", { class: "grid grid-cols-2" }, [accountsSummary(), categoryBreakdown()]));
  content.appendChild(u.el("div", { style: "height:24px;" }));
  content.appendChild(u.el("div", { class: "grid grid-cols-2" }, [recentTransactions(), recentTransfers()]));
})();
