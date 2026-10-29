(function () {
  var u = window.FH.utils;
  var f = window.FH.finance;
  var store = window.FH.store;
  if (!u.requireConsent()) return;
  var content = window.FH.nav.renderShell({ active: "bills", title: "Bills & funding alerts",
    brandTag: "Aggregation + Payments", paymentDisclaimer: true,
    footerNote: "In-app demo alerts only. No background notifications or automatic bill payments." });
  var name = f.field("bill-name", "Bill name", { required: true, maxlength: "100", placeholder: "Rent, electricity, insurance..." });
  var amount = f.field("bill-amount", "Amount per bill (NGN)", { type: "number", min: "0.01", step: "0.01", required: true });
  var date = f.field("bill-date", "First unpaid due date", { type: "date", required: true, value: f.dateOnly(new Date()) });
  var frequency = f.field("bill-frequency", "Repeat", {}, [{ value: "once", label: "One-off" }].concat(f.PERIODS));
  var period = f.field("alert-period", "Alert planning window", {}, f.PERIODS);
  period.control.value = store.getState().billAlertPeriod;
  var output = u.el("div", { id: "bill-results", "aria-live": "polite" });
  var form = u.el("form", { class: "card" }, [
    u.el("h3", {}, ["Add a pending bill"]), name.node, amount.node,
    u.el("div", { class: "field-row" }, [date.node, frequency.node]),
    u.el("button", { type: "submit", class: "btn btn-primary" }, ["Save pending bill"])
  ]);
  f.handleForm(form, function () {
    store.addBill({ id: u.uid("bill"), name: name.control.value, amount: amount.control.value,
      dueDate: date.control.value, frequency: frequency.control.value });
    name.control.value = "";
    amount.control.value = "";
    render();
  });
  period.control.addEventListener("change", function () {
    try {
      store.setState({ billAlertPeriod: period.control.value });
      render();
    } catch (error) {
      period.control.value = store.getState().billAlertPeriod;
      console.error(error);
      window.alert("Could not save the alert period: " + error.message);
    }
  });

  function render() {
    var state = store.getState();
    var report = f.funding(state, state.billAlertPeriod);
    output.replaceChildren(f.fundingNotice(state));
    output.appendChild(u.el("p", {}, ["Includes all overdue occurrences and bills due through " +
      u.formatDate(report.end) + ". Each account is compared with the full total, not recommended for multiple bills independently."]));
    output.appendChild(u.el("div", { class: "card" }, [
      u.el("h3", {}, ["Account coverage for " + u.formatCurrency(report.total)]),
      u.el("p", { class: "field-hint" }, ["NGN accounts from consented banks only. Pending bank debits are reserved conservatively; do not also enter the same debit as a bill. Savings contributions already reduce demo balances. No future income or fees are assumed."]),
      f.table(["Bank account", "Available after pending debits", "Coverage"], report.accounts.map(function (item) {
        return u.el("tr", {}, [
          u.el("td", {}, [item.account.nickname + " (" + item.account.last4 + ")"]),
          u.el("td", {}, [u.formatCurrency(item.available)]),
          u.el("td", {}, [!report.occurrences.length ? "No bills due" : item.enough ? "Enough for all pending bills" :
            "Short by " + u.formatCurrency(item.shortfall)])
        ]);
      }))
    ]));
    output.appendChild(u.el("div", { class: "card", style: "margin-top:24px;" }, [
      u.el("h3", {}, ["Pending occurrences in this window"]),
      f.table(["Bill", "Due date", "Amount", "Accounts able to cover this bill alone"], report.occurrences.map(function (item) {
        var eligible = report.accounts.filter(function (account) { return account.available >= item.bill.amount; });
        return u.el("tr", {}, [
          u.el("td", {}, [item.bill.name]), u.el("td", {}, [u.formatDate(item.dueDate) + (item.overdue ? " (overdue)" : "")]),
          u.el("td", {}, [u.formatCurrency(item.bill.amount)]),
          u.el("td", {}, [eligible.length ? eligible.map(function (account) { return account.account.nickname; }).join(", ") : "No account has enough"])
        ]);
      }))
    ]));
    output.appendChild(u.el("div", { class: "card", style: "margin-top:24px;" }, [
      u.el("h3", {}, ["Bill schedules"]),
      u.el("p", { class: "field-hint" }, ["Close a schedule when no longer pending. Closing cancels all its occurrences; it does not pay the bill or move funds."]),
      f.table(["Bill", "First unpaid date", "Repeat", "Status", "Action"], state.bills.map(function (bill) {
        return u.el("tr", {}, [
          u.el("td", {}, [bill.name]), u.el("td", {}, [u.formatDate(bill.dueDate)]),
          u.el("td", {}, [bill.frequency]), u.el("td", {}, [bill.status]),
          u.el("td", {}, [bill.status === "pending" ? u.el("button", { class: "btn btn-ghost btn-sm", onClick: function () {
            if (!window.confirm("Close this entire schedule? No payment will be made.")) return;
            try { store.closeBill(bill.id); render(); }
            catch (error) { console.error(error); window.alert(error.message); }
          } }, ["Close schedule"]) : "Closed"])
        ]);
      }))
    ]));
  }

  content.appendChild(u.el("div", { class: "page-header" }, [
    u.el("div", {}, [u.el("h2", {}, ["Plan bills before they fall due"]),
      u.el("p", {}, ["Alerts recalculate on page load, while this page is open, and after changes. This demo cannot notify you when the browser is closed."])])
  ]));
  content.appendChild(u.el("div", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [
    form, u.el("div", { class: "card" }, [u.el("h3", {}, ["Alert preferences"]), period.node,
      u.el("p", {}, ["Weekly = next 7 days. Monthly, quarterly and annually use calendar periods from today. Recurring bills keep the original day, clamped at month-end."])])
  ]));
  content.appendChild(output);
  render();
  window.setInterval(render, 60000);
  window.addEventListener("focus", render);
})();
