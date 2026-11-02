// Couche temps réel : même API pour Firebase et pour le mode démo local.
// API : set(path, v) · update(path, obj) · remove(path) · get(path) · on(path, cb) → unsubscribe · now()
import { FIREBASE_CONFIG } from './config.js';

export const MODE = FIREBASE_CONFIG && FIREBASE_CONFIG.databaseURL ? 'firebase' : 'local';

let api = null;
export async function getDB() {
  if (!api) {
    try {
      api = MODE === 'firebase' ? await firebaseDB() : localDB();
    } catch (e) {
      document.body.insertAdjacentHTML('beforeend', `<div class="net-error"><b>Connexion impossible</b>
        <span>Vérifie ta connexion internet et la config Firebase dans config.js.</span><small>${String(e?.message || e).replace(/</g, '&lt;')}</small></div>`);
      throw e;
    }
  }
  return api;
}

async function firebaseDB() {
  const V = '10.12.2';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);
  const d = F.getDatabase(initializeApp(FIREBASE_CONFIG));
  const r = (p) => F.ref(d, p);
  return {
    set: (p, v) => F.set(r(p), v),
    update: (p, v) => F.update(r(p), v),
    remove: (p) => F.remove(r(p)),
    get: async (p) => (await F.get(r(p))).val(),
    on: (p, cb) => F.onValue(r(p), (s) => cb(s.val())),
    now: () => F.serverTimestamp(),
  };
}

// Mode démo : base JSON dans localStorage, synchronisée entre onglets via BroadcastChannel.
function localDB() {
  const KEY = 'quizlive-local-db';
  const ch = new BroadcastChannel('quizlive-local');
  const listeners = new Set();
  const parts = (p) => p.split('/').filter(Boolean);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const getAt = (o, p) => parts(p).reduce((a, k) => (a == null ? undefined : a[k]), o);
  const resolve = (v) => {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      const o = Array.isArray(v) ? [] : {};
      for (const k in v) o[k] = resolve(v[k]);
      return o;
    }
    return v;
  };
  const setAt = (root, p, v) => {
    const ks = parts(p);
    let o = root;
    for (let i = 0; i < ks.length - 1; i++) {
      if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last];
    else o[last] = resolve(v);
  };
  // Chaque onglet garde une copie en mémoire ; on diffuse les opérations elles-mêmes
  // (localStorage ne sert qu'à amorcer un nouvel onglet).
  let mem = read();
  const notify = () => {
    listeners.forEach((l) => {
      const v = getAt(mem, l.p) ?? null;
      const s = JSON.stringify(v);
      if (s !== l.last) { l.last = s; l.cb(JSON.parse(s)); }
    });
  };
  const apply = (ops) => { for (const [p, v] of ops) setAt(mem, p, v); };
  const write = (ops) => {
    ops = ops.map(([p, v]) => [p, resolve(v)]);
    apply(ops);
    localStorage.setItem(KEY, JSON.stringify(mem));
    ch.postMessage({ t: 'ops', ops });
    notify();
  };
  ch.onmessage = ({ data }) => {
    if (data.t === 'ops') apply(data.ops);
    else if (data.t === 'hello') return ch.postMessage({ t: 'snap', root: mem });
    else if (data.t === 'snap') mem = data.root;
    notify();
  };
  ch.postMessage({ t: 'hello' });
  return {
    set: async (p, v) => write([[p, v]]),
    update: async (p, obj) => write(Object.entries(obj).map(([k, v]) => [`${p}/${k}`, v])),
    remove: async (p) => write([[p, null]]),
    get: async (p) => getAt(mem, p) ?? null,
    on: (p, cb) => {
      const l = { p, cb, last: undefined };
      listeners.add(l);
      queueMicrotask(() => { if (listeners.has(l) && l.last === undefined) { const v = getAt(mem, p) ?? null; l.last = JSON.stringify(v); cb(v); } });
      return () => listeners.delete(l);
    },
    now: () => ({ '.sv': 'timestamp' }),
  };
}
