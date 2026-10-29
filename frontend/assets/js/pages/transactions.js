/* Transactions page - searchable, filterable table */
(function () {
  var u = window.FH.utils;
  var store = window.FH.store;
  var data = window.FH.data;
  if (!u.requireConsent()) return;

  var content = window.FH.nav.renderShell({ active: "transactions", title: "Transactions", brandTag: "Aggregation + Payments", footerNote: "Demo data only. No live bank or payment integration." });
  var state = store.getState();

  var filters = { search: "", accountId: "all", category: "all" };
  var tableWrap = u.el("div");

  function accountOptions() {
    return [u.el("option", { value: "all" }, ["All accounts"])].concat(
      state.accounts.map(function (a) { return u.el("option", { value: a.id }, [a.nickname]); })
    );
  }

  function categoryOptions() {
    return [u.el("option", { value: "all" }, ["All categories"])].concat(
      data.CATEGORIES.map(function (c) { return u.el("option", { value: c.id }, [c.name]); })
    );
  }

  function filteredTransactions() {
    return state.transactions.filter(function (t) {
      if (filters.accountId !== "all" && t.accountId !== filters.accountId) return false;
      if (filters.category !== "all" && t.category !== filters.category) return false;
      if (filters.search && t.description.toLowerCase().indexOf(filters.search.toLowerCase()) === -1) return false;
      return true;
    });
  }

  function categoryLabel(id) {
    var c = data.CATEGORIES.filter(function (cat) { return cat.id === id; })[0];
    return c ? c.name : id;
  }

  function accountLabel(id) {
    var a = state.accounts.filter(function (acc) { return acc.id === id; })[0];
    return a ? a.nickname : id;
  }

  function renderTable() {
    var rows = filteredTransactions();
    tableWrap.innerHTML = "";

    if (!rows.length) {
      tableWrap.appendChild(u.el("div", { class: "empty-state" }, ["No transactions match your filters."]));
      return;
    }

    var body = rows.map(function (t) {
      return u.el("tr", {}, [
        u.el("td", {}, [t.description, t.status === "pending" ? u.el("span", { class: "badge badge-warning", style: "margin-left:8px;" }, ["Pending"]) : null]),
        u.el("td", { class: "cell-muted" }, [accountLabel(t.accountId)]),
        u.el("td", { class: "cell-muted" }, [categoryLabel(t.category)]),
        u.el("td", { class: "cell-muted" }, [u.formatDate(t.date, "short")]),
        u.el("td", { class: t.amount < 0 ? "amount-negative" : "amount-positive" }, [u.formatCurrency(t.amount)])
      ]);
    });

    tableWrap.appendChild(u.el("div", { class: "card card-flush" }, [
      u.el("div", { class: "table-wrap" }, [
        u.el("table", { class: "data-table" }, [
          u.el("thead", {}, [u.el("tr", {}, [
            u.el("th", {}, ["Description"]), u.el("th", {}, ["Account"]), u.el("th", {}, ["Category"]),
            u.el("th", {}, ["Date"]), u.el("th", {}, ["Amount"])
          ])]),
          u.el("tbody", {}, body)
        ])
      ])
    ]));
  }

  content.appendChild(u.el("div", { class: "page-header" }, [
    u.el("div", {}, [
      u.el("h2", {}, ["Transactions"]),
      u.el("p", {}, ["Search and filter across every linked account."])
    ])
  ]));

  var searchInput = u.el("input", { type: "search", placeholder: "Search transactions...", style: "min-width:220px;" });
  searchInput.addEventListener("input", function (e) {
    filters.search = e.target.value;
    renderTable();
  });

  var accountSelect = u.el("select", {}, accountOptions());
  accountSelect.addEventListener("change", function (e) {
    filters.accountId = e.target.value;
    renderTable();
  });

  var categorySelect = u.el("select", {}, categoryOptions());
  categorySelect.addEventListener("change", function (e) {
    filters.category = e.target.value;
    renderTable();
  });

  content.appendChild(u.el("div", { class: "card", style: "margin-bottom:20px;" }, [
    u.el("div", { style: "display:flex;gap:12px;flex-wrap:wrap;" }, [searchInput, accountSelect, categorySelect])
  ]));

  content.appendChild(tableWrap);
  renderTable();
})();
