// Web Push: sending one notification to one browser subscription.
// VAPID (RFC 8292) proves the message comes from this server, and the
// payload is encrypted for the browser with "aes128gcm" (RFC 8291, 8188).
// Only Web Crypto is used, so this runs in a Cloudflare Worker and in Node.

const enc = new TextEncoder();

export function b64u(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64u(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

/** A new VAPID key pair: the public key as a base64url point, the private key as a JWK. */
export async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
  };
}

/** The Authorization header for a push service: "vapid t=<signed JWT>, k=<public key>". */
export async function vapidAuth(endpoint, vapid, subject, now = Date.now()) {
  const part = (obj) => b64u(enc.encode(JSON.stringify(obj)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: subject })}`;
  const { key_ops: _ops, ...jwk } = vapid.privateJwk;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${vapid.publicKey}`;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/**
 * Encrypt a payload for a subscription as one aes128gcm record. `salt` and
 * `localKeys` (an ECDH key pair) are random unless given, for tests.
 */
export async function encryptPayload(subscription, payload, { salt, localKeys } = {}) {
  const uaPublic = fromB64u(subscription.keys.p256dh);
  const authSecret = fromB64u(subscription.keys.auth);
  const local = localKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const s = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const plain = concat(typeof payload === 'string' ? enc.encode(payload) : payload, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));
  // Header: salt, record size (4096), key id length, then the server's public key.
  const header = new Uint8Array(21 + asPublic.length);
  header.set(s, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/**
 * Send a notification ({ title, body, tag, url }) to a subscription.
 * Returns the push service's HTTP status: 201 means accepted, 404 or 410
 * means the subscription is gone and should be forgotten.
 */
export async function sendPush(subscription, data, vapid, { subject, ttl = 12 * 3600, urgency = 'normal', fetchFn = fetch } = {}) {
  const body = await encryptPayload(subscription, JSON.stringify(data));
  const res = await fetchFn(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(subscription.endpoint, vapid, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
    },
    body,
  });
  return res.status;
}
