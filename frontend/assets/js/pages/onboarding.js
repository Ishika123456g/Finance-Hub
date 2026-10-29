/* Onboarding flow: welcome -> consent -> bank selection -> linking -> done */
(function () {
  var u = window.FH.utils;
  var store = window.FH.store;
  var data = window.FH.data;
  var card = u.qs("#onboarding-card");

  var stepIndex = 0;
  var STEPS = ["welcome", "consent", "banks", "linking", "done"];
  var selectedBanks = [];

  function stepDots() {
    return u.el("div", { class: "step-track" }, STEPS.map(function (s, i) {
      var cls = "step-dot" + (i < stepIndex ? " is-complete" : i === stepIndex ? " is-active" : "");
      return u.el("div", { class: cls });
    }));
  }

  function render() {
    card.innerHTML = "";
    card.appendChild(stepDots());
    card.appendChild(renderStep());
  }

  function renderStep() {
    switch (STEPS[stepIndex]) {
      case "welcome": return welcomeStep();
      case "consent": return consentStep();
      case "banks": return banksStep();
      case "linking": return linkingStep();
      case "done": return doneStep();
      default: return document.createElement("div");
    }
  }

  function welcomeStep() {
    return u.el("div", {}, [
      u.el("div", { class: "brand-mark", style: "margin-bottom:20px;" }, ["FH"]),
      u.el("h2", {}, ["See every account, send money, in one place"]),
      u.el("p", {}, [
        "FinanceHub links your bank and wallet accounts with your consent, so you can track balances, transactions, spending insights, and send money to saved beneficiaries without switching apps."
      ]),
      u.el("p", { class: "text-faint", style: "font-size:0.82rem;" }, [
        "This is a demo prototype. All accounts, balances, transactions, and transfers shown are simulated - no real bank or payment processor is contacted, and no funds actually move."
      ]),
      u.el("button", {
        class: "btn btn-primary btn-block",
        onClick: function () { stepIndex = 1; render(); }
      }, ["Get started"])
    ]);
  }

  function consentStep() {
    var items = [
      "View account balances and account details you choose to link",
      "Read transaction history to build spending insights",
      "Never move money without your explicit, separate authorisation",
      "Let you revoke access at any time from Settings"
    ];
    return u.el("div", {}, [
      u.el("h2", {}, ["Your consent, your control"]),
      u.el("p", {}, ["By continuing, you agree that FinanceHub may:"]),
      u.el("div", { class: "consent-list" }, items.map(function (text) {
        return u.el("div", { class: "consent-item" }, [
          u.el("span", { class: "icon-dot" }, ["\u2713"]),
          u.el("span", {}, [text])
        ]);
      })),
      u.el("label", { class: "checkbox-row" }, [
        u.el("input", { type: "checkbox", id: "consent-check" }),
        u.el("span", {}, ["I consent to FinanceHub retrieving read-only account data from the institutions I select next."])
      ]),
      u.el("div", { style: "display:flex;gap:12px;margin-top:20px;" }, [
        u.el("button", { class: "btn btn-ghost", onClick: function () { stepIndex = 0; render(); } }, ["Back"]),
        u.el("button", {
          class: "btn btn-primary btn-block",
          onClick: function () {
            if (!u.qs("#consent-check").checked) {
              alert("Please confirm consent to continue.");
              return;
            }
            stepIndex = 2;
            render();
          }
        }, ["I agree, continue"])
      ])
    ]);
  }

  function banksStep() {
    var grid = u.el("div", { class: "bank-grid" }, data.BANKS.map(function (bank) {
      var option = u.el("button", {
        type: "button",
        class: "bank-option" + (selectedBanks.indexOf(bank.id) > -1 ? " is-selected" : "")
      }, [
        u.el("div", { class: "account-logo" }, [bank.short]),
        u.el("span", {}, [bank.name])
      ]);
      option.addEventListener("click", function () {
        var idx = selectedBanks.indexOf(bank.id);
        if (idx > -1) selectedBanks.splice(idx, 1);
        else selectedBanks.push(bank.id);
        render();
      });
      return option;
    }));

    return u.el("div", {}, [
      u.el("h2", {}, ["Choose institutions to link"]),
      u.el("p", {}, ["Select every bank, MFB, or wallet you'd like FinanceHub to aggregate."]),
      grid,
      u.el("div", { style: "display:flex;gap:12px;margin-top:12px;" }, [
        u.el("button", { class: "btn btn-ghost", onClick: function () { stepIndex = 1; render(); } }, ["Back"]),
        u.el("button", {
          class: "btn btn-primary btn-block",
          disabled: selectedBanks.length === 0 ? "true" : null,
          onClick: function () {
            if (selectedBanks.length === 0) return;
            stepIndex = 3;
            render();
            runLinkingSimulation();
          }
        }, ["Link " + selectedBanks.length + " institution" + (selectedBanks.length === 1 ? "" : "s")])
      ])
    ]);
  }

  function linkingStep() {
    return u.el("div", { style: "text-align:center;padding:24px 0;" }, [
      u.el("div", { class: "brand-mark", style: "margin:0 auto 20px;" }, ["FH"]),
      u.el("h2", {}, ["Securely linking your accounts"]),
      u.el("p", { id: "linking-status" }, ["Connecting to " + selectedBanks.length + " institution(s)..."]),
      u.el("div", { class: "step-track" }, [u.el("div", { class: "step-dot is-active" })])
    ]);
  }

  function runLinkingSimulation() {
    window.setTimeout(function () {
      stepIndex = 4;
      store.completeOnboarding(selectedBanks);
      render();
    }, 1400);
  }

  function doneStep() {
    return u.el("div", { style: "text-align:center;padding:12px 0;" }, [
      u.el("div", { class: "icon-dot", style: "width:56px;height:56px;font-size:1.4rem;margin:0 auto 20px;" }, ["\u2713"]),
      u.el("h2", {}, ["You're all set"]),
      u.el("p", {}, ["Your accounts are linked. Explore your unified dashboard, transactions, and spending insights."]),
      u.el("button", {
        class: "btn btn-primary btn-block",
        onClick: function () { window.location.href = "index.html"; }
      }, ["Go to dashboard"])
    ]);
  }

  render();
})();
