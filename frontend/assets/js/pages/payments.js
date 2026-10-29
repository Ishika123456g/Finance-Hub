/* Payments page - send money to a beneficiary, add beneficiaries, view transfer history (prototype only, no real payment rails) */
(function () {
  var u = window.FH.utils;
  var store = window.FH.store;
  if (!u.requireConsent()) return;

  var content = window.FH.nav.renderShell({
    active: "payments",
    title: "Payments",
    brandTag: "Aggregation + Payments",
    paymentDisclaimer: true,
    footerNote: "Demo data only. No live bank or payment integration."
  });
  var state = store.getState();

  var transferListWrap = u.el("div");
  var beneficiaryListWrap = u.el("div");

  function accountOptions() {
    return window.FH.finance.linkedAccounts(store.getState()).map(function (a) {
      return u.el("option", { value: a.id }, [a.nickname + " (" + u.formatCurrency(a.balance, a.currency) + ")"]);
    });
  }

  function beneficiaryOptions() {
    return state.beneficiaries.map(function (b) {
      return u.el("option", { value: b.id }, [b.name + " \u2022 " + b.bankName]);
    });
  }

  function renderTransfers() {
    state = store.getState();
    transferListWrap.innerHTML = "";
    var rows = state.transfers.slice().reverse().map(function (t) {
      var ben = state.beneficiaries.filter(function (b) { return b.id === t.beneficiaryId; })[0];
      var acc = state.accounts.filter(function (a) { return a.id === t.accountId; })[0];
      return u.el("tr", {}, [
        u.el("td", {}, [ben ? ben.name : "Beneficiary"]),
        u.el("td", { class: "cell-muted" }, [acc ? acc.nickname : ""]),
        u.el("td", { class: "cell-muted" }, [u.formatDate(t.createdAt, "short")]),
        u.el("td", { class: "cell-muted" }, [t.note || "\u2013"]),
        u.el("td", { class: "amount-negative" }, [u.formatCurrency(-t.amount)]),
        u.el("td", {}, [u.el("span", { class: "badge badge-success" }, [t.status])])
      ]);
    });

    transferListWrap.appendChild(u.el("div", { class: "card card-flush" }, [
      u.el("div", { class: "table-wrap" }, [
        u.el("table", { class: "data-table" }, [
          u.el("thead", {}, [u.el("tr", {}, [
            u.el("th", {}, ["Beneficiary"]), u.el("th", {}, ["From account"]), u.el("th", {}, ["Date"]),
            u.el("th", {}, ["Note"]), u.el("th", {}, ["Amount"]), u.el("th", {}, ["Status"])
          ])]),
          u.el("tbody", {}, rows.length ? rows : [u.el("tr", {}, [u.el("td", { colspan: "6", class: "cell-muted" }, ["No transfers yet."])])])
        ])
      ])
    ]));
  }

  function renderBeneficiaries() {
    state = store.getState();
    beneficiaryListWrap.innerHTML = "";
    state.beneficiaries.forEach(function (b) {
      beneficiaryListWrap.appendChild(u.el("div", { class: "account-tile" }, [
        u.el("div", { class: "account-identity" }, [
          u.el("div", { class: "account-logo" }, [u.initials(b.name)]),
          u.el("div", {}, [
            u.el("div", { class: "account-name" }, [b.name]),
            u.el("div", { class: "account-meta" }, [b.bankName + " \u2022 " + b.accountNumber])
          ])
        ])
      ]));
    });
  }

  function sendMoneyForm() {
    var accountSelect = u.el("select", { id: "pay-account" }, accountOptions());
    var beneficiarySelect = u.el("select", { id: "pay-beneficiary" }, beneficiaryOptions());
    var amountInput = u.el("input", { type: "number", min: "100", step: "50", placeholder: "0.00", id: "pay-amount" });
    var noteInput = u.el("input", { type: "text", placeholder: "What's this for? (optional)", id: "pay-note" });
    var submitBtn = u.el("button", { class: "btn btn-primary btn-block" }, ["Review transfer"]);

    submitBtn.addEventListener("click", function () {
      state = store.getState();
      var amount = parseFloat(amountInput.value);
      var accountId = accountSelect.value;
      var account = state.accounts.filter(function (a) { return a.id === accountId; })[0];

      if (!Number.isFinite(amount) || amount <= 0) { alert("Enter a valid amount."); return; }
      if (!account) { alert("Select a linked NGN account."); return; }
      var coverage = window.FH.finance.funding(state, state.billAlertPeriod).accounts.find(function (item) { return item.account.id === accountId; });
      if (!coverage || amount > coverage.available) { alert("Amount exceeds funds available after pending bank debits."); return; }

      openConfirmModal({
        accountId: accountId,
        beneficiaryId: beneficiarySelect.value,
        amount: amount,
        note: noteInput.value.trim()
      });
    });

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [u.el("h3", {}, ["Send money"])]),
      u.el("div", { class: "field" }, [u.el("label", {}, ["From account"]), accountSelect]),
      u.el("div", { class: "field" }, [u.el("label", {}, ["To beneficiary"]), beneficiarySelect]),
      u.el("div", { class: "field-row" }, [
        u.el("div", { class: "field", style: "margin-bottom:0;" }, [u.el("label", {}, ["Amount (NGN)"]), amountInput]),
        u.el("div", { class: "field", style: "margin-bottom:0;" }, [u.el("label", {}, ["Note"]), noteInput])
      ]),
      u.el("div", { style: "height:8px;" }),
      submitBtn
    ]);
  }

  function openConfirmModal(draft) {
    var beneficiary = state.beneficiaries.filter(function (b) { return b.id === draft.beneficiaryId; })[0];
    var account = state.accounts.filter(function (a) { return a.id === draft.accountId; })[0];
    var backdrop = u.qs("#payment-modal-backdrop");
    var body = u.qs("#payment-modal-body");
    body.innerHTML = "";
    body.appendChild(u.el("div", {}, [
      u.el("p", {}, ["You're sending " + u.formatCurrency(draft.amount) + " to " + (beneficiary ? beneficiary.name : "beneficiary") + " from " + (account ? account.nickname : "your account") + "."]),
      draft.note ? u.el("p", { class: "text-faint" }, ["Note: " + draft.note]) : null,
      u.el("div", { class: "disclaimer-banner", style: "margin-top:16px;" }, [
        u.el("span", {}, ["\u26A0\uFE0F"]),
        u.el("span", {}, ["This confirmation simulates a transfer for demo purposes only. No real payment processor is contacted and no funds actually move."])
      ]),
      u.el("div", { style: "display:flex;gap:12px;margin-top:16px;" }, [
        u.el("button", { class: "btn btn-ghost", onClick: closeModal }, ["Cancel"]),
        u.el("button", {
          class: "btn btn-primary btn-block",
          onClick: function () { confirmTransfer(draft); }
        }, ["Confirm and simulate send"])
      ])
    ]));
    backdrop.hidden = false;
  }

  function confirmTransfer(draft) {
    try {
      store.addTransfer({
      id: u.uid("trf"),
      beneficiaryId: draft.beneficiaryId,
      accountId: draft.accountId,
      amount: draft.amount,
      note: draft.note,
      status: "completed",
      createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("FinanceHub transfer failed:", error);
      alert(error.message);
      return;
    }
    closeModal();
    state = store.getState();
    renderTransfers();
    u.qs("#pay-account").replaceChildren.apply(u.qs("#pay-account"), accountOptions());
    u.qs("#pay-amount").value = "";
    u.qs("#pay-note").value = "";
    showToast("Transfer of " + u.formatCurrency(draft.amount) + " simulated successfully.");
  }

  function closeModal() {
    u.qs("#payment-modal-backdrop").hidden = true;
  }

  function showToast(message) {
    var stack = u.qs("#toast-stack");
    var toast = u.el("div", { class: "toast" }, [message]);
    stack.appendChild(toast);
    window.setTimeout(function () { toast.remove(); }, 3200);
  }

  function addBeneficiaryForm() {
    var nameInput = u.el("input", { type: "text", placeholder: "Full name" });
    var bankInput = u.el("input", { type: "text", placeholder: "Bank or biller name" });
    var acctInput = u.el("input", { type: "text", placeholder: "Account / meter number" });
    var addBtn = u.el("button", { class: "btn btn-secondary btn-block" }, ["+ Add beneficiary"]);

    addBtn.addEventListener("click", function () {
      if (!nameInput.value.trim() || !bankInput.value.trim() || !acctInput.value.trim()) {
        alert("Fill in all beneficiary fields.");
        return;
      }
      store.addBeneficiary({
        id: u.uid("ben"),
        name: nameInput.value.trim(),
        bankName: bankInput.value.trim(),
        accountNumber: acctInput.value.trim()
      });
      nameInput.value = "";
      bankInput.value = "";
      acctInput.value = "";
      state = store.getState();
      renderBeneficiaries();
      location.reload();
    });

    return u.el("div", { class: "card" }, [
      u.el("div", { class: "card-header" }, [u.el("h3", {}, ["Beneficiaries"])]),
      beneficiaryListWrap,
      u.el("div", { style: "height:12px;" }),
      u.el("div", { class: "field" }, [nameInput]),
      u.el("div", { class: "field" }, [bankInput]),
      u.el("div", { class: "field" }, [acctInput]),
      addBtn
    ]);
  }

  function buildModal() {
    document.body.appendChild(u.el("div", { class: "modal-backdrop", id: "payment-modal-backdrop", hidden: "true" }, [
      u.el("div", { class: "modal" }, [
        u.el("div", { class: "modal-header" }, [
          u.el("h3", {}, ["Confirm transfer"]),
          u.el("button", { class: "modal-close", onClick: closeModal }, ["\u2715"])
        ]),
        u.el("div", { id: "payment-modal-body" })
      ])
    ]));
    document.body.appendChild(u.el("div", { class: "toast-stack", id: "toast-stack" }));
  }

  content.appendChild(u.el("div", { class: "page-header" }, [
    u.el("div", {}, [
      u.el("h2", {}, ["Payments"]),
      u.el("p", {}, ["Send money to saved beneficiaries and review your transfer history."])
    ])
  ]));
  content.appendChild(u.el("div", { class: "card", style: "margin-bottom:24px;" }, [
    u.el("h3", {}, ["Pay taxes with REV360"]),
    u.el("p", {}, ["Open the NRS self-service workspace to sign in and complete your tax payment externally. FinanceHub does not receive your tax credentials, initiate this payment, or verify its status."]),
    u.el("a", { href: "https://selfservice.nrs.gov.ng/workspace", target: "_blank", rel: "noopener noreferrer",
      class: "btn btn-primary" }, ["Open REV360 / NRS tax portal"]),
    u.el("p", { class: "field-hint" }, ["External destination: https://selfservice.nrs.gov.ng/workspace. Check the address and tax details before paying."])
  ]));
  content.appendChild(u.el("div", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [sendMoneyForm(), addBeneficiaryForm()]));
  content.appendChild(u.el("h3", { style: "margin-bottom:14px;" }, ["Transfer history"]));
  content.appendChild(transferListWrap);

  buildModal();
  renderBeneficiaries();
  renderTransfers();
})();
