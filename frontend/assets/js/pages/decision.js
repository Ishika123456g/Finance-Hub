(function () {
  var u = window.FH.utils, f = window.FH.finance, smart = window.FH.smart, store = window.FH.store;
  if (!u.requireConsent()) return;
  var content = window.FH.nav.renderShell({ active: "decision", title: "Decision Lab",
    brandTag: "Smart finance", paymentDisclaimer: true,
    footerNote: "Explainable planning only. Forecasts use local demo data and user-entered scenarios." });
  var horizon = f.field("decision-horizon", "Planning horizon", {}, smart.HORIZONS);
  horizon.control.value = "monthly";
  var income = f.field("scenario-income", "Expected additional income (NGN)", { type: "number", min: "0", step: "0.01", value: "0" });
  var purchase = f.field("scenario-purchase", "Planned purchase / extra spending (NGN)", { type: "number", min: "0", step: "0.01", value: "0" });
  var extraGoal = f.field("scenario-goal", "Extra goal contribution (NGN)", { type: "number", min: "0", step: "0.01", value: "0" });
  var reserve = f.field("scenario-reserve", "Cash reserve to protect (NGN)", { type: "number", min: "0", step: "0.01", value: "0" });
  var output = u.el("div", { id: "decision-output", "aria-live": "polite" });
  var form = u.el("form", { class: "card", style: "margin-bottom:24px;" }, [
    u.el("div", { class: "card-header" }, [u.el("h3", {}, ["What-if simulator"])]),
    u.el("p", { class: "field-hint" }, ["Future income is excluded unless you enter it. The simulation does not change any account or goal."]),
    u.el("div", { class: "report-filter-grid" }, [horizon.node, income.node, purchase.node]),
    u.el("div", { class: "field-row" }, [extraGoal.node, reserve.node]),
    u.el("button", { type: "submit", class: "btn btn-primary" }, ["Run scenario"])
  ]);

  function scoreComponent(item) {
    return u.el("div", { class: "score-component" }, [
      u.el("div", {}, [u.el("strong", {}, [item.name]), u.el("span", {}, [item.score + " / " + item.maximum])]),
      u.el("progress", { value: String(item.score), max: String(item.maximum), "aria-label": item.name + " score" }),
      u.el("span", { class: "field-hint" }, [item.note])
    ]);
  }

  function render() {
    try {
      var result = smart.decision(store.getState(), { horizon: horizon.control.value, expectedIncome: income.control.value,
        plannedPurchase: purchase.control.value, extraGoal: extraGoal.control.value, reserve: reserve.control.value });
      var calendar = smart.calendar(store.getState(), result.horizon, result.today);
      output.replaceChildren(
        u.el("section", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [
          u.el("div", { class: "card decision-hero" }, [
            u.el("div", { class: "score-ring", style: "--score:" + result.health.score + ";" }, [
              u.el("strong", {}, [String(result.health.score)]), u.el("span", {}, ["/ 100"])
            ]),
            u.el("div", {}, [
              u.el("span", { class: "badge badge-info" }, ["Financial resilience: " + result.health.grade]),
              u.el("h2", {}, ["Explainable financial resilience"]),
              u.el("p", {}, ["An educational planning score based on liquidity, bill readiness, cash flow, savings momentum and available data. It is not a credit score."])
            ])
          ]),
          u.el("div", { class: "card stat-card" }, [
            u.el("span", { class: "stat-label" }, ["Projected safe-to-spend"]),
            u.el("span", { class: "stat-value " + (result.safeToSpend >= 0 ? "amount-positive" : "amount-negative") },
              [u.formatCurrency(result.safeToSpend)]),
            u.el("span", {}, ["Through " + u.formatDate(result.end)]),
            u.el("span", { class: "field-hint" }, ["Available funds + entered income − bills − planned goal commitments − scenario spending − protected reserve."])
          ])
        ]),
        u.el("section", { class: "grid grid-cols-2", style: "margin-bottom:24px;" }, [
          u.el("div", { class: "card" }, [
            u.el("h3", {}, ["Score breakdown"])
          ].concat(result.health.components.map(scoreComponent))),
          u.el("div", { class: "card" }, [
            u.el("h3", {}, ["Forecast breakdown"]),
            f.table(["Component", "Amount"], [
              ["Available after pending debits", result.available],
              ["Expected additional income", result.expectedIncome],
              ["Pending bills", -result.bills],
              ["Planned goal commitments", -result.goalCommitments],
              ["Planned purchase", -result.plannedPurchase],
              ["Extra goal contribution", -result.extraGoal],
              ["Protected reserve", -result.reserve]
            ].map(function (row) {
              return u.el("tr", {}, [u.el("td", {}, [row[0]]), u.el("td", { class: row[1] >= 0 ? "amount-positive" : "amount-negative" },
                [u.formatCurrency(row[1])])]);
            }))
          ])
        ]),
        u.el("section", { class: "card", style: "margin-bottom:24px;" }, [
          u.el("h3", {}, ["Prioritised action plan"]),
          u.el("div", { class: "action-list" }, result.actions.map(function (action) {
            return u.el("div", { class: "action-item" }, [
              u.el("span", { class: "badge " + (action.priority === "High" ? "badge-warning" : "badge-info") }, [action.priority]),
              u.el("div", {}, [u.el("strong", {}, [action.title]), u.el("p", {}, [action.detail])])
            ]);
          }))
        ]),
        u.el("section", { class: "card card-flush" }, [
          u.el("div", { class: "report-card-title" }, ["Money calendar through " + u.formatDate(result.end)]),
          f.table(["Date", "Type", "Item", "Amount / gap", "Note"], calendar.map(function (event) {
            return u.el("tr", {}, [u.el("td", {}, [u.formatDate(event.date)]), u.el("td", {}, [event.type]),
              u.el("td", {}, [event.title]), u.el("td", {}, [u.formatCurrency(event.amount)]), u.el("td", {}, [event.note])]);
          }))
        ])
      );
    } catch (error) {
      console.error("Decision Lab failed:", error);
      window.alert(error.message);
    }
  }
  f.handleForm(form, render);
  horizon.control.addEventListener("change", render);
  content.appendChild(u.el("div", { class: "page-header" }, [u.el("div", {}, [
    u.el("h2", {}, ["Turn financial data into next actions"]),
    u.el("p", {}, ["Test decisions without changing balances, see an explainable resilience score and review upcoming money events."])
  ])]));
  content.appendChild(form);
  content.appendChild(output);
  render();
})();
