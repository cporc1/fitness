// Notifications: workout reminders and milestones. The push server in
// server/ (a Cloudflare Worker) sends them; this side subscribes to Web
// Push and keeps the server up to date with your plan (js/reminders.js).
//
// On an iPhone this needs iOS 16.4 or later and the app opened from the
// Home Screen; Safari tabs can't receive push.
//
// Settings live in settings.notify = { on, reminders, time, milestones };
// this phone's push identity in the 'push' document = { id, publicKey, hash, syncedAt }.

import * as store from './store.js';
import { ctx } from './app.js';
import { debounce } from './util.js';
import { reminderPlan } from './reminders.js';

/** The push server's address. Empty until it's deployed (server/README.md): notifications stay hidden. */
export const PUSH_URL = '';
const base = () => globalThis.LIFTLAP_PUSH_URL || PUSH_URL;

export const pushConfigured = () => !!base();

/** 'ok', 'install' (an iPhone outside the Home Screen app) or 'unsupported'. */
export function pushSupport() {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return apple ? 'install' : 'unsupported';
}

export const permission = () => (typeof Notification === 'undefined' ? 'default' : Notification.permission);

export function notifySettings(settings) {
  return { on: false, reminders: true, time: '08:00', milestones: true, ...(settings?.notify || {}) };
}

const isOn = () => pushConfigured() && notifySettings(store.get('settings')).on && pushSupport() === 'ok' && permission() === 'granted';

async function api(path, body) {
  const res = await fetch(base() + path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Push server error ${res.status}`), { status: res.status });
  return data;
}

function fromB64u(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** The service worker, or null if it doesn't turn up (not installed, or blocked). */
function registration(ms = 4000) {
  return Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

function pushDoc() {
  const doc = store.get('push') || {};
  if (!doc.id) { doc.id = crypto.randomUUID(); store.set('push', doc, { silent: true }); }
  return doc;
}

/** A short fingerprint, so an unchanged plan isn't sent again. */
function fingerprint(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Turn notifications on. Call it straight from a tap: iPhones only show the
 * permission question in response to one. Resolves { ok } or { ok: false, reason }.
 */
export async function enablePush() {
  const answer = await Notification.requestPermission();
  if (answer !== 'granted') return { ok: false, reason: answer === 'denied' ? 'denied' : 'dismissed' };
  const reg = await registration();
  if (!reg) return { ok: false, reason: 'no-worker' };
  const { publicKey } = await api('/vapid');
  const doc = pushDoc();
  let sub = await reg.pushManager.getSubscription();
  if (sub && doc.publicKey && doc.publicKey !== publicKey) { await sub.unsubscribe(); sub = null; } // the server's key changed
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(publicKey) });
  store.set('push', { ...doc, publicKey }, { silent: true });
  store.update('settings', (s) => ({ ...s, notify: { ...notifySettings(s), on: true } }));
  await syncPush({ force: true, subscription: sub });
  return { ok: true };
}

/** Turn notifications off on this phone and tell the server to forget it. */
export async function disablePush() {
  const doc = store.get('push');
  store.update('settings', (s) => ({ ...s, notify: { ...notifySettings(s), on: false } }));
  store.set('push', doc?.id ? { id: doc.id } : null, { silent: true });
  try { if (doc?.id && pushConfigured()) await api('/unsubscribe', { id: doc.id }); } catch { /* offline: it lapses on its own */ }
  try { const reg = 'serviceWorker' in navigator ? await registration(1500) : null; await (await reg?.pushManager?.getSubscription())?.unsubscribe(); } catch { /* nothing to undo */ }
}

/** Send the server your current plan. Skipped when nothing changed in the last 12 hours, unless forced. */
export async function syncPush({ force = false, subscription = null } = {}) {
  if (!isOn()) return;
  const sub = subscription || await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  const state = ctx();
  const n = notifySettings(state.settings);
  const { plan, done, week } = reminderPlan(state);
  const doc = pushDoc();
  const payload = {
    id: doc.id, subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminders: { on: n.reminders, time: n.time }, milestones: n.milestones, plan, week, done,
  };
  const hash = fingerprint(JSON.stringify(payload));
  if (!force && doc.hash === hash && Date.now() - (doc.syncedAt || 0) < 12 * 3600 * 1000) return;
  await api('/sync', payload);
  store.set('push', { ...store.get('push'), hash, syncedAt: Date.now() }, { silent: true });
}

/** After a session is saved: refresh the plan and announce any new milestones. */
export async function afterFinish(milestones = []) {
  if (!isOn()) return;
  await syncPush({ force: true }).catch(() => {});
  if (!milestones.length || !notifySettings(store.get('settings')).milestones) return;
  const [first] = milestones;
  await api('/notify', {
    id: pushDoc().id, tag: 'milestone',
    title: milestones.length === 1 ? `New milestone: ${first.title}` : `${milestones.length} new milestones`,
    body: milestones.length === 1 ? `${first.sub}. Nice work!` : milestones.map((m) => m.title).join(' · '),
  }).catch(() => {});
}

export async function sendTest() {
  await api('/notify', { id: pushDoc().id, tag: 'test', title: 'Notifications are on', body: 'This is how your reminders and milestones will look.' });
}

/** Keep the server's copy of your plan fresh as things change. */
export function initPush() {
  if (!pushConfigured()) return;
  const later = debounce(() => syncPush().catch(() => {}), 2500);
  store.subscribe((name) => {
    if (name === '*' || name === 'schedule' || name === 'profile' || name === 'settings' || name === 'custom' || name.startsWith('sessions-')) later();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(); });
  later();
}
