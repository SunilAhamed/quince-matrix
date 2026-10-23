/* Quince Matrix: shared Firebase setup for the website (production tracking). */
(function () {
  "use strict";
  var config = {
    apiKey: "AIzaSyBGmLe0v_3djU78qgXW7ucmSzAaEr2RxD4",
    authDomain: "quince-matrix.firebaseapp.com",
    projectId: "quince-matrix",
    storageBucket: "quince-matrix.firebasestorage.app",
    messagingSenderId: "669419818544",
    appId: "1:669419818544:web:b9eaf95a955b352e3767f5"
  };
  var OWNER = "sunilahamed2@gmail.com";
  var SWATCH = { "Espresso": "#4A3328", "Mist": "#A7B6C1", "Dove": "#BAB4AC", "Undyed": "#E4DAC5", "Dried Sage": "#9AA785", "Mineral": "#788A91", "White": "#F7F7F3" };
  var SIZE_LABEL = { "THROW": "Throw", "TWIN": "Twin", "FULL/QUEEN": "Full/Queen", "KING/CAL KING": "King/Cal King", "STANDARD SHAM": "Standard sham", "KING SHAM": "King sham" };
  var ready = false, app = null, auth = null, db = null;
  try {
    app = firebase.initializeApp(config);
    auth = firebase.auth();
    db = firebase.firestore();
    ready = true;
  } catch (e) { console.error("Firebase failed to start", e); }

  function istNow() { return new Date(Date.now() + 19800000); }
  function istDay(d) { return new Date((d ? d.getTime() : Date.now()) + 19800000).toISOString().slice(0, 10); }
  function isOwner(u) { return !!(u && u.email && u.email.toLowerCase() === OWNER && u.emailVerified); }
  function entryDate(e) { return e.ts && e.ts.toDate ? e.ts.toDate() : null; }
  function canDelete(u, e) {
    if (!u) return false;
    if (isOwner(u)) return true;
    var d = entryDate(e);
    return e.uid === u.uid && !!d && istDay(d) === istDay();
  }

  function signIn() {
    var p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return auth.signInWithPopup(p).catch(function (err) {
      if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment" || err.code === "auth/cancelled-popup-request")) {
        return auth.signInWithRedirect(p);
      }
      throw err;
    });
  }
  function signOut() { return auth.signOut(); }

  function getName(u) {
    try { var n = localStorage.getItem("qm-name-" + u.uid); if (n) return n; } catch (e) {}
    return (u.displayName || (u.email || "").split("@")[0] || "Team").slice(0, 60);
  }
  function setName(u, n) {
    n = String(n || "").trim().slice(0, 60) || getName(u);
    try { localStorage.setItem("qm-name-" + u.uid, n); } catch (e) {}
    return db.collection("people").doc(u.uid).set({ name: n, email: u.email || "", updated: firebase.firestore.FieldValue.serverTimestamp() }).catch(function () {}).then(function () { return n; });
  }

  // live list of all production entries, newest first
  function watchEntries(onData, onError) {
    return db.collection("production").orderBy("ts", "desc").onSnapshot(function (snap) {
      var rows = [];
      snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; rows.push(d); });
      onData(rows);
    }, function (err) { if (onError) onError(err); });
  }
  function addEntry(u, e) {
    return db.collection("production").add({
      po: +e.po, stage: e.stage, sku: e.sku, shade: e.shade, size: e.size, product: e.product || "",
      qty: Math.round(+e.qty), uid: u.uid, name: getName(u), day: istDay(),
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  function deleteEntry(id) { return db.collection("production").doc(id).delete(); }
  function updateQty(id, qty) { return db.collection("production").doc(id).update({ qty: Math.round(+qty) }); }

  // totals: key po|stage|sku
  function totals(rows) {
    var t = {}, today = istDay();
    rows.forEach(function (r) {
      var k = r.po + "|" + r.sku;
      var x = t[k] || (t[k] = { cut: 0, packed: 0, cutToday: 0, packedToday: 0 });
      var isToday = (r.ts && r.ts.toDate ? istDay(r.ts.toDate()) : r.day) === today;
      if (r.stage === "cutting") { x.cut += r.qty; if (isToday) x.cutToday += r.qty; }
      else { x.packed += r.qty; if (isToday) x.packedToday += r.qty; }
    });
    return t;
  }

  window.QMFire = {
    ready: ready, auth: auth, db: db, OWNER: OWNER, SWATCH: SWATCH, SIZE_LABEL: SIZE_LABEL,
    istDay: istDay, istNow: istNow, isOwner: isOwner, canDelete: canDelete, entryDate: entryDate,
    signIn: signIn, signOut: signOut, getName: getName, setName: setName,
    watchEntries: watchEntries, addEntry: addEntry, deleteEntry: deleteEntry, updateQty: updateQty, totals: totals
  };
})();
