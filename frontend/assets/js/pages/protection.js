(function () {
  var u = window.FH.utils, f = window.FH.finance, smart = window.FH.smart, store = window.FH.store;
  if (!u.requireConsent()) return;
  var content = window.FH.nav.renderShell({ active: "protection", title: "Protection Centre",
    brandTag: "Smart finance", footerNote: "Local pattern review only. FinanceHub does not block transactions or contact a bank." });
  var output = u.el("div", { id: "protection-output", "aria-live": "polite" });
  var scamResult = u.el("div", { id: "scam-result", "aria-live": "polite" });
  var questions = [
    ["urgent", "You are being pressured to act immediately"],
    ["otp", "Someone asked for an OTP, PIN, password or security code"],
    ["remoteAccess", "Someone asked you to install remote-access or screen-sharing software"],
    ["guaranteedReturn", "The payment promises guaranteed or unusually high investment returns"],
    ["changedDetails", "Known payment details changed unexpectedly"],
    ["unknownRecipient", "You have not independently verified the recipient"]
  ];
  var scamInputs = {};
  var scamForm = u.el("form", { class: "card", style: "margin-top:24px;" }, [
    u.el("h3", {}, ["Pre-payment scam sense-check"]),
    u.el("p", { class: "field-hint" }, ["This checklist cannot confirm that a payment is safe. It helps users pause when common warning signs appear."])
  ].concat(questions.map(function (question) {
    scamInputs[question[0]] = u.el("input", { type: "checkbox", id: "scam-" + question[0] });
    return u.el("label", { class: "checkbox-row", for: "scam-" + question[0] }, [scamInputs[question[0]], question[1]]);
  })).concat([
    u.el("button", { type: "submit", class: "btn btn-primary", style: "margin-top:14px;" }, ["Check warning signs"]),
    scamResult
  ]));

  function review(id) {
    try { store.reviewProtectionAlert(id); render(); }
    catch (error) { console.error(error); window.alert(error.message); }
  }

  function render() {
    var result = smart.protection(store.getState());
    var duplicateRows = result.duplicates.map(function (item) {
      return u.el("tr", {}, [u.el("td", {}, [item.left.description]), u.el("td", {}, [u.formatCurrency(item.amount)]),
        u.el("td", {}, [u.formatDate(item.left.date) + " / " + u.formatDate(item.right.date)]),
        u.el("td", {}, [item.reviewed ? "Reviewed" : u.el("button", { class: "btn btn-ghost btn-sm", onClick: function () { review(item.id); } }, ["Mark reviewed"])])]);
    });
    var unusualRows = result.unusual.map(function (item) {
      return u.el("tr", {}, [u.el("td", {}, [item.transaction.description]), u.el("td", {}, [u.formatDate(item.transaction.date)]),
        u.el("td", {}, [u.formatCurrency(Math.abs(item.transaction.amount))]),
        u.el("td", {}, ["Category average " + u.formatCurrency(item.average)]),
        u.el("td", {}, [item.reviewed ? "Reviewed" : u.el("button", { class: "btn btn-ghost btn-sm", onClick: function () { review(item.id); } }, ["Mark reviewed"])])]);
    });
    output.replaceChildren(
      u.el("div", { class: "grid grid-cols-4", style: "margin-bottom:24px;" }, [
        stat("Possible recurring monthly", u.formatCurrency(result.recurringMonthlyEstimate), result.recurring.length + " pattern(s)"),
        stat("Unreviewed alerts", String(result.unreviewedCount), "Local review queue"),
        stat("Pending debits", String(result.pending.length), "Not yet posted"),
        stat("Data source", "Local demo", "No bank fraud feed")
      ]),
      u.el("div", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [
        u.el("section", { class: "card card-flush" }, [
          u.el("div", { class: "report-card-title" }, ["Possible recurring payments"]),
          f.table(["Merchant", "Occurrences", "Average", "Average interval", "Monthly estimate"],
            result.recurring.map(function (item) { return u.el("tr", {}, [u.el("td", {}, [item.merchant]),
              u.el("td", {}, [String(item.count)]), u.el("td", {}, [u.formatCurrency(item.average)]),
              u.el("td", {}, [item.averageInterval + " days"]), u.el("td", {}, [u.formatCurrency(item.monthlyEstimate)])]); }))
        ]),
        u.el("section", { class: "card card-flush" }, [
          u.el("div", { class: "report-card-title" }, ["Pending debit review"]),
          f.table(["Description", "Date", "Amount"], result.pending.map(function (item) {
            return u.el("tr", {}, [u.el("td", {}, [item.description]), u.el("td", {}, [u.formatDate(item.date)]),
              u.el("td", {}, [u.formatCurrency(Math.abs(item.amount))])]);
          }))
        ])
      ]),
      u.el("section", { class: "card card-flush", style: "margin-bottom:24px;" }, [
        u.el("div", { class: "report-card-title" }, ["Possible duplicate charges"]),
        f.table(["Description", "Amount", "Dates", "Review"], duplicateRows)
      ]),
      u.el("section", { class: "card card-flush" }, [
        u.el("div", { class: "report-card-title" }, ["Unusual spending compared with its category"]),
        f.table(["Description", "Date", "Amount", "Comparison", "Review"], unusualRows)
      ])
    );
  }

  function stat(label, value, note) {
    return u.el("div", { class: "card stat-card" }, [u.el("span", { class: "stat-label" }, [label]),
      u.el("span", { class: "stat-value" }, [value]), u.el("span", { class: "field-hint" }, [note])]);
  }
  f.handleForm(scamForm, function () {
    var answers = {};
    Object.keys(scamInputs).forEach(function (key) { answers[key] = scamInputs[key].checked; });
    var check = smart.scamCheck(answers);
    scamResult.replaceChildren(u.el("div", { class: "scam-result " + (check.level === "High risk" ? "is-high" : "") }, [
      u.el("h3", {}, [check.level + " \u2022 score " + check.score]),
      u.el("ul", {}, check.actions.map(function (action) { return u.el("li", {}, [action]); }))
    ]));
  });
  content.appendChild(u.el("div", { class: "page-header" }, [u.el("div", {}, [
    u.el("h2", {}, ["See patterns worth reviewing"]),
    u.el("p", {}, ["Review possible recurring, duplicate, unusual and pending activity. Pattern matches are prompts, not fraud findings."])
  ])]));
  content.appendChild(u.el("div", { class: "disclaimer-banner" }, [
    u.el("span", {}, ["FinanceHub does not monitor a live bank feed, block payments, confirm fraud or replace contacting your bank."])
  ]));
  content.appendChild(output);
  content.appendChild(scamForm);
  render();
})();
