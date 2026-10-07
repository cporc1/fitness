// Motion and transparency preferences. The app follows the iPhone's Reduce
// Motion setting, and Settings → Appearance can turn motion or glass down
// further (Safari has no "reduce transparency" media query).

import * as store from './store.js';

const systemReduce = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** True when animations should be replaced by instant changes or short fades. */
export function reducedMotion() {
  return store.get('settings')?.reduceMotion === true || systemReduce();
}

/** Mirror the in-app preferences onto <html> so CSS can react. */
export function applyMotionPrefs(settings) {
  const root = document.documentElement;
  root.classList.toggle('reduce-motion', settings?.reduceMotion === true);
  root.classList.toggle('reduce-transparency', settings?.reduceTransparency === true);
}

const easings = {};
/** A spring easing from the CSS tokens (--ease-<name>), usable with element.animate(). */
export function easing(name, fallback = 'cubic-bezier(.2, .8, .2, 1)') {
  if (!(name in easings)) {
    let v = '';
    try { v = getComputedStyle(document.documentElement).getPropertyValue(`--ease-${name}`).trim(); } catch { /* no DOM */ }
    easings[name] = v && window.CSS?.supports?.('transition-timing-function', v) ? v : fallback;
  }
  return easings[name];
}

/**
 * Count a number up (or down) inside `el`, from `from` to `to`, writing
 * format(value) each frame. Instant when motion is reduced.
 */
export function countUp(el, from, to, format, duration = 650) {
  if (reducedMotion() || from === to || !Number.isFinite(from) || !Number.isFinite(to)) { el.textContent = format(to); return; }
  const start = performance.now();
  el.textContent = format(from);
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = format(from + (to - from) * eased);
    if (t < 1 && el.isConnected !== false) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** A water ripple spreading from the tap point inside `el` (which needs overflow: hidden). */
export function ripple(el, point) {
  if (reducedMotion() || !el) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.2;
  const x = (point?.x ?? rect.left + rect.width / 2) - rect.left - size / 2;
  const y = (point?.y ?? rect.top + rect.height / 2) - rect.top - size / 2;
  const dot = document.createElement('span');
  dot.className = 'ripple';
  Object.assign(dot.style, { width: `${size}px`, height: `${size}px`, left: `${x}px`, top: `${y}px` });
  el.append(dot);
  setTimeout(() => dot.remove(), 700);
}

/** A short burst of confetti in the app's colours. Skipped with reduced motion. */
export function confetti(colors = ['#b16009', '#f0a23c', '#09709a', '#44b4e0', '#1d7f4a', '#4cc48a']) {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (canvas.width = window.innerWidth * dpr);
  const H = (canvas.height = window.innerHeight * dpr);
  const g = canvas.getContext('2d');
  if (!g) { canvas.remove(); return; }
  const pieces = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.25, y: H * 0.32,
    vx: (Math.random() - 0.5) * 15 * dpr, vy: (-Math.random() * 13 - 7) * dpr,
    w: (5 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const life = 1700;
  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    g.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vy += 0.38 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.globalAlpha = Math.max(0, 1 - t / life);
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (t < life) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
