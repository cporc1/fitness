// Persistence. The app's state is a set of named documents. Each document is
// saved to localStorage, and — when the page runs inside claude.ai with the
// `db` capability — mirrored to the viewer's private cloud store so data
// survives across devices. Sessions are sharded by month (sessions-YYYY-MM)
// to keep every document small.

import { deepClone, debounce } from './util.js';

const PREFIX = 'liftlap:v1:';
const META_KEY = `${PREFIX}__meta`;

const DEFAULT_DOCS = {
  profile: null, // set by onboarding
  settings: {
    restCompound: 120, restIsolation: 75, restSwim: 30,
    sound: true, wakeLock: true, theme: 'auto',
    plates: null, // custom plate set; null = defaults for the unit
  },
  schedule: null, // { days: ['gym','swim','rest',...] } Mon..Sun
  custom: { templates: [], exercises: [] },
  swaps: {}, // exerciseId -> replacement exerciseId, applied to program workouts
  body: { entries: [] }, // { date, weight, waist, chest, hips, arm, thigh, bodyFat }
  daily: { days: {} }, // 'YYYY-MM-DD' -> { water, sleep, protein, energy, steps }
  active: null, // the in-progress session
};

const listeners = new Set();
const docs = new Map();
let meta = {}; // name -> { at: epoch ms of last local change }
let remote = null; // { put(name, value, at), del(name) }

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

function loadLocal() {
  try { meta = JSON.parse(safeGet(META_KEY) || '{}') || {}; } catch { meta = {}; }
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  if (storage) {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(PREFIX) || key === META_KEY) continue;
      try { docs.set(key.slice(PREFIX.length), JSON.parse(storage.getItem(key))); } catch { /* skip corrupt */ }
    }
  }
}

function persistLocal(name) {
  if (docs.has(name)) safeSet(PREFIX + name, JSON.stringify(docs.get(name)));
  else safeRemove(PREFIX + name);
  safeSet(META_KEY, JSON.stringify(meta));
}

function emit(name) {
  for (const fn of listeners) {
    try { fn(name); } catch (err) { console.error(err); }
  }
}

export function init() {
  loadLocal();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function get(name) {
  if (docs.has(name)) return docs.get(name);
  return deepClone(DEFAULT_DOCS[name] ?? null);
}

/** Replace a document. Pass null to delete. */
export function set(name, value, { silent = false } = {}) {
  const at = Date.now();
  if (value === null || value === undefined) docs.delete(name);
  else docs.set(name, value);
  meta[name] = { at };
  persistLocal(name);
  if (remote) remote.put(name, value ?? null, at);
  if (!silent) emit(name);
}

/** Read-modify-write helper. */
export function update(name, fn, opts) {
  const draft = deepClone(get(name));
  const next = fn(draft) ?? draft;
  set(name, next, opts);
  return next;
}

export function docNames() {
  return [...docs.keys()];
}

// ---------------- sessions (sharded by month) ----------------

function monthKey(date) { return `sessions-${date.slice(0, 7)}`; }

export function allSessions() {
  const out = [];
  for (const [name, value] of docs) {
    if (name.startsWith('sessions-') && value && Array.isArray(value.items)) out.push(...value.items);
  }
  return out.sort((a, b) => (b.date + (b.startedAt || '')).localeCompare(a.date + (a.startedAt || '')));
}

export function saveSession(session) {
  // A session may have moved months if its date was edited.
  for (const [name, value] of docs) {
    if (!name.startsWith('sessions-') || name === monthKey(session.date)) continue;
    if (value?.items?.some((s) => s.id === session.id)) {
      update(name, (d) => { d.items = d.items.filter((s) => s.id !== session.id); }, { silent: true });
    }
  }
  update(monthKey(session.date), (d) => {
    const doc = d || { items: [] };
    const i = doc.items.findIndex((s) => s.id === session.id);
    if (i >= 0) doc.items[i] = session; else doc.items.push(session);
    return doc;
  });
}

export function deleteSession(id) {
  for (const [name, value] of docs) {
    if (name.startsWith('sessions-') && value?.items?.some((s) => s.id === id)) {
      update(name, (d) => { d.items = d.items.filter((s) => s.id !== id); });
    }
  }
}

// ---------------- backup ----------------

export function exportAll() {
  const out = { app: 'lift-and-lap', version: 1, exportedAt: new Date().toISOString(), docs: {} };
  for (const [name, value] of docs) out.docs[name] = value;
  return out;
}

export function isBackup(data) {
  return !!data && data.app === 'lift-and-lap' && !!data.docs && typeof data.docs === 'object';
}

export function importAll(data) {
  if (!isBackup(data)) throw new Error('This file is not a Lift & Lap backup.');
  for (const name of [...docs.keys()]) {
    if (!(name in data.docs)) set(name, null, { silent: true });
  }
  for (const [name, value] of Object.entries(data.docs)) set(name, value, { silent: true });
  emit('*');
}

export function resetAll() {
  for (const name of [...docs.keys()]) set(name, null, { silent: true });
  emit('*');
}

// ---------------- cloud mirror (claude.ai artifact `db` capability) ----------------

export const sync = { status: 'local', error: null };

function setSyncStatus(status, error = null) {
  sync.status = status;
  sync.error = error;
  emit('__sync');
}

/**
 * Connect to the viewer's private store when available. Local data renders
 * first; this merges by last-change time per document, newest wins.
 */
export async function connectCloud() {
  const claude = typeof window !== 'undefined' ? window.claude : undefined;
  if (!claude || typeof claude.use !== 'function') return false;
  let db; let user;
  try {
    [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  } catch { return false; }
  if (!db || !user) return false;
  let uid;
  try { uid = await user.id(); } catch { uid = null; }
  if (!uid) return false;

  setSyncStatus('syncing');
  const col = db.collection(`data/users/${uid}`);
  const remoteDocName = (name) => name.replace(/[^A-Za-z0-9_.~:@+-]/g, '_');

  // Writes: one at a time per document, coalesced.
  const pending = new Map();
  const inFlight = new Set();
  async function flush(name) {
    if (inFlight.has(name) || !pending.has(name)) return;
    const { value, at } = pending.get(name);
    pending.delete(name);
    inFlight.add(name);
    try {
      const ref = col.doc(remoteDocName(name));
      if (value === null) await ref.delete();
      else await ref.set({ name, at, value });
      if (sync.status !== 'synced') setSyncStatus('synced');
    } catch (err) {
      const code = err?.code || 'unavailable';
      if (code === 'unavailable' || code === 'resource_exhausted') {
        if (!pending.has(name)) pending.set(name, { value, at });
        setTimeout(() => flush(name), 4000 + Math.random() * 3000);
      }
      setSyncStatus('error', code === 'quota_exceeded'
        ? 'Cloud storage is full. Export a backup from Settings.'
        : 'Cloud sync is paused. Your data is still saved on this device.');
    } finally {
      inFlight.delete(name);
      if (pending.has(name)) flush(name);
    }
  }
  const schedule = new Map();
  remote = {
    put(name, value, at) {
      pending.set(name, { value, at });
      if (!schedule.has(name)) schedule.set(name, debounce(() => flush(name), 700));
      schedule.get(name)();
    },
  };

  try {
    const snap = await col.get();
    const seen = new Set();
    let changed = false;
    for (const d of snap.docs) {
      const body = d.data();
      if (!body || typeof body.name !== 'string') continue;
      seen.add(body.name);
      const localAt = meta[body.name]?.at || 0;
      if ((body.at || 0) > localAt) {
        if (body.value === null || body.value === undefined) docs.delete(body.name);
        else docs.set(body.name, body.value);
        meta[body.name] = { at: body.at };
        persistLocal(body.name);
        changed = true;
      } else if (localAt > (body.at || 0)) {
        remote.put(body.name, docs.has(body.name) ? docs.get(body.name) : null, localAt);
      }
    }
    for (const name of docs.keys()) {
      if (!seen.has(name)) remote.put(name, docs.get(name), meta[name]?.at || Date.now());
    }
    setSyncStatus('synced');
    if (changed) emit('*');
  } catch (err) {
    setSyncStatus('error', 'Could not reach cloud sync. Your data is saved on this device.');
  }
  return true;
}
