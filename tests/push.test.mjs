// Push server: encryption, VAPID, time zones and the reminder hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';

import { b64u, fromB64u, encryptPayload, vapidAuth, generateVapidKeys, sendPush } from '../server/src/webpush.js';
import { tzOffset, zonedInstant, localDate, messageFor, nextSend, addDaysIso } from '../server/src/schedule.js';
import { Hub, cleanSync, corsHeaders } from '../server/src/index.js';

// RFC 8291, section 5 and appendix A.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

const jwkFor = (pub, priv) => {
  const p = fromB64u(pub);
  return { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: priv, ext: true };
};

/** Decrypt the way a browser would, with Node's own crypto (independent of the Web Crypto code). */
function decrypt(body, uaPrivateB64, uaPublicB64, authB64) {
  const salt = body.subarray(0, 16);
  const rs = body.readUInt32BE(16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const cipher = body.subarray(21 + idlen);
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(fromB64u(uaPrivateB64)));
  const shared = ecdh.computeSecret(asPublic);
  const uaPublic = Buffer.from(fromB64u(uaPublicB64));
  const ikm = Buffer.from(nodeCrypto.hkdfSync('sha256', shared, Buffer.from(fromB64u(authB64)), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'last record ends with the 0x02 delimiter');
  assert.ok(rs >= cipher.length, 'one record');
  return plain.subarray(0, plain.length - 1).toString('utf8');
}

/** A browser-like subscription with keys we can decrypt with. */
function fakeSubscription(endpoint = 'https://web.push.apple.com/QGuQyavXutnMH8yVlTyZtV') {
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    sub: { endpoint, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(nodeCrypto.randomBytes(16)) } },
    priv: b64u(ecdh.getPrivateKey()),
  };
}

test('aes128gcm matches the RFC 8291 worked example byte for byte', async () => {
  const subtle = globalThis.crypto.subtle;
  const privateKey = await subtle.importKey('jwk', jwkFor(RFC.asPublic, RFC.asPrivate), { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const { d, ...pubJwk } = jwkFor(RFC.asPublic, RFC.asPrivate);
  const publicKey = await subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const body = await encryptPayload({ keys: { p256dh: RFC.uaPublic, auth: RFC.auth } }, RFC.plaintext, { salt: fromB64u(RFC.salt), localKeys: { privateKey, publicKey } });
  assert.equal(b64u(body), RFC.body);
  assert.equal(decrypt(Buffer.from(body), RFC.uaPrivate, RFC.uaPublic, RFC.auth), RFC.plaintext);
});

test('random payloads decrypt with an independent implementation', async () => {
  const { sub, priv } = fakeSubscription();
  const text = JSON.stringify({ title: 'Gym today: Full Body B', body: 'Warm-up, 6 exercises, cool-down. ✓' });
  const body = await encryptPayload(sub, text);
  assert.equal(decrypt(Buffer.from(body), priv, sub.keys.p256dh, sub.keys.auth), text);
});

test('VAPID: a signed ES256 JWT for the push service origin, valid for an hour', async () => {
  const vapid = await generateVapidKeys();
  const now = Date.UTC(2026, 9, 15, 12);
  const header = await vapidAuth('https://web.push.apple.com/QGuQyavXutnMH8yVlTyZtV', vapid, 'https://cporc1.github.io/fitness/', now);
  const m = header.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/);
  assert.ok(m, header);
  assert.equal(m[4], vapid.publicKey);
  const claims = JSON.parse(new TextDecoder().decode(fromB64u(m[2])));
  assert.deepEqual(claims, { aud: 'https://web.push.apple.com', exp: now / 1000 + 3600, sub: 'https://cporc1.github.io/fitness/' });
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromB64u(m[1]))), { typ: 'JWT', alg: 'ES256' });
  const pub = await crypto.subtle.importKey('raw', fromB64u(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64u(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`)));
});

test('sendPush posts an encrypted body with the right headers', async () => {
  const { sub, priv } = fakeSubscription();
  const vapid = await generateVapidKeys();
  let seen;
  const status = await sendPush(sub, { title: 'Hi', body: 'There' }, vapid, {
    subject: 'https://cporc1.github.io/fitness/',
    fetchFn: async (url, init) => { seen = { url, init }; return { status: 201 }; },
  });
  assert.equal(status, 201);
  assert.equal(seen.url, sub.endpoint);
  assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm');
  assert.match(seen.init.headers.Authorization, /^vapid t=/);
  assert.ok(Number(seen.init.headers.TTL) > 0);
  assert.deepEqual(JSON.parse(decrypt(Buffer.from(seen.init.body), priv, sub.keys.p256dh, sub.keys.auth)), { title: 'Hi', body: 'There' });
});

test('time zones: offsets, daylight saving and half-hour zones', () => {
  assert.equal(tzOffset(Date.UTC(2026, 6, 1), 'America/New_York'), -240);
  assert.equal(tzOffset(Date.UTC(2026, 0, 1), 'America/New_York'), -300);
  assert.equal(tzOffset(Date.UTC(2026, 0, 1), 'Asia/Kolkata'), 330);
  // 8:00 in New York on the days the clocks change (8 March and 1 November 2026).
  assert.equal(new Date(zonedInstant('2026-03-08', '08:00', 'America/New_York')).toISOString(), '2026-03-08T12:00:00.000Z');
  assert.equal(new Date(zonedInstant('2026-03-07', '08:00', 'America/New_York')).toISOString(), '2026-03-07T13:00:00.000Z');
  assert.equal(new Date(zonedInstant('2026-11-01', '08:00', 'America/New_York')).toISOString(), '2026-11-01T13:00:00.000Z');
  assert.equal(new Date(zonedInstant('2026-10-15', '18:30', 'Asia/Kolkata')).toISOString(), '2026-10-15T13:00:00.000Z');
  assert.equal(new Date(zonedInstant('2026-10-15', '07:00', 'Europe/London')).toISOString(), '2026-10-15T06:00:00.000Z');
  assert.equal(localDate(Date.UTC(2026, 9, 15, 3), 'America/Los_Angeles'), '2026-10-14');
  assert.equal(localDate(Date.UTC(2026, 9, 15, 3), 'Europe/Paris'), '2026-10-15');
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
});

const baseUser = (over = {}) => ({
  id: 'u'.repeat(20), subscription: fakeSubscription().sub, tz: 'America/New_York',
  reminders: { on: true, time: '08:00' }, milestones: true,
  plan: [
    { date: '2026-10-15', kind: 'workout', title: 'Gym and swim today', body: 'Full Body B, then Technique 2 (600 yd).' },
    { date: '2026-10-16', kind: 'workout', title: 'Swim today: Endurance 1', body: '700 yd at an easy pace.' },
    { date: '2026-10-19', kind: 'program', title: 'Phase 2 starts today', body: 'Build: the main barbell lifts arrive.' },
  ],
  week: ['gym', 'swim', 'both', 'rest', 'gym', 'rest', 'rest'],
  done: [],
  ...over,
});

test('what to send: planned workouts, skipped once done; program news; weekly fallback', () => {
  const u = baseUser();
  assert.equal(messageFor(u, '2026-10-15').title, 'Gym and swim today');
  assert.equal(messageFor({ ...u, done: ['2026-10-15'] }, '2026-10-15'), null);
  assert.equal(messageFor(u, '2026-10-17'), null); // a rest day inside the plan
  assert.equal(messageFor(u, '2026-10-19').title, 'Phase 2 starts today');
  assert.equal(messageFor({ ...u, milestones: false }, '2026-10-19'), null);
  // After the plan: Monday 26 October is a gym day in the weekly schedule, Thursday a rest day.
  assert.equal(messageFor(u, '2026-10-26').title, 'Gym day');
  assert.equal(messageFor(u, '2026-10-29'), null);
  assert.equal(messageFor({ ...u, reminders: { on: false, time: '08:00' } }, '2026-10-15'), null);
});

test('next send: today at 8:00 local, not twice, not hours late', () => {
  const u = baseUser();
  const sevenNY = Date.UTC(2026, 9, 15, 11); // 7:00 in New York
  const next = nextSend(u, sevenNY);
  assert.equal(next.date, '2026-10-15');
  assert.equal(new Date(next.at).toISOString(), '2026-10-15T12:00:00.000Z');
  assert.equal(nextSend({ ...u, lastReminder: '2026-10-15' }, sevenNY).date, '2026-10-16');
  const elevenThirty = Date.UTC(2026, 9, 15, 15, 30); // 3.5 h after the reminder time
  assert.equal(nextSend(u, elevenThirty).date, '2026-10-16');
  const halfPast = Date.UTC(2026, 9, 15, 12, 30); // 30 min late: still sent, right away
  assert.equal(nextSend(u, halfPast).at, halfPast);
  assert.equal(nextSend({ ...u, reminders: { on: false }, milestones: false }, sevenNY), null);
});

/** An in-memory Durable Object state. */
function fakeState() {
  const map = new Map();
  let alarm = null;
  return {
    storage: {
      get: async (k) => structuredClone(map.get(k)),
      put: async (k, v) => { map.set(k, structuredClone(v)); },
      delete: async (k) => map.delete(k),
      list: async ({ prefix }) => new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
      setAlarm: async (t) => { alarm = t; },
      deleteAlarm: async () => { alarm = null; },
      getAlarm: async () => alarm,
    },
    get alarm() { return alarm; },
    map,
  };
}

const post = (path, body) => new Request(`https://hub${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

test('hub: sync schedules the reminder, the alarm sends it once, milestones go out right away', async (t) => {
  const sent = [];
  const env = { VAPID_SUBJECT: 'https://cporc1.github.io/fitness/', fetchFn: async (url, init) => { sent.push({ url, init }); return { status: 201 }; } };
  const state = fakeState();
  const hub = new Hub(state, env);
  const { sub, priv } = fakeSubscription();
  const user = baseUser({ subscription: sub });
  const sevenNY = Date.UTC(2026, 9, 15, 11);
  t.mock.timers.enable({ apis: ['Date'], now: sevenNY });

  const key = await (await hub.fetch(new Request('https://hub/vapid'))).json();
  assert.match(key.publicKey, /^[\w-]{80,}$/);
  const res = await (await hub.fetch(post('/sync', user))).json();
  assert.equal(new Date(res.next).toISOString(), '2026-10-15T12:00:00.000Z');
  assert.equal(state.alarm, res.next);

  await hub.runDue(Date.UTC(2026, 9, 15, 12));
  assert.equal(sent.length, 1);
  const msg = JSON.parse(decrypt(Buffer.from(sent[0].init.body), priv, sub.keys.p256dh, sub.keys.auth));
  assert.equal(msg.title, 'Gym and swim today');
  assert.equal(new Date(state.alarm).toISOString(), '2026-10-16T12:00:00.000Z', 'then tomorrow');
  await hub.runDue(Date.UTC(2026, 9, 15, 12, 1));
  assert.equal(sent.length, 1, 'never twice for the same day');

  // Trained already on the 16th: no reminder, next one is the program news on the 19th.
  await hub.fetch(post('/sync', { ...user, done: ['2026-10-15', '2026-10-16'] }));
  assert.equal(new Date(state.alarm).toISOString(), '2026-10-19T12:00:00.000Z');

  const n = await (await hub.fetch(post('/notify', { id: user.id, title: 'New milestone: 10 workouts', body: 'A habit is forming.' }))).json();
  assert.equal(n.ok, true);
  assert.equal(JSON.parse(decrypt(Buffer.from(sent[1].init.body), priv, sub.keys.p256dh, sub.keys.auth)).title, 'New milestone: 10 workouts');
});

test('hub: a new sign-up after today\'s time starts tomorrow; gone subscriptions are forgotten', async (t) => {
  let status = 201;
  const env = { fetchFn: async () => ({ status }) };
  const state = fakeState();
  const hub = new Hub(state, env);
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 15, 12, 30) }); // 8:30 in New York
  const user = baseUser();
  const res = await (await hub.fetch(post('/sync', user))).json();
  assert.equal(new Date(res.next).toISOString(), '2026-10-16T12:00:00.000Z');
  status = 410;
  await hub.runDue(Date.UTC(2026, 9, 16, 12));
  assert.equal(state.map.has(`user:${user.id}`), false);
  assert.equal(state.alarm, null);
});

test('hub: rejects bad input', async () => {
  const hub = new Hub(fakeState(), {});
  const user = baseUser();
  assert.equal((await hub.fetch(post('/sync', { ...user, id: 'short' }))).status, 400);
  assert.equal((await hub.fetch(post('/sync', { ...user, subscription: { ...user.subscription, endpoint: 'https://evil.example/x' } }))).status, 400);
  assert.equal((await hub.fetch(post('/sync', { ...user, tz: 'Mars/Olympus' }))).status, 400);
  assert.equal((await hub.fetch(post('/notify', { id: 'v'.repeat(20) }))).status, 404);
  const clean = cleanSync({ ...user, plan: [{ date: 'x', kind: 'workout' }, { date: '2026-10-15', kind: 'spam', title: 'x' }] }, {});
  assert.deepEqual(clean.plan, []);
  assert.ok(corsHeaders('https://cporc1.github.io', { ALLOWED_ORIGINS: 'https://cporc1.github.io' }));
  assert.equal(corsHeaders('https://evil.example', { ALLOWED_ORIGINS: 'https://cporc1.github.io' }), null);
});
