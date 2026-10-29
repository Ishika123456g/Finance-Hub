/* Shared utility helpers - classic script, exposes window.FH.utils */
(function () {
  window.FH = window.FH || {};

  function formatCurrency(amount, currency) {
    currency = currency || "NGN";
    var symbol = currency === "NGN" ? "\u20A6" : currency === "USD" ? "$" : currency === "GBP" ? "\u00A3" : currency + " ";
    var negative = amount < 0;
    var abs = Math.abs(amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (negative ? "-" : "") + symbol + abs;
  }

  function formatDate(isoString, style) {
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    if (style === "short") {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    }
    if (style === "time") {
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 10);
  }

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) return;
      if (key === "class") {
        node.className = value;
      } else if (key === "html") {
        node.innerHTML = value;
      } else if (key.indexOf("on") === 0 && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, value);
      }
    });
    (children || []).forEach(function (child) {
      if (typeof child === "string") {
        node.appendChild(document.createTextNode(child));
      } else if (child) {
        node.appendChild(child);
      }
    });
    return node;
  }

  function requireConsent(redirectTo) {
    var state = window.FH.store.getState();
    if (!state.onboardingComplete) {
      window.location.href = redirectTo || "onboarding.html";
      return false;
    }
    return true;
  }

  function initials(name) {
    return name
      .split(" ")
      .map(function (part) { return part.charAt(0); })
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  window.FH.utils = {
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    uid: uid,
    qs: qs,
    qsa: qsa,
    el: el,
    requireConsent: requireConsent,
    initials: initials
  };
})();
