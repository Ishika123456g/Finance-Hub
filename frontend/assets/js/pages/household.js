(function () {
  var u = window.FH.utils, f = window.FH.finance, smart = window.FH.smart, store = window.FH.store, data = window.FH.data;
  if (!u.requireConsent()) return;
  var content = window.FH.nav.renderShell({ active: "household", title: "Household",
    brandTag: "Shared planning", paymentDisclaimer: true,
    footerNote: "Local shared-planning demo. No invitations, permissions or payments are sent." });
  var root = u.el("div", { id: "household-root", "aria-live": "polite" });

  function field(id, label, attrs, options) { return f.field(id, label, attrs, options); }
  function memberOptions(state) { return state.household.members.map(function (member) { return { value: member.id, label: member.name + " \u2022 " + member.role }; }); }
  function accountOptions(state) { return f.linkedAccounts(state).map(function (account) { return { value: account.id, label: account.nickname + " \u2022 " + u.formatCurrency(account.balance) }; }); }

  function setup() {
    var name = field("household-name", "Household name", { required: true, maxlength: "100", placeholder: "Chukwu Family" });
    var form = u.el("form", { class: "card" }, [
      u.el("h3", {}, ["Create a local household space"]), name.node,
      u.el("p", { class: "field-hint" }, ["The current FinanceHub user becomes the organiser. No invitation or email is sent."]),
      u.el("button", { type: "submit", class: "btn btn-primary" }, ["Create household"])
    ]);
    f.handleForm(form, function () { store.createHousehold(name.control.value); render(); });
    return form;
  }

  function memberForm() {
    var name = field("member-name", "Name", { required: true, maxlength: "100" });
    var email = field("member-email", "Email (optional)", { type: "email", maxlength: "150" });
    var role = field("member-role", "Role", {}, ["contributor", "viewer", "organiser"]);
    var target = field("member-target", "Monthly contribution target (NGN)", { type: "number", min: "0", step: "0.01", value: "0" });
    var form = u.el("form", { class: "card" }, [u.el("h3", {}, ["Add member"]),
      u.el("div", { class: "field-row" }, [name.node, email.node]), u.el("div", { class: "field-row" }, [role.node, target.node]),
      u.el("button", { type: "submit", class: "btn btn-secondary" }, ["Add local member"])]);
    f.handleForm(form, function () {
      store.addHouseholdMember({ id: u.uid("member"), name: name.control.value, email: email.control.value,
        role: role.control.value, contributionTarget: target.control.value });
      render();
    });
    return form;
  }

  function budgetForm() {
    var category = field("budget-category", "Category", {}, data.CATEGORIES.map(function (item) { return { value: item.id, label: item.name }; }));
    var limit = field("budget-limit", "Monthly limit (NGN)", { type: "number", min: "0.01", step: "0.01", required: true });
    var form = u.el("form", { class: "card" }, [u.el("h3", {}, ["Add shared budget"]),
      u.el("div", { class: "field-row" }, [category.node, limit.node]),
      u.el("button", { type: "submit", class: "btn btn-secondary" }, ["Add budget"])]);
    f.handleForm(form, function () {
      store.addHouseholdBudget({ id: u.uid("budget"), category: category.control.value, limit: limit.control.value });
      render();
    });
    return form;
  }

  function goalForm() {
    var name = field("shared-goal-name", "Shared goal", { required: true, maxlength: "100" });
    var target = field("shared-goal-target", "Target (NGN)", { type: "number", min: "0.01", step: "0.01", required: true });
    var date = field("shared-goal-date", "Target date", { type: "date", min: f.dateOnly(new Date()), required: true });
    var frequency = field("shared-goal-frequency", "Plan", {}, f.PERIODS);
    var form = u.el("form", { class: "card" }, [u.el("h3", {}, ["Create shared goal"]),
      u.el("div", { class: "field-row" }, [name.node, target.node]), u.el("div", { class: "field-row" }, [date.node, frequency.node]),
      u.el("button", { type: "submit", class: "btn btn-secondary" }, ["Create shared goal"])]);
    f.handleForm(form, function () {
      store.addGoal({ id: u.uid("goal"), name: name.control.value, category: "Household", target: target.control.value,
        targetDate: date.control.value, frequency: frequency.control.value, scope: "household" });
      render();
    });
    return form;
  }

  function requestForm(state) {
    var requester = field("request-member", "Requester", {}, memberOptions(state));
    var description = field("request-description", "What is needed?", { required: true, maxlength: "150" });
    var amount = field("request-amount", "Amount (NGN)", { type: "number", min: "0.01", step: "0.01", required: true });
    var category = field("request-category", "Category", {}, data.CATEGORIES.map(function (item) { return { value: item.id, label: item.name }; }));
    var form = u.el("form", { class: "card" }, [u.el("h3", {}, ["Request household approval"]),
      requester.node, description.node, u.el("div", { class: "field-row" }, [amount.node, category.node]),
      u.el("button", { type: "submit", class: "btn btn-secondary", disabled: !state.household.members.length }, ["Submit request"])]);
    f.handleForm(form, function () {
      store.addHouseholdRequest({ id: u.uid("request"), requesterId: requester.control.value,
        description: description.control.value, amount: amount.control.value, category: category.control.value });
      render();
    });
    return form;
  }

  function sharedGoalCards(state) {
    return state.goals.filter(function (goal) { return goal.scope === "household"; }).map(function (goal) {
      var plan = f.goalPlan(goal);
      var member = field("goal-member-" + goal.id, "Contributing member", {}, memberOptions(state));
      var account = field("goal-account-" + goal.id, "Source account", {}, accountOptions(state));
      var amount = field("goal-amount-" + goal.id, "Amount (NGN)", { type: "number", min: "0.01", max: String(plan.remaining), step: "0.01" });
      var form = u.el("form", {}, [member.node, account.node, amount.node,
        u.el("button", { type: "submit", class: "btn btn-ghost btn-sm", disabled: !plan.remaining }, [plan.remaining ? "Simulate contribution" : "Goal achieved"])]);
      f.handleForm(form, function () {
        var value = f.money(amount.control.value);
        if (!window.confirm("Simulate this household contribution? The selected demo account will be debited.")) return;
        store.contribute(goal.id, account.control.value, value, member.control.value);
        render();
      });
      return u.el("div", { class: "card" }, [u.el("h3", {}, [goal.name]),
        u.el("p", {}, [u.formatCurrency(goal.saved) + " of " + u.formatCurrency(goal.target)]),
        u.el("progress", { class: "goal-progress", value: String(plan.progress), max: "100", "aria-label": goal.name + " shared goal progress" }),
        u.el("p", { class: "field-hint" }, ["Due " + u.formatDate(goal.targetDate) + " \u2022 " + goal.frequency + " plan"]),
        form]);
    });
  }

  function decide(id, decision) {
    try { store.decideHouseholdRequest(id, decision); render(); }
    catch (error) { console.error(error); window.alert(error.message); }
  }

  function render() {
    var state = store.getState();
    root.replaceChildren();
    if (!state.household.enabled) {
      root.appendChild(setup());
      return;
    }
    var budgets = smart.householdBudget(state);
    root.appendChild(u.el("div", { class: "page-header" }, [u.el("div", {}, [
      u.el("h2", {}, [state.household.name]), u.el("p", {}, ["Shared plans and approvals in this browser only. Roles are labels; this demo has no separate logins or enforced permissions."])
    ])]));
    root.appendChild(u.el("div", { class: "grid grid-cols-4", style: "margin-bottom:24px;" }, [
      stat("Members", state.household.members.length), stat("Shared budgets", state.household.budgets.length),
      stat("Shared goals", state.goals.filter(function (goal) { return goal.scope === "household"; }).length),
      stat("Pending approvals", state.household.requests.filter(function (request) { return request.status === "pending"; }).length)
    ]));
    root.appendChild(u.el("div", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [memberForm(), budgetForm()]));
    root.appendChild(u.el("div", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [goalForm(), requestForm(state)]));
    root.appendChild(u.el("section", { class: "card card-flush", style: "margin-bottom:24px;" }, [
      u.el("div", { class: "report-card-title" }, ["Members"]),
      f.table(["Name", "Role", "Email", "Monthly target"], state.household.members.map(function (member) {
        return u.el("tr", {}, [u.el("td", {}, [member.name]), u.el("td", {}, [member.role]),
          u.el("td", {}, [member.email || "\u2014"]), u.el("td", {}, [u.formatCurrency(member.contributionTarget)])]);
      }))
    ]));
    root.appendChild(u.el("section", { class: "card card-flush", style: "margin-bottom:24px;" }, [
      u.el("div", { class: "report-card-title" }, ["Monthly shared budgets \u2022 all linked NGN account spending"]),
      f.table(["Category", "Limit", "Actual", "Remaining", "Status"], budgets.map(function (item) {
        var category = data.CATEGORIES.find(function (entry) { return entry.id === item.budget.category; });
        return u.el("tr", {}, [u.el("td", {}, [category ? category.name : item.budget.category]),
          u.el("td", {}, [u.formatCurrency(item.budget.limit)]), u.el("td", {}, [u.formatCurrency(item.actual)]),
          u.el("td", { class: item.remaining >= 0 ? "amount-positive" : "amount-negative" }, [u.formatCurrency(item.remaining)]),
          u.el("td", {}, [item.status])]);
      }))
    ]));
    root.appendChild(u.el("section", { style: "margin-bottom:24px;" }, [
      u.el("h2", {}, ["Shared goals"]),
      u.el("div", { class: "grid grid-cols-2" }, sharedGoalCards(state))
    ]));
    root.appendChild(u.el("section", { class: "card card-flush" }, [
      u.el("div", { class: "report-card-title" }, ["Approval requests \u2022 approval does not move money"]),
      f.table(["Request", "Requester", "Category", "Amount", "Status / action"], state.household.requests.slice().reverse().map(function (request) {
        var member = state.household.members.find(function (item) { return item.id === request.requesterId; });
        return u.el("tr", {}, [u.el("td", {}, [request.description]), u.el("td", {}, [member ? member.name : "Unknown"]),
          u.el("td", {}, [request.category]), u.el("td", {}, [u.formatCurrency(request.amount)]),
          u.el("td", {}, [request.status === "pending" ? u.el("div", { class: "feature-actions" }, [
            u.el("button", { class: "btn btn-secondary btn-sm", onClick: function () { decide(request.id, "approved"); } }, ["Approve"]),
            u.el("button", { class: "btn btn-ghost btn-sm", onClick: function () { decide(request.id, "rejected"); } }, ["Reject"])
          ]) : request.status])]);
      }))
    ]));
  }

  function stat(label, value) {
    return u.el("div", { class: "card stat-card" }, [u.el("span", { class: "stat-label" }, [label]), u.el("span", { class: "stat-value" }, [String(value)])]);
  }
  content.appendChild(u.el("div", { class: "disclaimer-banner" }, [
    u.el("span", {}, ["Household data, roles, approvals and contributions are local simulations. No email invite, identity verification, permission enforcement or payment occurs."])
  ]));
  content.appendChild(root);
  render();
})();
