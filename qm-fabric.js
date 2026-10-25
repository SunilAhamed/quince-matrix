/* Quince Matrix: fabric reconciliation (shared by fabric.html and the daily snapshot).
   Fabric used = cut pcs x cut size (inch) x 0.0254 m x kg-per-metre (default 0.66).
   Only Cutting entries from Production Update count. Each inward is its own lot (one shade). */
(function () {
  "use strict";
  var F = window.QMFire;
  var DEFAULTS = { startDate: "2026-10-25", kgPerMtr: 0.66, cutIn: { "TWIN": 76, "FULL/QUEEN": 94, "KING/CAL KING": 110, "THROW": 52 } };
  var PRODUCTS = ["Waffle Throw", "Waffle Bed Blanket"];
  var SIZE_ORDER = ["TWIN", "FULL/QUEEN", "KING/CAL KING", "THROW"];
  var SHADE_ORDER = ["Dove", "Espresso", "Mist", "Undyed", "Mineral", "Dried Sage", "White"];

  function r2(n) { return Math.round((+n || 0) * 100) / 100; }
  function ms(t) { return t && t.toMillis ? t.toMillis() : (typeof t === "number" ? t : Date.now()); }
  function dayStart(d) { return Date.parse(d + "T00:00:00+05:30"); }
  function settingsOf(doc) {
    var s = { startDate: DEFAULTS.startDate, kgPerMtr: DEFAULTS.kgPerMtr, cutIn: {} };
    Object.keys(DEFAULTS.cutIn).forEach(function (k) { s.cutIn[k] = DEFAULTS.cutIn[k]; });
    if (doc) {
      if (+doc.kgPerMtr > 0) s.kgPerMtr = +doc.kgPerMtr;
      if (/^\d{4}-\d{2}-\d{2}$/.test(doc.startDate || "")) s.startDate = doc.startDate;
      if (doc.cutIn) Object.keys(doc.cutIn).forEach(function (k) { if (+doc.cutIn[k] > 0) s.cutIn[k] = +doc.cutIn[k]; });
    }
    return s;
  }
  // which lot a cutting entry belongs to: same shade, on/after the inward date, before Done, not during a hold; oldest first
  function lotFor(lots, e) {
    var T = ms(e.ts), best = null;
    lots.forEach(function (L) {
      if (L.shade !== e.shade) return;
      if (T < dayStart(L.date)) return;
      if (L.doneAt && T > L.doneAt) return;
      if ((L.holds || []).some(function (h) { return T >= h.from && (h.to == null || T < h.to); })) return;
      if (!best || dayStart(L.date) < dayStart(best.date) || (L.date === best.date && ms(L.ts) < ms(best.ts))) best = L;
    });
    return best;
  }
  function compute(D) {
    var S = settingsOf(D.settings), f = S.kgPerMtr;
    var lots = (D.lots || []).map(function (L) {
      return { id: L.id, shade: L.shade, kg: +L.kg || 0, date: L.date, ts: L.ts, status: L.status || "running", balOk: L.balOk == null ? null : +L.balOk, balRej: L.balRej == null ? null : +L.balRej, holds: L.holds || [], doneAt: L.doneAt || null, note: L.note || "", rows: {}, sent: 0, sends: [] };
    });
    var byId = {}; lots.forEach(function (L) { byId[L.id] = L; });
    var unlinked = {};
    (D.cuts || []).forEach(function (e) {
      if (e.stage !== "cutting" || PRODUCTS.indexOf(e.product) < 0) return;
      if (ms(e.ts) < dayStart(S.startDate)) return;   // fresh start: older cutting (already reconciled) is ignored
      var L = lotFor(lots, e), bucket = L ? L.rows : unlinked;
      var k = e.product + "|" + e.shade + "|" + e.size;
      var R = bucket[k] || (bucket[k] = { product: e.product, shade: e.shade, size: e.size, qty: 0 });
      R.qty += e.qty;
    });
    (D.dye || []).forEach(function (d) { var L = byId[d.lot]; if (L) { L.sent += +d.kg || 0; L.sends.push(d); } });
    function finish(rowsObj) {
      return Object.keys(rowsObj).map(function (k) {
        var R = rowsObj[k], inch = S.cutIn[R.size] || 0, avg = inch * 0.0254;
        R.cutIn = inch; R.avg = avg; R.mtr = R.qty * avg; R.kg = R.mtr * f; return R;
      }).sort(function (a, b) { return (PRODUCTS.indexOf(a.product) - PRODUCTS.indexOf(b.product)) || (SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)); });
    }
    lots.forEach(function (L) {
      L.rows = finish(L.rows);
      L.cutQty = 0; L.cutMtr = 0; L.cutKg = 0;
      L.rows.forEach(function (R) { L.cutQty += R.qty; L.cutMtr += R.mtr; L.cutKg += R.kg; });
      L.totalUsed = L.cutKg + (L.balOk || 0) + (L.balRej || 0);
      L.diffKg = L.kg - L.totalUsed;          // inward - used (balance kg counted only when entered)
      L.diffMtr = L.diffKg / f;
      L.inMtr = L.kg / f;
      L.onHand = L.kg - L.cutKg;              // fabric still on hand for a running lot
      L.dyeLoss = L.sent ? L.sent - L.kg : null;
    });
    lots.sort(function (a, b) {
      var o = { running: 0, hold: 1, done: 2 };
      return (o[a.status] - o[b.status]) || (dayStart(b.date) - dayStart(a.date)) || (ms(b.ts) - ms(a.ts));
    });
    var un = finish(unlinked), unQty = 0, unKg = 0; un.forEach(function (R) { unQty += R.qty; unKg += R.kg; });
    return { settings: S, lots: lots, unlinked: un, unQty: unQty, unKg: unKg };
  }

  // ---------- Firestore helpers ----------
  function watch(col, cb) {
    return F.db.collection(col).onSnapshot(function (snap) { var a = []; snap.forEach(function (d) { var x = d.data(); x.id = d.id; a.push(x); }); cb(a); }, function (e) { console.error(col, e); cb(null, e); });
  }
  function watchSettings(cb) { return F.db.collection("settings").doc("fabric").onSnapshot(function (d) { cb(d.exists ? d.data() : null); }, function () { cb(null); }); }
  function addLot(o) { return F.db.collection("lots").add({ shade: o.shade, kg: r2(o.kg), date: o.date, note: o.note || "", status: "running", balOk: null, balRej: null, holds: [], doneAt: null, ts: firebase.firestore.FieldValue.serverTimestamp() }); }
  function updateLot(id, patch) { return F.db.collection("lots").doc(id).update(patch); }
  function deleteLot(id) { return F.db.collection("lots").doc(id).delete(); }
  function holdLot(L) { var h = (L.holds || []).slice(); h.push({ from: Date.now(), to: null }); return updateLot(L.id, { status: "hold", holds: h }); }
  function resumeLot(L) { var h = (L.holds || []).map(function (x) { return x.to == null ? { from: x.from, to: Date.now() } : x; }); return updateLot(L.id, { status: "running", holds: h, balOk: null }); }  // held balance is being cut again
  function doneLot(L) { var h = (L.holds || []).map(function (x) { return x.to == null ? { from: x.from, to: Date.now() } : x; }); return updateLot(L.id, { status: "done", doneAt: Date.now(), holds: h }); }
  function reopenLot(L) { return updateLot(L.id, { status: "running", doneAt: null }); }
  function saveSettings(s) { return F.db.collection("settings").doc("fabric").set({ startDate: s.startDate, kgPerMtr: +s.kgPerMtr, cutIn: s.cutIn }); }
  function addDye(u, o) { return F.db.collection("dyesend").add({ lot: o.lot, shade: o.shade, kg: r2(o.kg), note: (o.note || "").slice(0, 120), uid: u.uid, name: F.getName(u), ts: firebase.firestore.FieldValue.serverTimestamp() }); }
  function deleteDye(id) { return F.db.collection("dyesend").doc(id).delete(); }

  window.QMFabric = {
    DEFAULTS: DEFAULTS, PRODUCTS: PRODUCTS, SIZE_ORDER: SIZE_ORDER, SHADE_ORDER: SHADE_ORDER,
    compute: compute, settingsOf: settingsOf, r2: r2,
    watch: watch, watchSettings: watchSettings, addLot: addLot, updateLot: updateLot, deleteLot: deleteLot,
    holdLot: holdLot, resumeLot: resumeLot, doneLot: doneLot, reopenLot: reopenLot, saveSettings: saveSettings, addDye: addDye, deleteDye: deleteDye
  };
})();
