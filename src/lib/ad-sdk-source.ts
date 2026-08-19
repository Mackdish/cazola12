/**
 * Source of the publisher embed SDK, served verbatim from /ad/loader.js.
 *
 * It is a string rather than a bundled module on purpose: nothing from the
 * dashboard bundle can ever leak into the publisher page, and the file stays a
 * couple of kilobytes. It renders with DOM APIs only — no innerHTML, no eval,
 * no document.write — and every failure path is swallowed so a broken ad can
 * never break the host site.
 */
export const AD_SDK_SOURCE = String.raw`(function () {
  "use strict";
  var SELECTOR = "[data-trademall-zone]";
  var ATTR_DONE = "data-trademall-filled";
  var KEY_RE = /^[A-Za-z0-9_-]{4,64}$/;

  var origin = (function () {
    try {
      var current = document.currentScript && document.currentScript.src;
      if (current) return new URL(current, window.location.href).origin;
    } catch (e) {}
    return "__ORIGIN__";
  })();

  var apiOrigin = "__API_ORIGIN__";

  function px(value) {
    var n = parseInt(value, 10);
    return isFinite(n) && n > 0 && n < 4000 ? n : null;
  }

  function safeUrl(value, allowedOrigin) {
    try {
      var parsed = new URL(String(value), origin);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      if (allowedOrigin && parsed.origin !== allowedOrigin) return null;
      return parsed.href;
    } catch (e) {
      return null;
    }
  }

  function sendImpression(url, token) {
    var body = JSON.stringify({ token: token });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch (e) {}
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        mode: "cors",
      }).catch(function () {});
    } catch (e) {}
  }

  function render(slot, payload) {
    var ad = payload.ad || {};
    var image = safeUrl(ad.imageUrl, false);
    var click = safeUrl(ad.clickUrl, apiOrigin);
    if (!image || !click) return false;

    slot.style.position = "relative";

    var link = document.createElement("a");
    link.setAttribute("href", click);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer nofollow sponsored");
    link.style.display = "block";
    link.style.lineHeight = "0";

    var img = document.createElement("img");
    img.setAttribute("src", image);
    img.setAttribute("alt", typeof ad.alt === "string" ? ad.alt : "Advertisement");
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    var w = px(ad.width);
    var h = px(ad.height);
    if (w) img.setAttribute("width", String(w));
    if (h) img.setAttribute("height", String(h));
    img.style.display = "block";
    img.style.maxWidth = "100%";
    img.style.border = "0";

    link.appendChild(img);
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    slot.appendChild(link);
    slot.setAttribute(ATTR_DONE, "1");

    var menuBtn = document.createElement("button");
    menuBtn.textContent = "⋯";
    menuBtn.setAttribute("aria-label", "Ad options");
    menuBtn.style.cssText = "position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:3px;padding:2px 6px;font-size:12px;cursor:pointer;line-height:1;z-index:10;";
    slot.appendChild(menuBtn);

    var menu = document.createElement("div");
    menu.style.cssText = "display:none;position:absolute;top:24px;right:2px;background:#fff;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:20;min-width:180px;font-family:sans-serif;font-size:13px;";
    var items = [
      { label: "Why am I seeing this ad?", action: "why" },
      { label: "Report this ad", action: "report" },
      { label: "Hide this ad", action: "hide" },
    ];
    items.forEach(function (item) {
      var row = document.createElement("div");
      row.textContent = item.label;
      row.style.cssText = "padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;";
      row.addEventListener("mouseenter", function () { row.style.background = "#f5f5f5"; });
      row.addEventListener("mouseleave", function () { row.style.background = "#fff"; });
      row.addEventListener("click", function () {
        menu.style.display = "none";
        if (item.action === "hide") {
          slot.style.display = "none";
        } else if (item.action === "why") {
          alert("This ad is shown based on your browsing activity and the website's content.");
        } else if (item.action === "report") {
          var reason = prompt("Why are you reporting this ad?\n1. Inappropriate\n2. Misleading\n3. Malicious\n4. Repetitive\n5. Other");
          if (reason) {
            var payloadReport = {
              organizationId: ad.organizationId || "",
              adId: ad.id || payload.ad && payload.ad.id || "",
              campaignId: ad.campaignId || "",
              websiteId: slot.getAttribute("data-trademall-zone") ? "" : "",
              adZoneId: slot.getAttribute("data-trademall-zone") || "",
              reason: ["inappropriate", "misleading", "malicious", "repetitive", "other"][parseInt(reason, 10) - 1] || "other",
              description: reason,
              reporterIp: "",
              userAgent: navigator.userAgent,
            };
            if (payloadReport.adId && payloadReport.adZoneId) {
              fetch(apiOrigin + "/api/public/ad-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payloadReport),
                mode: "cors",
              }).catch(function () {});
            }
            alert("Thank you for reporting this ad.");
          }
        }
      });
      menu.appendChild(row);
    });
    slot.appendChild(menu);

    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    });

    document.addEventListener("click", function (e) {
      if (!slot.contains(e.target)) menu.style.display = "none";
    });

    var impressionUrl = safeUrl(payload.impressionUrl, apiOrigin);
    if (impressionUrl && typeof payload.token === "string") {
      var fire = function () {
        sendImpression(impressionUrl, payload.token);
      };
      if (typeof window.IntersectionObserver === "function") {
        var observer = new window.IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
              observer.disconnect();
              fire();
              return;
            }
          }
        });
        observer.observe(slot);
      } else {
        fire();
      }
    }
    return true;
  }

  function empty(slot) {
    slot.setAttribute(ATTR_DONE, "empty");
    slot.style.display = "none";
    var event;
    try {
      event = new CustomEvent("trademall:empty", { detail: { zone: slot.getAttribute("data-trademall-zone") } });
      slot.dispatchEvent(event);
    } catch (e) {}
  }

  function fill(slot) {
    if (slot.getAttribute(ATTR_DONE)) return;
    var zone = slot.getAttribute("data-trademall-zone");
    if (!zone || !KEY_RE.test(zone)) return;
    slot.setAttribute(ATTR_DONE, "pending");

    var url = apiOrigin + "/api/public/ad?zone=" + encodeURIComponent(zone);
    fetch(url, { method: "GET", credentials: "omit", mode: "cors" })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (payload) {
        if (!payload || payload.ok !== true) {
          empty(slot);
          return;
        }
        if (!render(slot, payload)) empty(slot);
      })
      .catch(function () {
        empty(slot);
      });
  }

  function scan() {
    try {
      var slots = document.querySelectorAll(SELECTOR);
      for (var i = 0; i < slots.length; i++) fill(slots[i]);
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  window.TradeMall = window.TradeMall || { refresh: scan };
})();
`;
