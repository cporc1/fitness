// Rest timer, pool pace clock, sound cues and screen wake lock.

import { h, s, fmtClock } from './util.js';

const state = { endsAt: 0, duration: 0, label: '', kind: 'gym', running: false, beeped: false };
const listeners = new Set();
let tickHandle = null;
let soundOn = true;

export function configure({ sound }) { soundOn = sound !== false; }
export function restState() { return { ...state, remaining: remaining() }; }
export function onRestChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function remaining() { return state.running ? (state.endsAt - Date.now()) / 1000 : 0; }

function emit() { for (const fn of listeners) fn(restState()); }

function tick() {
  if (!state.running) return;
  const rem = remaining();
  if (rem <= 0 && !state.beeped) {
    state.beeped = true;
    beep([0, 0.25, 0.5], 880);
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
  }
  if (rem < -90) { stopRest(); return; } // auto-dismiss 90 s after the rest ends
  emit();
}

export function startRest(seconds, { label = 'Rest', kind = 'gym' } = {}) {
  if (!seconds || seconds <= 0) return;
  Object.assign(state, { endsAt: Date.now() + seconds * 1000, duration: seconds, label, kind, running: true, beeped: false });
  clearInterval(tickHandle);
  tickHandle = setInterval(tick, 250);
  emit();
}

export function adjustRest(delta) {
  if (!state.running) return;
  state.endsAt += delta * 1000;
  state.duration = Math.max(1, state.duration + delta);
  if (remaining() > 0) state.beeped = false;
  emit();
}

export function stopRest() {
  state.running = false;
  clearInterval(tickHandle);
  tickHandle = null;
  emit();
}

// ---------------- sound ----------------

let audioCtx = null;
export function unlockAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { audioCtx = null; }
}

export function beep(offsets = [0], freq = 880) {
  if (!soundOn || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    for (const off of offsets) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + off);
      gain.gain.exponentialRampToValueAtTime(0.35, now + off + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + off);
      osc.stop(now + off + 0.2);
    }
  } catch { /* audio unavailable */ }
}

// ---------------- wake lock ----------------

let wakeLock = null;
let wantWake = false;

async function acquire() {
  if (!wantWake || wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
    wakeLock?.addEventListener?.('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}

export function keepAwake(on) {
  wantWake = !!on;
  if (wantWake) acquire();
  else if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { acquire(); tick(); }
});

// ---------------- pace clock ----------------

const C = 100; // centre
const R = 92;

function polar(angleDeg, radius) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function arcPath(startDeg, endDeg, radius) {
  const span = Math.max(0.01, Math.min(359.99, endDeg - startDeg));
  const [x1, y1] = polar(startDeg, radius);
  const [x2, y2] = polar(startDeg + span, radius);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * A swim-pool pace clock. The red hand follows the real seconds, like the
 * clock on the pool wall; the coloured arc is the rest still to go.
 * Returns { el, update(restState) }.
 */
export function paceClock() {
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const [x1, y1] = polar(i * 6, R - (major ? 12 : 6));
    const [x2, y2] = polar(i * 6, R - 2);
    ticks.push(s('line', { class: `tick${major ? ' major' : ''}`, x1, y1, x2, y2 }));
  }
  const labels = [60, 15, 30, 45].map((n, i) => {
    const [x, y] = polar(i * 90, R - 36);
    return s('text', { class: 'label', x, y }, String(n));
  });
  const arc = s('path', { class: 'arc', d: '' });
  const hand = s('line', { class: 'hand', x1: C, y1: C, x2: C, y2: C - R + 16 });
  const readout = s('text', { class: 'readout', x: C, y: C + 26 }, '0:00');
  const el = s('svg', { class: 'pace-clock', viewBox: '0 0 200 200', role: 'img', 'aria-label': 'Rest timer' },
    s('circle', { class: 'face', cx: C, cy: C, r: R }),
    ...ticks, ...labels, arc, hand,
    s('circle', { class: 'hub', cx: C, cy: C, r: 5 }),
    readout);

  function update(rs) {
    const now = new Date();
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    const [hx, hy] = polar(sec * 6, R - 16);
    hand.setAttribute('x2', hx.toFixed(2));
    hand.setAttribute('y2', hy.toFixed(2));
    arc.setAttribute('class', `arc${rs.kind === 'gym' ? ' gym' : ''}`);
    const rem = Math.max(0, rs.remaining);
    if (rs.running && rem > 0) {
      const start = sec * 6;
      arc.setAttribute('d', arcPath(start, start + Math.min(rem, 59.9) * 6, R - 20));
    } else {
      arc.setAttribute('d', '');
    }
    readout.textContent = rs.running ? (rs.remaining > 0 ? fmtClock(Math.ceil(rs.remaining)) : 'Go') : '0:00';
  }
  update(restState());
  return { el, update };
}

/** Small progress ring used in the rest bar. */
export function miniClock() {
  const arc = s('path', { class: 'arc', d: '' });
  const el = s('svg', { class: 'mini-clock rb-clock', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
    s('circle', { class: 'face', cx: C, cy: C, r: 78 }), arc);
  function update(rs) {
    const frac = rs.duration ? Math.max(0, rs.remaining) / rs.duration : 0;
    arc.setAttribute('d', frac > 0 ? arcPath(0, frac * 360, 78) : '');
  }
  return { el, update };
}

/** A large ring that empties as a countdown runs. update(remaining, total). */
export function countdownRing(className = '') {
  const arc = s('path', { class: 'arc', d: '' });
  const el = s('svg', { class: `count-ring ${className}`.trim(), viewBox: '0 0 200 200', 'aria-hidden': 'true' },
    s('circle', { class: 'face', cx: C, cy: C, r: 88 }), arc);
  function update(rem, total) {
    const frac = total ? Math.max(0, Math.min(1, rem / total)) : 0;
    arc.setAttribute('d', frac > 0 ? arcPath(0, frac * 360, 88) : '');
  }
  return { el, update };
}

/** The rest bar pinned to the bottom during a session. */
export function restBar({ onOpen } = {}) {
  const clock = miniClock();
  const time = h('div', { class: 'rb-time' }, '0:00');
  const label = h('div', { class: 'rb-label' }, 'Rest');
  const bar = h('div', { class: 'rest-bar', hidden: true, role: 'timer', 'aria-live': 'off' },
    clock.el,
    h('button', { class: 'grow', style: { background: 'none', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }, onclick: () => onOpen?.(), 'aria-label': 'Show pace clock' },
      label, time),
    h('button', { class: 'rb-btn', onclick: () => adjustRest(-15), 'aria-label': 'Subtract 15 seconds' }, '−15'),
    h('button', { class: 'rb-btn', onclick: () => adjustRest(15), 'aria-label': 'Add 15 seconds' }, '+15'),
    h('button', { class: 'rb-btn', onclick: () => stopRest() }, 'Skip'));
  function update(rs) {
    bar.hidden = !rs.running;
    if (!rs.running) return;
    const over = rs.remaining <= 0;
    bar.classList.toggle('over', over);
    time.textContent = over ? `+${fmtClock(-rs.remaining)}` : fmtClock(Math.ceil(rs.remaining));
    label.textContent = over ? 'Rest done. Go!' : rs.label;
    clock.update(rs);
  }
  update(restState());
  const off = onRestChange(update);
  return { el: bar, destroy: off };
}
