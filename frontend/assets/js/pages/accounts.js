/* Accounts page */
(function () {
  var u = window.FH.utils;
  var store = window.FH.store;
  var data = window.FH.data;
  if (!u.requireConsent()) return;

  var content = window.FH.nav.renderShell({ active: "accounts", title: "Accounts", brandTag: "Aggregation + Payments", footerNote: "Demo data only. No live bank or payment integration." });
  var state = store.getState();

  function bankName(bankId) {
    var bank = data.BANKS.filter(function (b) { return b.id === bankId; })[0];
    return bank ? bank.name : bankId;
  }

  content.appendChild(u.el("div", { class: "page-header" }, [
    u.el("div", {}, [
      u.el("h2", {}, ["Linked accounts"]),
      u.el("p", {}, ["All institutions currently connected with your consent."])
    ]),
    u.el("a", { href: "onboarding.html", class: "btn btn-secondary" }, ["+ Link another account"])
  ]));

  var grid = u.el("div", { class: "grid grid-cols-2" });
  state.accounts.forEach(function (acc) {
    grid.appendChild(u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [
        u.el("div", { class: "account-identity" }, [
          u.el("div", { class: "account-logo" }, [u.initials(acc.nickname)]),
          u.el("div", {}, [
            u.el("div", { class: "account-name" }, [acc.nickname]),
            u.el("div", { class: "account-meta" }, [bankName(acc.bankId) + " \u2022 " + acc.type])
          ])
        ]),
        u.el("span", { class: "badge " + (acc.health === "good" ? "badge-success" : "badge-warning") }, [
          acc.health === "good" ? "Healthy" : "Needs attention"
        ])
      ]),
      u.el("div", { style: "display:flex;justify-content:space-between;align-items:flex-end;" }, [
        u.el("div", {}, [
          u.el("div", { class: "stat-label" }, ["Available balance"]),
          u.el("div", { class: "stat-value" }, [u.formatCurrency(acc.balance, acc.currency)])
        ]),
        u.el("div", { class: "text-faint", style: "font-size:0.8rem;" }, ["Account \u2022\u2022" + acc.last4])
      ])
    ]));
  });
  content.appendChild(grid);
})();
