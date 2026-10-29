(function () {
  var u = window.FH.utils;
  var f = window.FH.finance;
  var store = window.FH.store;
  if (!u.requireConsent()) return;
  var content = window.FH.nav.renderShell({ active: "investments", title: "Shareholdings & analysis",
    brandTag: "Aggregation + Payments", paymentDisclaimer: true,
    footerNote: "Demo / manually entered prices only. No live brokerage connection or trading." });
  var editingId = null;
  var editingSource = "Manual entry";
  var symbol = f.field("holding-symbol", "Share symbol", { required: true, maxlength: "20", placeholder: "DEMO" });
  var name = f.field("holding-name", "Company name", { required: true, maxlength: "100" });
  var units = f.field("holding-units", "Units held", { type: "number", min: "0.000001", max: "1000000000", step: "any", required: true });
  var cost = f.field("holding-cost", "Average purchase price (NGN)", { type: "number", min: "0.01", step: "0.01", required: true });
  var price = f.field("holding-price", "Current price (NGN)", { type: "number", min: "0.01", step: "0.01", required: true });
  var asOf = f.field("holding-date", "Current price date", { type: "date", max: f.dateOnly(new Date()), required: true, value: f.dateOnly(new Date()) });
  var references = {};
  var referenceFields = f.ANALYSIS_PERIODS.map(function (period) {
    references[period] = {
      price: f.field("reference-" + period + "-price", period + " reference price (NGN)", { type: "number", min: "0.01", step: "0.01" }),
      date: f.field("reference-" + period + "-date", period + " reference date", { type: "date" })
    };
    return u.el("div", { class: "field-row" }, [references[period].price.node, references[period].date.node]);
  });
  var saveButton = u.el("button", { type: "submit", class: "btn btn-primary" }, ["Save holding"]);
  var cancelButton = u.el("button", { type: "button", class: "btn btn-ghost", hidden: true, onClick: clearForm }, ["Cancel editing"]);
  var form = u.el("form", { class: "card", id: "holding-form", style: "margin-top:24px;" }, [
    u.el("h3", {}, ["Record holdings / update price snapshots"]),
    u.el("p", { class: "field-hint" }, ["Manual NGN entries only. Use a price and date from one day, week, calendar month or calendar year before the current price date. Leave a reference pair blank if unavailable. Month-end dates are clamped."]),
    u.el("div", { class: "field-row" }, [symbol.node, name.node]),
    u.el("div", { class: "field-row" }, [units.node, cost.node]),
    u.el("div", { class: "field-row" }, [price.node, asOf.node]),
    u.el("details", {}, [u.el("summary", {}, ["Reference prices for period analysis (optional)"])].concat(referenceFields)),
    u.el("div", { class: "feature-actions" }, [saveButton, cancelButton])
  ]);
  var period = f.field("analysis-period", "Analysis period", {}, f.ANALYSIS_PERIODS);
  period.control.value = store.getState().analysisPeriod;
  var results = u.el("div", { id: "portfolio-results", "aria-live": "polite" });
  var broker = u.el("div", { class: "card", id: "broker-link" });
  var message = u.el("p", { role: "status", "aria-live": "polite" });

  function clearForm() {
    editingId = null;
    editingSource = "Manual entry";
    form.reset();
    asOf.control.value = f.dateOnly(new Date());
    saveButton.textContent = "Save holding";
    cancelButton.hidden = true;
  }

  f.handleForm(form, function () {
    var history = {};
    f.ANALYSIS_PERIODS.forEach(function (key) {
      var entry = references[key];
      if (!entry.price.control.value && !entry.date.control.value) return;
      if (!entry.price.control.value || !entry.date.control.value) throw new Error("Provide both price and date for the " + key + " reference.");
      history[key] = { price: f.money(entry.price.control.value), date: entry.date.control.value };
    });
    store.saveHolding({ id: editingId || u.uid("holding"), symbol: symbol.control.value, name: name.control.value,
      units: units.control.value, cost: cost.control.value, price: price.control.value, asOf: asOf.control.value,
      references: history, source: editingSource });
    clearForm();
    render();
    message.textContent = "Holding saved locally. Analysis updated.";
  });
  period.control.addEventListener("change", function () {
    try { store.setState({ analysisPeriod: period.control.value }); render(); }
    catch (error) {
      period.control.value = store.getState().analysisPeriod;
      console.error(error);
      window.alert("Could not save analysis period: " + error.message);
    }
  });

  function editHolding(holding) {
    editingId = holding.id;
    editingSource = holding.source;
    symbol.control.value = holding.symbol;
    name.control.value = holding.name;
    units.control.value = holding.units;
    cost.control.value = holding.cost;
    price.control.value = holding.price;
    asOf.control.value = holding.asOf;
    f.ANALYSIS_PERIODS.forEach(function (key) {
      var entry = holding.references[key];
      references[key].price.control.value = entry ? entry.price : "";
      references[key].date.control.value = entry ? entry.date : "";
    });
    saveButton.textContent = "Update holding";
    cancelButton.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    symbol.control.focus();
  }

  function render() {
    var state = store.getState();
    var total = 0;
    var gain = 0;
    var rows = state.holdings.map(function (holding) {
      var analysis = f.analyze(holding, state.analysisPeriod);
      total += analysis.value;
      gain += analysis.gain;
      return u.el("tr", {}, [
        u.el("td", {}, [u.el("strong", {}, [holding.symbol]), u.el("div", { class: "field-hint" }, [holding.name + " - " + holding.source])]),
        u.el("td", {}, [String(holding.units)]),
        u.el("td", {}, [u.formatCurrency(analysis.value)]),
        u.el("td", { class: analysis.gain >= 0 ? "amount-positive" : "amount-negative" }, [u.formatCurrency(analysis.gain)]),
        u.el("td", {}, [analysis.change === null ? "Unavailable" : (analysis.change >= 0 ? "+" : "") + analysis.change.toFixed(2) + "%"]),
        u.el("td", {}, [u.el("strong", {}, [analysis.signal]), u.el("div", { class: "field-hint" }, [analysis.reason]),
          u.el("div", { class: "field-hint" }, ["Price as of " + u.formatDate(holding.asOf)])]),
        u.el("td", {}, [u.el("button", { class: "btn btn-ghost btn-sm", onClick: function () { editHolding(holding); } }, ["Update prices / holding"])])
      ]);
    });
    results.replaceChildren(u.el("div", { class: "card" }, [
      u.el("h3", {}, ["Portfolio snapshot: " + u.formatCurrency(total)]),
      u.el("p", {}, ["Unrealised gain / loss: " + u.formatCurrency(gain) + ". Uses entered prices; excludes dividends, fees and taxes. Stale prices remain in valuation but have no action signal."]),
      f.table(["Holding", "Units", "Value", "Gain / loss", state.analysisPeriod + " change", "Illustrative signal", "Action"], rows)
    ]));
    broker.replaceChildren(u.el("h3", {}, [state.portfolioLinked ? "Demo brokerage linked" : "Link a demo shareholding portfolio"]),
      u.el("p", {}, ["This consent-based demo imports a fictional shareholding into this browser only. No credentials are requested, no broker is contacted, and no live holdings are imported."]));
    if (state.portfolioLinked) {
      broker.appendChild(u.el("button", { class: "btn btn-ghost", onClick: function () {
        if (!window.confirm("Disconnect the demo brokerage and remove its imported holdings? Manual entries will remain.")) return;
        try { store.unlinkDemoPortfolio(); clearForm(); render(); }
        catch (error) { console.error(error); window.alert(error.message); }
      } }, ["Disconnect demo brokerage"]));
    } else {
      var consent = u.el("input", { type: "checkbox", id: "broker-consent", required: true });
      var linkForm = u.el("form", {}, [
        u.el("label", { class: "checkbox-row", for: "broker-consent" }, [consent, "I consent to importing fictional demo holdings locally."]),
        u.el("button", { type: "submit", class: "btn btn-secondary", style: "margin-top:12px;" }, ["Link demo brokerage"])
      ]);
      f.handleForm(linkForm, function () {
        if (!consent.checked) throw new Error("Consent is required to link the demo portfolio.");
        store.linkDemoPortfolio();
        render();
      });
      broker.appendChild(linkForm);
    }
  }

  content.appendChild(u.el("div", { class: "page-header" }, [u.el("div", {}, [
    u.el("h2", {}, ["Review your shareholdings"]),
    u.el("p", {}, ["Daily, weekly, monthly and annual price comparisons to support further research, not automatic trades."])
  ])]));
  content.appendChild(u.el("div", { class: "disclaimer-banner" }, [
    u.el("p", {}, ["Educational demo, not personalised financial advice. Illustrative price-only rules: +5% or more = consider investing; -5% or less = review selling; otherwise hold / monitor. These are not predictions or reliable buy/sell recommendations. Consider valuation, diversification, liquidity, your goals and a qualified adviser."])
  ]));
  content.appendChild(broker);
  content.appendChild(period.node);
  content.appendChild(message);
  content.appendChild(results);
  content.appendChild(form);
  render();
  window.setInterval(render, 60000);
})();
