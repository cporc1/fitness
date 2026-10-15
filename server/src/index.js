// Lift & Lap push server: a Cloudflare Worker with one Durable Object.
//
// The app (on your iPhone, added to the Home Screen) subscribes to push and
// sends its upcoming plan here. The Durable Object keeps that, wakes up with
// an alarm at your reminder time, and sends the notification through Apple's
// (or any browser's) push service. Milestones are sent right away.
//
//   GET  /vapid        the public key the app subscribes with
//   POST /sync         { id, subscription, tz, reminders, milestones, plan, week, done }
//   POST /notify       { id, title, body, tag? }   send now (milestones, test)
//   POST /unsubscribe  { id }
//
// The VAPID keys are made on first use and kept in the Durable Object, so
// there is nothing to configure besides ALLOWED_ORIGINS and VAPID_SUBJECT.

import { generateVapidKeys, sendPush } from './webpush.js';
import { nextSend, localDate, zonedInstant } from './schedule.js';

const PUSH_HOSTS = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'notify.windows.com'];
const MAX_USERS = 20;
const MAX_NOTIFY_PER_DAY = 30;
const ID = /^[A-Za-z0-9-]{16,64}$/;

const clip = (v, n) => String(v ?? '').slice(0, n);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

/** A subscription we'll send to: https on a known push service (or a test host when allowed). */
export function validSubscription(sub, env) {
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  let url;
  try { url = new URL(sub.endpoint); } catch { return false; }
  if (env.TEST_PUSH_ORIGIN && url.origin === env.TEST_PUSH_ORIGIN) return true;
  return url.protocol === 'https:' && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

/** Keep only what the server needs from the app's sync, with sane sizes. */
export function cleanSync(body, env) {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!ID.test(body?.id || '')) return { error: 'bad id' };
  if (!validSubscription(body.subscription, env)) return { error: 'bad subscription' };
  try { new Intl.DateTimeFormat('en-US', { timeZone: body.tz }); } catch { return { error: 'bad time zone' }; }
  return {
    id: body.id,
    subscription: { endpoint: body.subscription.endpoint, keys: { p256dh: clip(body.subscription.keys.p256dh, 200), auth: clip(body.subscription.keys.auth, 100) } },
    tz: clip(body.tz, 64),
    reminders: { on: body.reminders?.on === true, time: /^\d{2}:\d{2}$/.test(body.reminders?.time || '') ? body.reminders.time : '08:00' },
    milestones: body.milestones === true,
    plan: (Array.isArray(body.plan) ? body.plan : []).slice(0, 80)
      .filter((e) => date.test(e?.date || '') && (e.kind === 'workout' || e.kind === 'program'))
      .map((e) => ({ date: e.date, kind: e.kind, title: clip(e.title, 80), body: clip(e.body, 200) })),
    week: Array.isArray(body.week) && body.week.length === 7 ? body.week.map((s) => clip(s, 40)) : null,
    done: (Array.isArray(body.done) ? body.done : []).filter((d) => date.test(d || '')).slice(-14),
  };
}

export class Hub {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async vapid() {
    let keys = await this.storage.get('vapid');
    if (!keys) { keys = await generateVapidKeys(); await this.storage.put('vapid', keys); }
    return keys;
  }

  async users() {
    return [...(await this.storage.list({ prefix: 'user:' })).values()];
  }

  async send(user, message) {
    const status = await sendPush(user.subscription, message, await this.vapid(), {
      subject: this.env.VAPID_SUBJECT || 'https://cporc1.github.io/fitness/',
      fetchFn: this.env.fetchFn || fetch,
    });
    if (status === 404 || status === 410) await this.storage.delete(`user:${user.id}`); // the app was removed or turned off
    return status;
  }

  /** Point the alarm at the earliest next send across everyone. */
  async schedule(now = Date.now()) {
    let soonest = null;
    for (const user of await this.users()) {
      const next = nextSend(user, now);
      if (next && (soonest === null || next.at < soonest)) soonest = next.at;
    }
    if (soonest === null) await this.storage.deleteAlarm();
    else await this.storage.setAlarm(soonest);
    return soonest;
  }

  /** Cloudflare calls this with an info object, not a time. */
  async alarm() {
    await this.runDue(Date.now());
  }

  /** Send everything due at `now`, then set the next alarm. */
  async runDue(now) {
    for (const user of await this.users()) {
      const next = nextSend(user, now);
      if (!next || next.at > now + 30 * 1000) continue;
      await this.storage.put(`user:${user.id}`, { ...user, lastReminder: next.date });
      try { await this.send(user, next.message); } catch (err) { console.log('send failed', user.id, String(err)); }
    }
    await this.schedule(now);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();
    if (request.method === 'GET' && url.pathname === '/vapid') return json({ publicKey: (await this.vapid()).publicKey });
    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

    if (url.pathname === '/sync') {
      const clean = cleanSync(body, this.env);
      if (clean.error) return json(clean, 400);
      const key = `user:${clean.id}`;
      const old = await this.storage.get(key);
      if (!old && (await this.users()).length >= MAX_USERS) return json({ error: 'full' }, 403);
      const today = localDate(now, clean.tz);
      // A new sign-up after today's reminder time starts tomorrow, rather than with a late reminder.
      const passed = zonedInstant(today, clean.reminders.time, clean.tz) <= now;
      const lastReminder = old?.lastReminder ?? (passed ? today : null);
      await this.storage.put(key, { ...clean, lastReminder, notify: old?.notify || null, updatedAt: now });
      const next = await this.schedule(now);
      return json({ ok: true, next });
    }

    if (url.pathname === '/notify') {
      if (!ID.test(body?.id || '')) return json({ error: 'bad id' }, 400);
      const user = await this.storage.get(`user:${body.id}`);
      if (!user) return json({ error: 'not found' }, 404);
      const today = localDate(now, user.tz);
      const count = user.notify?.date === today ? user.notify.count : 0;
      if (count >= MAX_NOTIFY_PER_DAY) return json({ error: 'too many' }, 429);
      await this.storage.put(`user:${user.id}`, { ...user, notify: { date: today, count: count + 1 } });
      const status = await this.send(user, { title: clip(body.title, 80) || 'Lift & Lap', body: clip(body.body, 240), tag: clip(body.tag, 40) || undefined, url: './' });
      return json({ ok: status >= 200 && status < 300, status }, status === 404 || status === 410 ? 410 : 200);
    }

    if (url.pathname === '/unsubscribe') {
      if (!ID.test(body?.id || '')) return json({ error: 'bad id' }, 400);
      await this.storage.delete(`user:${body.id}`);
      await this.schedule(now);
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (!cors) return json({ error: 'origin not allowed' }, 403);
    const hub = env.HUB.get(env.HUB.idFromName('main'));
    const res = await hub.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
