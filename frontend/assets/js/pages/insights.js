/* Insights page - donut breakdown + monthly bar chart */
(function () {
  var u = window.FH.utils;
  var store = window.FH.store;
  var data = window.FH.data;
  if (!u.requireConsent()) return;

  var content = window.FH.nav.renderShell({ active: "insights", title: "Insights", brandTag: "Aggregation + Payments", footerNote: "Demo data only. No live bank or payment integration." });
  var state = store.getState();

  function spendByCategory() {
    var totals = {};
    state.transactions.forEach(function (t) {
      if (t.amount >= 0) return;
      totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
    });
    return totals;
  }

  function donutCard() {
    var totals = spendByCategory();
    var total = Object.keys(totals).reduce(function (sum, k) { return sum + totals[k]; }, 0) || 1;
    var gradientParts = [];
    var cursor = 0;
    var legendItems = [];

    data.CATEGORIES.forEach(function (c) {
      var value = totals[c.id] || 0;
      if (!value) return;
      var pct = (value / total) * 100;
      gradientParts.push(c.color + " " + cursor + "% " + (cursor + pct) + "%");
      cursor += pct;
      legendItems.push(u.el("div", { class: "legend-item" }, [
        u.el("span", { class: "legend-swatch", style: "background:" + c.color + ";" }),
        u.el("span", {}, [c.name + " \u2022 " + Math.round(pct) + "%"])
      ]));
    });

    var donut = u.el("div", { class: "donut", style: "background: conic-gradient(" + gradientParts.join(", ") + ");" }, [
      u.el("div", { class: "donut-center" }, [
        u.el("strong", {}, [u.formatCurrency(total)]),
        u.el("span", {}, ["This month"])
      ])
    ]);

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [u.el("h3", {}, ["Spending mix"])]),
      u.el("div", { class: "donut-wrap" }, [donut, u.el("div", { class: "legend" }, legendItems)])
    ]);
  }

  function monthlyTrendCard() {
    var months = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), month: d.getMonth(), year: d.getFullYear(), total: 0 });
    }
    state.transactions.forEach(function (t) {
      if (t.amount >= 0) return;
      var d = new Date(t.date);
      months.forEach(function (m) {
        if (m.month === d.getMonth() && m.year === d.getFullYear()) m.total += Math.abs(t.amount);
      });
    });
    var max = Math.max.apply(null, months.map(function (m) { return m.total; }).concat([1]));

    var cols = months.map(function (m) {
      var heightPct = Math.max(4, Math.round((m.total / max) * 100));
      return u.el("div", { class: "bar-chart-col" }, [
        u.el("div", { class: "bar-chart-bar", style: "height:" + heightPct + "%;", title: u.formatCurrency(m.total) }),
        u.el("span", { class: "bar-chart-label" }, [m.label])
      ]);
    });

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [u.el("h3", {}, ["Spend trend (6 months)"])]),
      u.el("div", { class: "bar-chart" }, cols)
    ]);
  }

  function insightNotes() {
    var totals = spendByCategory();
    var topCategory = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; })[0];
    var topLabel = (data.CATEGORIES.filter(function (c) { return c.id === topCategory; })[0] || {}).name || "spending";
    var notes = [
      "Your largest spending category this period is " + topLabel + ".",
      "You have " + state.accounts.length + " linked accounts contributing to this view.",
      state.disputes.length ? state.disputes.length + " dispute(s) on file - check the Disputes page for status." : "No open disputes on your linked accounts."
    ];
    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [u.el("h3", {}, ["Notes"])]),
      u.el("ul", { style: "display:flex;flex-direction:column;gap:10px;" }, notes.map(function (n) {
        return u.el("li", { class: "text-muted", style: "font-size:0.88rem;" }, ["\u2022 " + n]);
      }))
    ]);
  }

  content.appendChild(u.el("div", { class: "page-header" }, [
    u.el("div", {}, [
      u.el("h2", {}, ["Spending insights"]),
      u.el("p", {}, ["Understand where your money goes across every linked account."])
    ])
  ]));
  content.appendChild(u.el("div", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [donutCard(), monthlyTrendCard()]));
  content.appendChild(insightNotes());
})();
