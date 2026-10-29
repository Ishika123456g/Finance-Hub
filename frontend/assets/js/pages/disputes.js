/* Disputes page - list + raise-new-dispute modal */
(function () {
  var u = window.FH.utils;
  var store = window.FH.store;
  if (!u.requireConsent()) return;

  var content = window.FH.nav.renderShell({ active: "disputes", title: "Disputes", brandTag: "Aggregation + Payments", footerNote: "Demo data only. No live bank or payment integration." });
  var state = store.getState();
  var listWrap = u.el("div");

  function statusBadgeClass(status) {
    if (status === "resolved") return "badge-success";
    if (status === "in-review") return "badge-warning";
    return "badge-neutral";
  }

  function renderList() {
    state = store.getState();
    listWrap.innerHTML = "";
    if (!state.disputes.length) {
      listWrap.appendChild(u.el("div", { class: "empty-state" }, ["No disputes raised yet."]));
      return;
    }
    state.disputes.slice().reverse().forEach(function (d) {
      var tx = state.transactions.filter(function (t) { return t.id === d.transactionId; })[0];
      listWrap.appendChild(u.el("div", { class: "card", style: "margin-bottom:16px;" }, [
        u.el("div", { class: "card-header" }, [
          u.el("div", {}, [
            u.el("h3", {}, [tx ? tx.description : "Transaction"]),
            u.el("span", { class: "text-faint", style: "font-size:0.8rem;" }, ["Filed " + u.formatDate(d.createdAt)])
          ]),
          u.el("span", { class: "badge " + statusBadgeClass(d.status) }, [d.status.replace("-", " ")])
        ]),
        u.el("p", {}, [d.reason]),
        u.el("div", {}, d.updates.map(function (upd) {
          return u.el("div", { style: "font-size:0.82rem;color:var(--color-text-faint);padding:6px 0;border-top:1px solid var(--color-border);" }, [
            u.formatDate(upd.date, "short") + " \u2014 " + upd.note
          ]);
        }))
      ]));
    });
  }

  function openModal() {
    var backdrop = u.qs("#dispute-modal-backdrop");
    backdrop.hidden = false;
  }

  function closeModal() {
    var backdrop = u.qs("#dispute-modal-backdrop");
    backdrop.hidden = true;
  }

  function buildModal() {
    var txOptions = state.transactions.slice(0, 20).map(function (t) {
      return u.el("option", { value: t.id }, [t.description + " \u2022 " + u.formatDate(t.date, "short")]);
    });

    var txSelect = u.el("select", { id: "dispute-tx" }, txOptions);
    var reasonInput = u.el("textarea", { id: "dispute-reason", rows: "3", placeholder: "Describe the issue with this transaction" });

    var backdrop = u.el("div", { class: "modal-backdrop", id: "dispute-modal-backdrop", hidden: "true" }, [
      u.el("div", { class: "modal" }, [
        u.el("div", { class: "modal-header" }, [
          u.el("h3", {}, ["Raise a dispute"]),
          u.el("button", { class: "modal-close", onClick: closeModal }, ["\u2715"])
        ]),
        u.el("div", { class: "field" }, [u.el("label", {}, ["Transaction"]), txSelect]),
        u.el("div", { class: "field" }, [u.el("label", {}, ["Reason"]), reasonInput]),
        u.el("div", { style: "display:flex;gap:12px;" }, [
          u.el("button", { class: "btn btn-ghost", onClick: closeModal }, ["Cancel"]),
          u.el("button", {
            class: "btn btn-primary btn-block",
            onClick: function () {
              var reason = reasonInput.value.trim();
              if (!reason) { alert("Please describe the issue."); return; }
              store.addDispute({
                id: u.uid("dsp"),
                transactionId: txSelect.value,
                reason: reason,
                status: "in-review",
                createdAt: new Date().toISOString(),
                updates: [{ date: new Date().toISOString(), note: "Dispute submitted to FinanceHub support." }]
              });
              closeModal();
              renderList();
            }
          }, ["Submit dispute"])
        ])
      ])
    ]);
    document.body.appendChild(backdrop);
  }

  content.appendChild(u.el("div", { class: "page-header" }, [
    u.el("div", {}, [
      u.el("h2", {}, ["Disputes"]),
      u.el("p", {}, ["Track and raise disputes on transactions across linked accounts."])
    ]),
    u.el("button", { class: "btn btn-primary", onClick: openModal }, ["+ Raise a dispute"])
  ]));
  content.appendChild(listWrap);
  buildModal();
  renderList();
})();
