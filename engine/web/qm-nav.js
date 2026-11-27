/* Quince Matrix: one menu on every page (Shop, Dashboard, Production Update, Fabric Reco).
   A slim bar at the top with a hamburger button; the menu slides in from the left. */
(function () {
  "use strict";
  if (window.__qmNav) return; window.__qmNav = true;
  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (here === "") here = "index.html";
  var LINKS = [
    { href: "shop.html", label: "Shop", sub: "Racks, stock and products", icon: "M4 10h16M4 16h16M6 10V6h12v4M6 16v4h12v-4" },
    { href: "./", file: "index.html", label: "Dashboard", sub: "Shop stock, PO ledger, analytics, activity", icon: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 7h6V4h-6z" },
    { href: "production.html", label: "Production Update", sub: "Enter cutting and packing", icon: "M6 6a3 3 0 1 0 0 .01M6 18a3 3 0 1 0 0 .01M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" },
    { href: "fabric.html", label: "Fabric Reco", sub: "Inward, used and balance fabric", icon: "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2zM4 6v12c0 1.1 3.6 2 8 2s8-.9 8-2V6M4 12c0 1.1 3.6 2 8 2s8-.9 8-2" }
  ];
  function isHere(l) { var f = (l.file || l.href).toLowerCase(); return f === here; }
  var cur = LINKS.filter(isHere)[0] || LINKS[1];
  var dark = /production|fabric/.test(here);
  var css = document.createElement("style");
  css.textContent =
    ".qmn-bar{position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:10px;padding:8px max(12px,env(safe-area-inset-left,0px)) 8px 12px;" +
    (dark ? "background:rgba(14,19,17,.88);color:#e8eeea;border-bottom:1px solid rgba(255,255,255,.08);" : "background:rgba(251,248,243,.9);color:#2b2622;border-bottom:1px solid #e3dacd;") +
    "backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:500 14px/1.2 'DM Sans','IBM Plex Sans',system-ui,sans-serif}" +
    ".qmn-btn{width:40px;height:40px;border-radius:12px;border:1px solid " + (dark ? "rgba(255,255,255,.14)" : "#e3dacd") + ";background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}" +
    ".qmn-btn:hover,.qmn-btn:focus-visible{border-color:#b9875a;outline:none}" +
    ".qmn-btn span,.qmn-btn span::before,.qmn-btn span::after{display:block;width:18px;height:2px;border-radius:2px;background:currentColor;position:relative;transition:transform .25s}" +
    ".qmn-btn span::before,.qmn-btn span::after{content:'';position:absolute;left:0}.qmn-btn span::before{top:-6px}.qmn-btn span::after{top:6px}" +
    ".qmn-t{display:flex;flex-direction:column}.qmn-t b{font-weight:600;font-size:15px}.qmn-t small{opacity:.65;font-size:12px}" +
    ".qmn-quick{margin-left:auto;display:flex;gap:6px}.qmn-quick a{text-decoration:none;color:inherit;font-size:13px;padding:8px 12px;border-radius:999px;border:1px solid " + (dark ? "rgba(255,255,255,.14)" : "#e3dacd") + "}" +
    ".qmn-quick a[aria-current=page]{background:" + (dark ? "#e8eeea;color:#0e1311" : "#2b2622;color:#fbf8f3") + ";border-color:transparent}" +
    "@media(max-width:760px){.qmn-quick{display:none}}" +
    ".qmn-scrim{position:fixed;inset:0;z-index:70;background:rgba(20,14,8,.42);opacity:0;pointer-events:none;transition:opacity .25s}" +
    ".qmn-panel{position:fixed;top:0;bottom:0;left:0;z-index:71;width:min(320px,86vw);background:#fbf8f3;color:#2b2622;box-shadow:20px 0 60px rgba(0,0,0,.25);transform:translateX(-105%);transition:transform .3s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;padding:18px 14px;font:15px/1.4 'DM Sans',system-ui,sans-serif}" +
    ".qmn-open .qmn-scrim{opacity:1;pointer-events:auto}.qmn-open .qmn-panel{transform:none}" +
    ".qmn-head{display:flex;align-items:center;gap:10px;margin:0 4px 16px}.qmn-head i{width:34px;height:34px;border-radius:10px;background:#2b2622;color:#fbf8f3;display:grid;place-items:center;font-style:normal;font-family:Georgia,serif;font-size:18px}" +
    ".qmn-head b{font-size:17px}.qmn-head small{display:block;color:#8a8178;font-size:12px}.qmn-x{margin-left:auto;width:40px;height:40px;border:0;background:none;font-size:24px;cursor:pointer;color:#5d554d}" +
    ".qmn-panel a.qmn-l{display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;padding:12px;border-radius:14px;margin-bottom:4px;min-height:56px}" +
    ".qmn-panel a.qmn-l:hover,.qmn-panel a.qmn-l:focus-visible{background:#f0e8dc;outline:none}" +
    ".qmn-panel a.qmn-l[aria-current=page]{background:#2b2622;color:#fbf8f3}.qmn-panel a.qmn-l[aria-current=page] small{color:#cfc5b8}" +
    ".qmn-panel svg{width:22px;height:22px;flex:none}.qmn-panel small{display:block;color:#8a8178;font-size:12.5px}" +
    ".qmn-foot{margin-top:auto;color:#8a8178;font-size:12px;padding:8px}" +
    "@media(prefers-reduced-motion:reduce){.qmn-panel,.qmn-scrim{transition:none}}";
  document.head.appendChild(css);
  function svg(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var bar = document.createElement("div"); bar.className = "qmn-bar";
  bar.innerHTML = '<button class="qmn-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="qmn-panel"><span></span></button>' +
    '<div class="qmn-t"><b>Quince Matrix</b><small>' + cur.label + '</small></div>' +
    '<nav class="qmn-quick" aria-label="Sections">' + LINKS.map(function (l) { return '<a href="' + l.href + '"' + (isHere(l) ? ' aria-current="page"' : '') + '>' + l.label + '</a>'; }).join("") + '</nav>';
  var scrim = document.createElement("div"); scrim.className = "qmn-scrim";
  var panel = document.createElement("aside"); panel.className = "qmn-panel"; panel.id = "qmn-panel"; panel.setAttribute("aria-label", "Menu");
  panel.innerHTML = '<div class="qmn-head"><i>Q</i><div><b>Quince Matrix</b><small>JDA Texworld · JTPL004</small></div><button class="qmn-x" type="button" aria-label="Close menu">×</button></div>' +
    LINKS.map(function (l) { return '<a class="qmn-l" href="' + l.href + '"' + (isHere(l) ? ' aria-current="page"' : '') + '>' + svg(l.icon) + '<span>' + l.label + '<small>' + l.sub + '</small></span></a>'; }).join("") +
    '<div class="qmn-foot">Updated every day with the "start" run.</div>';
  function mount() {
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.appendChild(scrim); document.body.appendChild(panel);
    var btn = bar.querySelector(".qmn-btn");
    function open(v) { document.documentElement.classList.toggle("qmn-open", v); btn.setAttribute("aria-expanded", v); if (v) panel.querySelector("a,button").focus(); }
    btn.onclick = function () { open(true); };
    scrim.onclick = function () { open(false); };
    panel.querySelector(".qmn-x").onclick = function () { open(false); btn.focus(); };
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") open(false); });
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
