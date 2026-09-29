/* ============ Firebase wiring: auth, live data, actions, PWA ============ */
const CFG = window.FIREBASE_CONFIG || {};
const OPT = Object.assign({ useServer: false, functionsRegion: 'asia-south1' }, window.WIYS || {});
const SYNTH = '@wiys.example.com';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
G.useServer = !!OPT.useServer;
G.tzMin = -new Date().getTimezoneOffset();

let fs = null, fns = null, auth = null, F = null;          // Firebase handles
let unsubs = [];                                           // listeners for the signed-in user
let pending = 0, latestServerState = null;                 // optimistic-update bookkeeping
let baseDocs = {}, detailDocs = {}; const detailSubs = new Map();
const clean = (o) => JSON.parse(JSON.stringify(o));

/* ---------- actions ---------- */
function runLocal(name, args) {
  try { const res = applyAction(name, args); return { ok: true, res }; }
  catch (e) { const msg = e && e.message ? e.message : 'Something went wrong'; if (!(e instanceof GameError)) console.error(e); toast(msg, 'warn'); return { ok: false, err: msg }; }
}
async function callServer(name, args) {
  const call = F.httpsCallable(fns, 'act');
  const r = await call({ name, args });
  if (r.data && r.data.now) G.skew = r.data.now - Date.now();
  return r.data;
}
function serverErr(e) {
  const m = (e && e.message) || '';
  if (/internal|unavailable|deadline|network|Failed to fetch/i.test((e && e.code) + m)) return 'Couldn’t reach the server. Check your connection and try again.';
  return m.replace(/^.*?:\s*/, '') || 'Something went wrong';
}
/**
 * act(name, args) — the only way the UI changes progress.
 *  - Server mode: normal actions apply instantly on screen, then the server applies them for real
 *    (its saved state replaces the local copy). Actions that need server time or dice
 *    (finishing a session, opening a chest, creating a profile) wait for the server.
 *  - Client mode / preview: applied locally and written straight to Firestore (or nowhere, in preview).
 */
function act(name, args = {}) {
  args = Object.assign({}, args, { tz: G.tzMin });
  const authoritative = AUTH_ACTIONS.includes(name);
  if (G.offline) { const r = runLocal(name, args); render(); return authoritative ? Promise.resolve(r) : r; }

  if (!G.useServer && name === 'register') {
    return (async () => {
      const u = String(args.username || '').toLowerCase();
      try {
        const ref = F.doc(fs, 'usernames', u); const ex = await F.getDoc(ref);
        if (ex.exists() && ex.data().uid !== G.uid) { const err = 'That username is taken. Try another.'; toast(err, 'warn'); return { ok: false, err }; }
        if (!ex.exists()) await F.setDoc(ref, { uid: G.uid, at: Date.now() });
      } catch (e) { const err = 'Couldn’t reach the database. Check your internet and try again.'; toast(err, 'warn'); return { ok: false, err }; }
      const r = runLocal(name, args);
      if (r.ok) await persistClient(name, args, r.res).catch((e) => { console.error(e); toast('Couldn’t save: ' + (e.message || e), 'warn'); });
      render(); return r;
    })();
  }
  if (!G.useServer) {
    const r = runLocal(name, args);
    if (r.ok) persistClient(name, args, r.res).catch((e) => { console.error(e); toast('Couldn’t save: ' + (e.message || e), 'warn'); });
    render();
    return authoritative ? Promise.resolve(r) : r;
  }

  if (authoritative) {
    pending++;
    return callServer(name, args).then((d) => {
      (d.msgs || []).forEach(([m, k]) => toast(m, k));
      // mirror the server's outcome locally until its saved state arrives
      if (name === 'register' && !G.S.profile) { try { applyAction('register', args); } catch (_) {} }
      if (name === 'finishSession') G.S.active = null;
      if (name === 'openChest' && G.S.chests[args.kind] > 0) G.S.chests[args.kind]--;
      if (G.S.profile) rebuildPlayers();
      return { ok: true, res: d.result };
    }).catch((e) => { const msg = serverErr(e); toast(msg, 'warn'); return { ok: false, err: msg }; })
      .finally(() => { pending--; flushServerState(); });
  }
  const r = runLocal(name, args);
  if (!r.ok) return r;
  pending++;
  callServer(name, args)
    .catch((e) => { toast(serverErr(e), 'warn'); })
    .finally(() => { pending--; flushServerState(); });
  return r;
}
window.act = act;
function flushServerState() {
  if (pending > 0 || !latestServerState) return;
  G.S = deepMergeState(newState(), latestServerState); latestServerState = null;
  rebuildPlayers(); softRender();
}

/* client mode (no Cloud Functions): write my own documents */
let writeChain = Promise.resolve();
function persistClient(name, args, res) {
  const uid = G.uid; const S = clean(G.S);
  const run = async () => {
    const { doc, setDoc, getDoc, arrayUnion } = F;
    S.tz = G.tzMin;
    await setDoc(doc(fs, 'users', uid), S);
    if (S.profile) {
      const { base, detail } = splitPublic(buildPublic()); base.uid = uid;
      await setDoc(doc(fs, 'players', uid), clean(base));
      await setDoc(doc(fs, 'players', uid, 'detail', 'main'), clean(detail));
    }
    if (res && res.log) await setDoc(doc(fs, 'users', uid, 'logs', monthKey()), { s: arrayUnion(clean(res.log)) }, { merge: true });
  };
  // A failed save must never block later saves: recover from any earlier
  // rejection in the chain before attempting this one.
  writeChain = writeChain.catch(() => {}).then(run);
  return writeChain;
}

/* ---------- live data ---------- */
function rebuildPlayers() {
  const out = {};
  for (const [u, b] of Object.entries(baseDocs)) out[u] = Object.assign({}, b, detailDocs[u] || {});
  if (G.S && G.S.profile && G.uid) { const me = splitPublic(buildPublic()); out[G.uid] = Object.assign({}, me.base, me.detail, { _me: true }); }
  G.players = out;
}
function wantedDetails() {
  const want = new Set();
  if (!G.S) return want;
  (G.S.social.friends || []).forEach((u) => { const b = baseDocs[u]; if (b && (b.demo || (b.friends || []).includes(G.uid))) want.add(u); });
  return want;
}
function syncDetailSubs() {
  const want = wantedDetails();
  for (const [u, off] of detailSubs) if (!want.has(u)) { off(); detailSubs.delete(u); delete detailDocs[u]; }
  for (const u of want) if (!detailSubs.has(u)) {
    const off = F.onSnapshot(F.doc(fs, 'players', u, 'detail', 'main'), (s) => { detailDocs[u] = s.exists() ? s.data() : {}; rebuildPlayers(); if (G.useServer === false) syncTeamChallengesClient(); softRender(); }, () => { detailSubs.delete(u); });
    detailSubs.set(u, off);
  }
}
function syncTeamChallengesClient() { /* client mode: let a partner's progress finish a team challenge */ if (G.S && G.S.profile) { const before = JSON.stringify(G.S.social.chState); syncTeamChallenges(); if (JSON.stringify(G.S.social.chState) !== before) persistClient('sync', {}, null); } }

function listen(uid) {
  const { doc, collection, query, limit, onSnapshot } = F;
  unsubs.push(onSnapshot(doc(fs, 'users', uid), (s) => {
    if (s.metadata.hasPendingWrites) return;
    if (!s.exists()) { G.S = newState(); G.S.profile = null; softRender(); return; }
    const data = s.data();
    if (pending > 0) { latestServerState = data; return; }
    G.S = deepMergeState(newState(), data);
    if (!G.bootSynced && G.S.profile) { G.bootSynced = true; act('sync'); }
    rebuildPlayers(); syncDetailSubs(); softRender();
  }, (e) => console.warn('state', e)));
  unsubs.push(onSnapshot(doc(fs, 'users', uid, 'logs', monthKey()), (s) => { G.monthLog = s.exists() ? (s.data().s || []) : []; softRender(); }, () => {}));
  unsubs.push(onSnapshot(query(collection(fs, 'players'), limit(800)), (s) => {
    baseDocs = {}; s.forEach((d) => { baseDocs[d.id] = d.data(); });
    if (!s.metadata.fromCache && !G.demoChecked) { G.demoChecked = true; seedDemo(); }
    rebuildPlayers(); syncDetailSubs(); softRender();
  }, (e) => console.warn('players', e)));
  unsubs.push(onSnapshot(doc(fs, 'config', 'content'), (s) => { if (s.exists()) { G.config = Object.assign({ badges: [], announce: '' }, s.data()); softRender(); } }, () => {}));
}
async function seedDemo() {
  const demo = window.DEMO_PLAYERS || {};
  for (const [id, doc] of Object.entries(demo)) {
    if (baseDocs[id]) continue;
    try {
      const { base, detail } = splitPublic(doc);
      await F.setDoc(F.doc(fs, 'players', id), clean(base));
      await F.setDoc(F.doc(fs, 'players', id, 'detail', 'main'), clean(detail));
    } catch (e) { /* someone else already added it */ }
  }
}
function stopListening() { unsubs.forEach((f) => f()); unsubs = []; for (const off of detailSubs.values()) off(); detailSubs.clear(); baseDocs = {}; detailDocs = {}; }

/* ---------- auth ---------- */
window.AUTH = {
  async signUp(username, password) {
    const cred = await F.createUserWithEmailAndPassword(auth, username + SYNTH, password);
    try { await F.setDoc(F.doc(fs, 'usernames', username), { uid: cred.user.uid, at: Date.now() }); } catch (e) { console.warn('username claim', e); }
  },
  async signIn(user, password) { const email = user.includes('@') ? user : user.toLowerCase() + SYNTH; await F.signInWithEmailAndPassword(auth, email, password); },
  async google() {
    const p = new F.GoogleAuthProvider();
    try { await F.signInWithPopup(auth, p); }
    catch (e) { if (/popup-blocked|operation-not-supported|web-storage/.test(e.code || '')) await F.signInWithRedirect(auth, p); else throw e; }
  },
  async signOut() { stopListening(); await F.signOut(auth); },
};

/* ---------- soft render (don't clobber a field the player is typing in) ---------- */
let renderQueued = false;
function softRender() {
  const a = document.activeElement;
  if (a && a.closest && a.closest('#view, .modal, .splash') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) { G.pendingRender = true; return; }
  if (renderQueued) return; renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
window.softRender = softRender;
document.addEventListener('focusout', () => { if (G.pendingRender) { G.pendingRender = false; setTimeout(softRender, 60); } });

/* ---------- boot ---------- */
async function boot() {
  const configured = CFG.apiKey && !/^YOUR/.test(CFG.apiKey);
  if (!configured) {                                   // preview mode: playable, nothing saved
    G.offline = true; G.uid = 'preview'; G.S = newState(); render(); return;
  }
  const [app, a, f, fn] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js'), import(FB + 'firebase-functions.js'),
  ]);
  F = Object.assign({}, a, f, fn);
  const fbApp = app.initializeApp(CFG);
  auth = a.getAuth(fbApp);
  // Explicitly pin login persistence to this browser (survives refresh, tab close, and
  // browser restart) instead of relying on the SDK's automatic default, which some
  // browsers/extensions quietly override. Try IndexedDB first (best), fall back to
  // localStorage if IndexedDB is blocked.
  try { await a.setPersistence(auth, a.indexedDBLocalPersistence); }
  catch (e1) {
    try { await a.setPersistence(auth, a.browserLocalPersistence); }
    catch (e2) { console.warn('auth persistence unavailable, session will not survive refresh', e2); }
  }
  try { fs = f.initializeFirestore(fbApp, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) }); }
  catch (e) { fs = f.getFirestore(fbApp); }
  fns = fn.getFunctions(fbApp, OPT.functionsRegion);
  try { await a.getRedirectResult(auth); } catch (e) { console.warn(e); }
  a.onAuthStateChanged(auth, (user) => {
    stopListening(); G.S = null; G.players = {}; G.bootSynced = false; G.skew = 0;
    if (!user) { G.uid = null; render(); return; }
    G.uid = user.uid; G.authEmail = user.email || ''; G.authName = user.displayName || '';
    G.lockUsername = !!(user.email && user.email.endsWith(SYNTH));
    if (G.lockUsername) ob.username = user.email.slice(0, -SYNTH.length);
    const h = (location.hash || '').slice(1); if (VIEWS[h]) G.view = h;
    render(); listen(user.uid);
  });
}

/* ---------- keep day-based numbers fresh ---------- */
let lastDay = null;
setInterval(() => { if (!G.S || !G.S.profile) return; const k = dayKey(); if (lastDay && k !== lastDay) { if (!G.offline) act('sync'); softRender(); } lastDay = k; }, 30000);
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS[h] && h !== G.view) { G.view = h; render(); } });
window.addEventListener('online', () => { G.netDown = false; softRender(); });
window.addEventListener('offline', () => { G.netDown = true; softRender(); });
G.netDown = navigator.onLine === false;

/* ---------- PWA: service worker + install button ---------- */
G.standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); G.installPrompt = e; softRender(); });
window.addEventListener('appinstalled', () => { G.installPrompt = null; G.standalone = true; toast('Installed! Open it from your home screen.', 'info'); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));

boot().catch((e) => { console.error(e); document.getElementById('app').innerHTML = `<div class="splash"><div><h2>Couldn’t start</h2><p class="muted">${esc(e.message || e)}</p></div></div>`; });
