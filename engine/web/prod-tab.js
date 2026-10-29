/* Quince Matrix: "Production Update" button + "Production" tab on the public dashboard.
   Production (cutting / packing) is tracked separately from shop stock and sales. */
(function () {
  "use strict";
  var F = window.QMFire, A = window.QM_APP;
  if (!A) return;
  var ROWS = [], USER = null, LOADED = false, ERR = "", ui = { po: "All", log: "today" };
  var SW = (F && F.SWATCH) || {}, SL = (F && F.SIZE_LABEL) || {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString("en-IN"); }
  function today() { return F ? F.istDay() : new Date().toISOString().slice(0, 10); }
  function dayOf(r) { return r.ts && r.ts.toDate ? F.istDay(r.ts.toDate()) : r.day; }

  var css = document.createElement("style");
  css.textContent =
    ".pu-btn{position:relative;border:1px solid transparent;border-radius:8px;padding:8px 14px;font-weight:600;display:inline-flex;gap:8px;align-items:center;white-space:nowrap;text-decoration:none;color:#0E1311;background:linear-gradient(120deg,#3FB596,#9AE6C9,#3FB596);background-size:220% 100%;box-shadow:0 0 0 1px rgba(63,181,150,.4),0 0 18px rgba(63,181,150,.35);animation:puShine 6s linear infinite;transition:transform .15s,box-shadow .25s}" +
    ".pu-btn:hover{transform:translateY(-1px);box-shadow:0 0 0 1px #3FB596,0 0 30px rgba(63,181,150,.7)}" +
    ".pu-btn svg{width:16px;height:16px}" +
    ".pu-fab{background:linear-gradient(120deg,#C9B8A3,#F1E6D6,#C9B8A3);background-size:220% 100%;box-shadow:0 0 0 1px rgba(201,184,163,.5),0 0 18px rgba(201,184,163,.35)}.pu-fab:hover{box-shadow:0 0 0 1px #C9B8A3,0 0 30px rgba(201,184,163,.75)}" +
    "@keyframes puShine{to{background-position:-220% 0}}" +
    ".pu-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}" +
    ".pu-kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}" +
    ".pu-kpi span{font-size:12px;color:var(--muted)}.pu-kpi b{display:block;font-size:24px;font-variant-numeric:tabular-nums}.pu-kpi small{color:var(--muted);font-size:12px}" +
    ".pu-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}" +
    ".pu-bar select{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font:inherit}" +
    ".pu-po{background:var(--surface);border:1px solid var(--line);border-radius:14px;margin-bottom:12px;overflow:hidden;transition:box-shadow .25s,border-color .25s}" +
    ".pu-po:hover{border-color:#3FB596;box-shadow:0 0 0 1px rgba(63,181,150,.5),0 0 22px rgba(63,181,150,.18)}" +
    ".pu-po h4{margin:0;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);font-size:15px}" +
    ".pu-po h4 .t{font-size:12px;font-weight:500;color:var(--muted)}" +
    ".pu-tw{overflow-x:auto}.pu-t{width:100%;border-collapse:collapse;font-size:13px}" +
    ".pu-t th,.pu-t td{padding:7px 12px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}" +
    ".pu-t th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}" +
    ".pu-t td.r,.pu-t th.r{text-align:right;font-variant-numeric:tabular-nums}" +
    ".pu-t tr:last-child td{border-bottom:0}.pu-t tr.today td{background:rgba(63,181,150,.08)}" +
    ".pu-sw{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px;border:1px solid rgba(0,0,0,.15)}" +
    ".pu-new{display:inline-block;font-size:11px;font-weight:600;border-radius:999px;padding:1px 7px;background:rgba(63,181,150,.16);color:#2E9C7E;margin-left:4px}" +
    ".pu-prog{width:90px;height:6px;border-radius:9px;background:var(--sunk);display:inline-block;vertical-align:middle;overflow:hidden;margin-left:6px}.pu-prog i{display:block;height:100%;background:#3FB596}" +
    ".pu-over{color:#C0392B;font-weight:600}" +
    ".pu-note{font-size:12.5px;color:var(--muted);margin:6px 0 14px}" +
    ".pu-empty{padding:18px;color:var(--muted);background:var(--surface);border:1px dashed var(--line);border-radius:12px}" +
    ".pu-mini{border:1px solid var(--line);background:none;border-radius:7px;padding:2px 8px;font-size:12px;color:var(--ink-2);cursor:pointer}.pu-mini:hover{border-color:#C0392B;color:#C0392B}";
  document.head.appendChild(css);

  // "Production" tab after Activity
  var tabs = document.querySelector(".tabs");
  if (tabs && !tabs.querySelector('[data-tab="production"]')) {
    var b = document.createElement("button");
    b.className = "tab"; b.type = "button"; b.setAttribute("role", "tab"); b.dataset.tab = "production"; b.textContent = "Production";
    tabs.appendChild(b);
  }

  // per PO / sku summary: PO qty, inspected, cut, packed, today
  // totals per design / shade / size (no PO split: cut qty can move between POs)
  function summary() {
    var insp = A.inspected(), t = F ? F.totals(ROWS) : {}, groups = {}, ORD = ["Waffle Throw", "Waffle Bed Blanket", "Duvet Cover", "Duvet Cover Set", "Sham Set"];
    var bySku = {};
    Object.keys(t).forEach(function (k) { var sku = k.split("|")[1], x = t[k], y = bySku[sku] || (bySku[sku] = { cut: 0, packed: 0, cutToday: 0, packedToday: 0 }); ["cut", "packed", "cutToday", "packedToday"].forEach(function (f) { y[f] += x[f]; }); });
    var inspSku = {}; Object.keys(insp).forEach(function (k) { var sku = k.split("|")[1]; inspSku[sku] = (inspSku[sku] || 0) + insp[k]; });
    A.state.catalog.forEach(function (c) {
      if (!c.pos || !c.pos.length) return;
      var P = groups[c.product] || (groups[c.product] = { po: c.product, lines: [], qty: 0, cut: 0, packed: 0, insp: 0, cutToday: 0, packedToday: 0 });
      var x = bySku[c.sku] || { cut: 0, packed: 0, cutToday: 0, packedToday: 0 }, q = 0; c.pos.forEach(function (p) { q += p.qty; });
      var L = { sku: c.sku, product: c.product, colour: c.colour, size: c.size, cls: c.cls, qty: q, insp: inspSku[c.sku] || 0, cut: x.cut, packed: x.packed, cutToday: x.cutToday, packedToday: x.packedToday };
      P.lines.push(L);
      ["qty", "cut", "packed", "insp", "cutToday", "packedToday"].forEach(function (f) { P[f] += L[f]; });
    });
    return Object.keys(groups).map(function (k) { var P = groups[k]; P.lines.sort(function (a, b) { return ((b.cutToday + b.packedToday) > 0) - ((a.cutToday + a.packedToday) > 0) || (a.colour < b.colour ? -1 : a.colour > b.colour ? 1 : 0) || (a.sku < b.sku ? -1 : 1); }); return P; })
      .sort(function (a, b) { return ORD.indexOf(a.po) - ORD.indexOf(b.po); });
  }

  function view() {
    var S = summary(), tot = { qty: 0, cut: 0, packed: 0, insp: 0, cutToday: 0, packedToday: 0 };
    S.forEach(function (P) { Object.keys(tot).forEach(function (f) { tot[f] += P[f]; }); });
    var h = '<div class="pu-kpis">' +
      '<div class="pu-kpi"><span>Cut today</span><b>' + fmt(tot.cutToday) + '</b><small>pcs</small></div>' +
      '<div class="pu-kpi"><span>Packed today</span><b>' + fmt(tot.packedToday) + '</b><small>pcs</small></div>' +
      '<div class="pu-kpi"><span>Total cut</span><b>' + fmt(tot.cut) + '</b><small>of ' + fmt(tot.qty) + ' PO qty</small></div>' +
      '<div class="pu-kpi"><span>Total packed</span><b>' + fmt(tot.packed) + '</b><small>' + fmt(tot.insp) + ' inspected</small></div></div>';
    h += '<div class="pu-bar"><select id="pu-po" aria-label="Filter by design"><option>All</option>' + S.map(function (P) { return '<option' + (String(P.po) === ui.po ? " selected" : "") + '>' + P.po + '</option>'; }).join("") + '</select>' +
      '<button class="btn" id="pu-xl" type="button">Download Excel summary</button>' +
      (USER ? '<span class="pu-note" style="margin:0">Signed in as ' + esc(F.getName(USER)) + '</span>' : (F && F.ready ? '<button class="btn" id="pu-in" type="button">Sign in to see who entered</button>' : '')) + '</div>';
    if (ERR) h += '<div class="pu-empty">Production data could not load: ' + esc(ERR) + '</div>';
    else if (!LOADED) h += '<div class="pu-empty">Loading production…</div>';
    S.filter(function (P) { return ui.po === "All" || String(P.po) === ui.po; }).forEach(function (P) {
      h += '<section class="pu-po"><h4>' + esc(P.po) + '<span class="t">Open PO qty ' + fmt(P.qty) + ' · Cut ' + fmt(P.cut) + ' · Packed ' + fmt(P.packed) + ' · Inspected ' + fmt(P.insp) + '</span>' +
        (P.cutToday || P.packedToday ? '<span class="pu-new">Today +' + fmt(P.cutToday) + ' cut, +' + fmt(P.packedToday) + ' packed</span>' : '') + '</h4>' +
        '<div class="pu-tw"><table class="pu-t"><thead><tr><th>Design</th><th>Shade</th><th>Size</th><th class="r">Open PO qty</th><th class="r">Cut</th><th class="r">Packed</th><th class="r">Inspected</th><th class="r">To cut</th><th class="r">To pack</th></tr></thead><tbody>' +
        P.lines.map(function (L) {
          var pct = L.qty ? Math.min(100, Math.round(L.cut / L.qty * 100)) : 0, tc = L.qty - L.cut, tp = L.qty - L.packed;
          return '<tr class="' + (L.cutToday || L.packedToday ? "today" : "") + '"><td>' + esc(L.product) + '</td><td><span class="pu-sw" style="background:' + (SW[L.colour] || "#999") + '"></span>' + esc(L.colour) + '</td><td>' + esc(SL[L.cls] || L.size) + '</td><td class="r">' + fmt(L.qty) + '</td>' +
            '<td class="r">' + fmt(L.cut) + (L.cutToday ? '<span class="pu-new">+' + fmt(L.cutToday) + '</span>' : '') + '<span class="pu-prog"><i style="width:' + pct + '%"></i></span></td>' +
            '<td class="r">' + fmt(L.packed) + (L.packedToday ? '<span class="pu-new">+' + fmt(L.packedToday) + '</span>' : '') + '</td><td class="r">' + fmt(L.insp) + '</td>' +
            '<td class="r' + (tc < 0 ? ' pu-over' : '') + '">' + fmt(tc) + '</td><td class="r' + (tp < 0 ? ' pu-over' : '') + '">' + fmt(tp) + '</td></tr>';
        }).join("") + '</tbody></table></div></section>';
    });
    if (USER) h += logView();
    else h += '<p class="pu-note">Totals only. Team members who sign in with Google also see each entry with the name of who entered it.</p>';
    return h;
  }

  function logView() {
    var t = today(), owner = F.isOwner(USER);
    var rows = ROWS.filter(function (r) { return ui.log === "all" || dayOf(r) === t; });
    var h = '<div class="pu-bar" style="margin-top:18px"><h3 style="margin:0;font-size:16px">Production log</h3><select id="pu-log" aria-label="Which entries"><option value="today"' + (ui.log === "today" ? " selected" : "") + '>Today</option><option value="all"' + (ui.log === "all" ? " selected" : "") + '>All dates</option></select></div>';
    if (!rows.length) return h + '<div class="pu-empty">No entries ' + (ui.log === "today" ? "today yet" : "yet") + '.</div>';
    return h + '<div class="pu-po"><div class="pu-tw"><table class="pu-t"><thead><tr><th>Date</th><th>Time</th><th>Stage</th><th>Design</th><th>Shade</th><th>Size</th><th class="r">Qty</th><th>Entered by</th><th></th></tr></thead><tbody>' +
      rows.slice(0, 500).map(function (r) {
        var d = F.entryDate(r);
        return '<tr><td>' + (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : esc(r.day)) + '</td><td>' + (d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "") + '</td><td>' + (r.stage === "cutting" ? "Cutting" : "Packing") + '</td><td>' + esc(r.product) + '</td><td><span class="pu-sw" style="background:' + (SW[r.shade] || "#999") + '"></span>' + esc(r.shade) + '</td><td>' + esc(SL[r.size] || r.size) + '</td><td class="r"><b>' + fmt(r.qty) + '</b></td><td>' + esc(r.name) + '</td><td>' +
          (F.canDelete(USER, r) ? '<button class="pu-mini" type="button" data-pudel="' + r.id + '">Delete</button>' : '') + '</td></tr>';
      }).join("") + '</tbody></table></div></div>' + (owner ? '<p class="pu-note">As owner you can delete any entry here; to change a quantity use the Production Update page.</p>' : '');
  }

  function bind(v) {
    var s = v.querySelector("#pu-po"); if (s) s.onchange = function () { ui.po = s.value; A.render(); };
    var l = v.querySelector("#pu-log"); if (l) l.onchange = function () { ui.log = l.value; A.render(); };
    var i = v.querySelector("#pu-in"); if (i) i.onclick = function () { F.signIn().catch(function () {}); };
    var x = v.querySelector("#pu-xl"); if (x) x.onclick = function () { x.disabled = true; x.textContent = "Preparing…"; excel().then(function () { x.disabled = false; x.textContent = "Download Excel summary"; }, function (e) { x.disabled = false; x.textContent = "Download failed, try again"; console.error(e); }); };
    v.querySelectorAll("[data-pudel]").forEach(function (b) {
      b.onclick = function () {
        if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Confirm"; return; }
        b.disabled = true; F.deleteEntry(b.dataset.pudel).catch(function () { b.textContent = "Locked"; });
      };
    });
  }

  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
      s.onload = function () { res(window.ExcelJS); }; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function excel() {
    return loadExcelJS().then(function (X) {
      var wb = new X.Workbook(), S = summary(), t = today();
      var ws = wb.addWorksheet("Production summary", { views: [{ state: "frozen", ySplit: 4 }] });
      ws.mergeCells("A1:L1"); ws.getCell("A1").value = "Quince Matrix · Production summary";
      ws.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF16201B" } };
      ws.mergeCells("A2:L2"); ws.getCell("A2").value = "As of " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST. Rows with cutting or packing today are listed first and highlighted.";
      ws.getCell("A2").font = { italic: true, color: { argb: "FF6B7871" } };
      var head = ["Group", "Design", "Shade", "Size", "SKU", "PO qty", "Cut", "Packed", "Inspected", "Balance to cut", "Balance to pack", "Cut today", "Packed today"];
      ws.getRow(4).values = head;
      ws.getRow(4).eachCell(function (c) { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E6B5A" } }; c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });
      ws.getRow(4).height = 30;
      var lines = [];
      S.forEach(function (P) { P.lines.forEach(function (L) { lines.push({ P: P, L: L }); }); });
      lines.sort(function (a, b) { var ta = a.L.cutToday + a.L.packedToday, tb = b.L.cutToday + b.L.packedToday; return (tb > 0) - (ta > 0) || (b.L.cutToday - a.L.cutToday) || (a.P.po < b.P.po ? -1 : a.P.po > b.P.po ? 1 : 0) || (a.L.sku < b.L.sku ? -1 : 1); });
      var r = 5;
      lines.forEach(function (o) {
        var L = o.L, row = ws.getRow(r);
        row.values = [o.P.po, L.product, L.colour, L.size, L.sku, L.qty, L.cut, L.packed, L.insp, null, null, L.cutToday, L.packedToday];
        row.getCell(10).value = { formula: "F" + r + "-G" + r, result: L.qty - L.cut };
        row.getCell(11).value = { formula: "F" + r + "-H" + r, result: L.qty - L.packed };
        if (L.cutToday || L.packedToday) row.eachCell({ includeEmpty: true }, function (c, n) { if (n <= 13) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2C2" } }; });
        r++;
      });
      var last = r - 1, tr = ws.getRow(r);
      tr.getCell(1).value = "Total";
      ["F", "G", "H", "I", "J", "K", "L", "M"].forEach(function (col, i) { tr.getCell(6 + i).value = { formula: "SUM(" + col + "5:" + col + Math.max(last, 5) + ")" }; });
      tr.eachCell(function (c) { c.font = { bold: true }; c.border = { top: { style: "thin" } }; });
      for (var k = 6; k <= 13; k++) ws.getColumn(k).numFmt = "#,##0;[Red]-#,##0";
      [9, 20, 13, 14, 12, 10, 10, 10, 11, 13, 13, 11, 12].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
      ws.autoFilter = { from: "A4", to: "M" + Math.max(last, 4) };

      var lg = wb.addWorksheet("Production log", { views: [{ state: "frozen", ySplit: 1 }] });
      lg.getRow(1).values = ["Date", "Time", "PO (old entries)", "Stage", "Design", "Shade", "Size", "SKU", "Qty", "Entered by"];
      lg.getRow(1).eachCell(function (c) { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E6B5A" } }; });
      var showNames = !!USER;
      ROWS.slice().sort(function (a, b) { var A1 = dayOf(a) === t, B1 = dayOf(b) === t; return (B1 - A1) || ((b.ts && b.ts.toMillis ? b.ts.toMillis() : 0) - (a.ts && a.ts.toMillis ? a.ts.toMillis() : 0)); }).forEach(function (e, i) {
        var d = F.entryDate(e), row = lg.getRow(i + 2);
        row.values = [dayOf(e), d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "", e.po || "", e.stage === "cutting" ? "Cutting" : "Packing", e.product, e.shade, SL[e.size] || e.size, e.sku, e.qty, showNames ? e.name : "(sign in to see)"];
        if (dayOf(e) === t) row.eachCell({ includeEmpty: true }, function (c, n) { if (n <= 10) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2C2" } }; });
      });
      [12, 9, 9, 10, 20, 13, 14, 12, 8, 20].forEach(function (w, i) { lg.getColumn(i + 1).width = w; });
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      a.download = "Quince-production-" + today() + ".xlsx"; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    });
  }

  window.QM_EXT = {
    actions: function () { return '<a class="pu-btn" href="production.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>Production Update</a><a class="pu-btn pu-fab" href="fabric.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2z"/><path d="M4 6v12c0 1.1 3.6 2 8 2s8-.9 8-2V6"/><path d="M4 12c0 1.1 3.6 2 8 2s8-.9 8-2"/></svg>Fabric Reco</a>'; },
    view: view, bind: bind
  };
  if ((location.hash || "").slice(1) === "production") A.setTab("production"); else A.render();

  if (F && F.ready) {
    F.watchEntries(function (rows) { ROWS = rows; LOADED = true; ERR = ""; if (A.tab() === "production") A.render(); }, function (e) { ERR = e.code || e.message; LOADED = true; if (A.tab() === "production") A.render(); });
    F.auth.onAuthStateChanged(function (u) { USER = u; if (A.tab() === "production") A.render(); });
  } else { ERR = "the production service did not start"; }
})();
