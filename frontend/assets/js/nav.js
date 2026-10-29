/* Renders the app shell (sidebar + topbar) around a page's content */
(function () {
  window.FH = window.FH || {};
  var u = null;

  var NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", href: "index.html", icon: "grid" },
    { key: "accounts", label: "Accounts", href: "accounts.html", icon: "bank" },
    { key: "payments", label: "Payments", href: "payments.html", icon: "send" },
    { key: "bills", label: "Bills & alerts", href: "bills.html", icon: "list" },
    { key: "goals", label: "Savings goals", href: "goals.html", icon: "flag" },
    { key: "investments", label: "Shareholdings", href: "investments.html", icon: "chart" },
    { key: "reports", label: "Reports", href: "reports.html", icon: "report" },
    { key: "decision", label: "Decision Lab", href: "decision.html", icon: "spark" },
    { key: "protection", label: "Protection Centre", href: "protection.html", icon: "shield" },
    { key: "household", label: "Household", href: "household.html", icon: "people" },
    { key: "transactions", label: "Transactions", href: "transactions.html", icon: "list" },
    { key: "insights", label: "Insights", href: "insights.html", icon: "chart" },
    { key: "disputes", label: "Disputes", href: "disputes.html", icon: "flag" }
  ];

  var ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" stroke="currentColor" stroke-width="1.6"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 10 12 4l9 6M5 10v9M9 10v9M15 10v9M19 10v9M3 19h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10m6 10V4m6 16v-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 21V4h13l-3 4 3 4H5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h4M9 11h6M9 15h6M9 7h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Zm7 13 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 5 6v5c0 4.8 2.8 8.3 7 10 4.2-1.7 7-5.2 7-10V6l-7-3Zm-3 9 2 2 4-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 1 0 0-6m-7 9c-4 0-6 2-6 5v2h12v-2c0-3-2-5-6-5Zm7 0c3 0 5 1.7 5 4v2h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };

  function buildNavItems(active) {
    return NAV_ITEMS.concat(window.FH.extraNavItems || []).map(function (item) {
      var isActive = item.key === active;
      return u.el("a", {
        href: item.href,
        class: "nav-link" + (isActive ? " is-active" : ""),
        "aria-current": isActive ? "page" : null
      }, [
        u.el("span", { class: "nav-icon", html: ICONS[item.icon] || "" }),
        item.label
      ]);
    });
  }

  function renderShell(options) {
    u = window.FH.utils;
    var body = document.body;
    window.addEventListener("storage", function (event) {
      if (event.key === window.FH.store.STORAGE_KEY) window.location.reload();
    });
    body.innerHTML = "";

    var sidebar = u.el("aside", { class: "sidebar", id: "sidebar" }, [
      u.el("div", { class: "sidebar-brand" }, [
        u.el("div", { class: "brand-mark" }, ["FH"]),
        u.el("div", {}, [
          u.el("div", { class: "sidebar-brand-name" }, ["FinanceHub"]),
          u.el("div", { class: "sidebar-brand-tag" }, [options.brandTag || "Aggregation"])
        ])
      ]),
      u.el("nav", {}, [
        u.el("div", { class: "nav-group-label" }, ["Menu"]),
        u.el("div", { class: "nav-list" }, buildNavItems(options.active))
      ]),
      u.el("div", { class: "sidebar-footer" }, [
        u.el("div", {}, [options.footerNote || "Demo data only. No live bank connection."]),
        u.el("button", {
          class: "btn btn-ghost btn-sm",
          style: "margin-top:8px;width:100%;",
          onClick: function () {
            window.FH.store.resetDemo();
            window.location.href = "onboarding.html";
          }
        }, ["Reset demo data"])
      ])
    ]);

    var content = u.el("div", { class: "page-content", id: "page-content" });

    var topbar = u.el("header", { class: "topbar" }, [
      u.el("div", { style: "display:flex;align-items:center;gap:12px;" }, [
        u.el("button", {
          class: "menu-toggle",
          "aria-label": "Toggle menu",
          onClick: function () {
            sidebar.classList.toggle("is-open");
          }
        }, ["\u2630"]),
        u.el("div", { class: "topbar-title" }, [u.el("h1", {}, [options.title || ""])])
      ]),
      u.el("div", { class: "topbar-actions" }, [
        u.el("div", { class: "badge badge-info" }, ["Prototype"]),
        u.el("div", {
          class: "account-logo",
          style: "width:36px;height:36px;"
        }, [u.initials((window.FH.store.getState().user || {}).name || "FH User")])
      ])
    ]);

    var mainCol = u.el("div", { class: "main-col" }, [topbar, content]);
    var shell = u.el("div", { class: "app-shell" }, [sidebar, mainCol]);
    body.appendChild(shell);

    if (options.paymentDisclaimer) {
      content.appendChild(u.el("div", { class: "disclaimer-banner" }, [
        u.el("span", {}, ["\u26A0\uFE0F"]),
        u.el("span", {}, [
          u.el("strong", {}, ["Prototype only: "]),
          "FinanceHub payment, transfer, savings and brokerage flows are simulated locally. No real funds move within FinanceHub. The REV360 link opens an external tax service; any payment there happens outside this demo."
        ])
      ]));
    }

    return content;
  }

  window.FH.nav = {
    renderShell: renderShell
  };
})();
