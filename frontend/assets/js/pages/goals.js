(function () {
  var u = window.FH.utils;
  var f = window.FH.finance;
  var store = window.FH.store;
  if (!u.requireConsent()) return;
  var content = window.FH.nav.renderShell({ active: "goals", title: "Savings goals",
    brandTag: "Aggregation + Payments", paymentDisclaimer: true,
    footerNote: "Local demo savings pots. No real savings account, interest or automatic transfers." });
  var name = f.field("goal-name", "Goal name", { required: true, maxlength: "100", placeholder: "My new car" });
  var category = f.field("goal-category", "Goal type", {}, ["New car", "Rent", "Cash reserve", "New building", "Custom goal"]);
  var target = f.field("goal-target", "Target amount (NGN)", { type: "number", min: "0.01", step: "0.01", required: true });
  var date = f.field("goal-date", "Target date", { type: "date", min: f.dateOnly(new Date()), required: true });
  var frequency = f.field("goal-frequency", "Contribution plan", {}, f.PERIODS);
  var list = u.el("div", { class: "grid grid-cols-2", id: "goal-list" });
  var form = u.el("form", { class: "card", style: "margin-bottom:24px;" }, [
    u.el("h3", {}, ["Create a savings goal"]),
    u.el("div", { class: "field-row" }, [name.node, category.node]),
    u.el("div", { class: "field-row" }, [target.node, date.node]), frequency.node,
    u.el("button", { type: "submit", class: "btn btn-primary" }, ["Create goal"])
  ]);
  f.handleForm(form, function () {
    store.addGoal({ id: u.uid("goal"), name: name.control.value, category: category.control.value,
      target: target.control.value, targetDate: date.control.value, frequency: frequency.control.value });
    form.reset();
    render();
  });

  function render() {
    var state = store.getState();
    list.replaceChildren();
    if (!state.goals.length) list.appendChild(u.el("p", {}, ["No goals yet. Create your first goal above."]));
    state.goals.forEach(function (goal) {
      var plan = f.goalPlan(goal);
      var account = f.field("goal-account-" + goal.id, "Fund from a linked NGN account", { required: true },
        f.linkedAccounts(state).map(function (item) { return { value: item.id, label: item.nickname + " - " + u.formatCurrency(item.balance) }; }));
      var amount = f.field("goal-contribution-" + goal.id, "Simulated contribution (NGN)", {
        type: "number", min: "0.01", max: String(plan.remaining), step: "0.01", required: true, disabled: plan.remaining === 0
      });
      var contributeForm = u.el("form", {}, [account.node, amount.node,
        u.el("button", { type: "submit", class: "btn btn-secondary", disabled: plan.remaining === 0 || !account.control.options.length },
          [plan.remaining === 0 ? "Goal achieved" : "Review simulated contribution"])]);
      f.handleForm(contributeForm, function () {
        var value = f.money(amount.control.value);
        if (!window.confirm("Simulate moving " + u.formatCurrency(value) + " from this account into " + goal.name +
          "? Demo balances will change; no real funds move.")) return;
        store.contribute(goal.id, account.control.value, value);
        render();
      });
      list.appendChild(u.el("div", { class: "card" }, [
        u.el("h3", {}, [goal.name]), u.el("p", { class: "field-hint" }, [goal.category + " - due " + u.formatDate(goal.targetDate)]),
        u.el("p", {}, [u.formatCurrency(goal.saved) + " saved of " + u.formatCurrency(goal.target)]),
        u.el("progress", { class: "goal-progress", value: String(plan.progress), max: "100", "aria-label": goal.name + " savings progress" }),
        u.el("p", {}, [plan.remaining === 0 ? "Target reached." : plan.contribution === null ?
          "Target date has passed. Remaining: " + u.formatCurrency(plan.remaining) :
          "Suggested " + goal.frequency + " contribution: " + u.formatCurrency(plan.contribution) +
          " across " + plan.periods + " contributions, starting today."]),
        contributeForm,
        u.el("details", {}, [
          u.el("summary", {}, ["Contribution history (" + goal.contributions.length + ")"]),
          f.table(["Date", "Account", "Amount"], goal.contributions.map(function (item) {
            var source = state.accounts.find(function (entry) { return entry.id === item.accountId; });
            return u.el("tr", {}, [u.el("td", {}, [u.formatDate(item.createdAt)]),
              u.el("td", {}, [source ? source.nickname : item.accountId]), u.el("td", {}, [u.formatCurrency(item.amount)])]);
          }))
        ])
      ]));
    });
  }

  content.appendChild(u.el("div", { class: "page-header" }, [u.el("div", {}, [
    u.el("h2", {}, ["Save towards what matters"]),
    u.el("p", {}, ["Car, rent, cash reserve, a building or your own goal. Contributions are manual simulations, not an automatic savings service."])
  ])]));
  content.appendChild(form);
  content.appendChild(list);
  render();
  window.addEventListener("focus", render);
})();
