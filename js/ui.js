// Reusable UI pieces: sheets, confirm dialogs, toasts and form controls.
// (The claude.ai viewer blocks alert/confirm/prompt, so dialogs are built in-page.)

import { h, s as svg, icon, ICONS, put } from './util.js';
import { reducedMotion, easing } from './motion.js';

const root = () => document.getElementById('overlay-root');

let openSheets = 0;
let stackTimer = null;
function lockScroll(on) {
  openSheets += on ? 1 : -1;
  document.body.style.overflow = openSheets > 0 ? 'hidden' : '';
}

/** The page behind sheets shrinks back (CSS: html.sheet-open), and grows again on close. */
function cardStack(open) {
  const root = document.documentElement;
  clearTimeout(stackTimer);
  if (open) {
    root.style.setProperty('--vy', `${window.scrollY}px`);
    root.classList.remove('sheet-closing');
    root.classList.add('sheet-open');
  } else if (root.classList.contains('sheet-open')) {
    root.classList.replace('sheet-open', 'sheet-closing');
    stackTimer = setTimeout(() => root.classList.remove('sheet-closing'), 460);
  }
}

const sheetStack = []; // Escape closes only the top sheet
const DISMISS_FRACTION = 0.3; // drag past 30% of the height to close
const FLICK_SPEED = 0.6; // or flick down faster than this (px/ms)

function translateY(el) {
  const t = getComputedStyle(el).transform;
  return t && t !== 'none' ? new DOMMatrixReadOnly(t).m42 : 0;
}

/**
 * Bottom sheet, sized to its content up to 92% of the screen. It slides up,
 * and drags down to close: by the grabber or header, or by the content once
 * it's scrolled to the top. content: Node or (close) => Node.
 * Returns { close, panel, body }.
 */
export function sheet(title, content, { onClose } = {}) {
  let closed = false;
  const opener = document.activeElement;
  const body = h('div', { class: 'sheet-body' });
  const top = h('div', { class: 'sheet-top' },
    h('div', { class: 'grabber', 'aria-hidden': 'true' }),
    h('div', { class: 'sheet-head' },
      h('h2', null, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, icon(ICONS.close))));
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' }, top, body);
  const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } }, panel);
  const me = { close };

  function close() {
    if (closed) return;
    closed = true;
    sheetStack.splice(sheetStack.indexOf(me), 1);
    document.removeEventListener('keydown', onKey);
    if (!sheetStack.length) cardStack(false);
    const finish = () => {
      scrim.remove();
      lockScroll(false);
      onClose?.();
      if (opener?.isConnected && !sheetStack.length) opener.focus?.({ preventScroll: true });
    };
    if (reducedMotion()) { finish(); return; }
    const from = translateY(panel);
    panel.style.transform = '';
    panel.animate([{ transform: `translateY(${from}px)` }, { transform: 'translateY(100%)' }], { duration: 260, easing: 'cubic-bezier(.4, 0, .9, .6)', fill: 'forwards' });
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished.then(finish, finish);
  }
  const onKey = (e) => { if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === me) close(); };

  // ----- dragging -----
  let drag = null;
  function dragStart(y) {
    for (const a of panel.getAnimations()) a.cancel();
    drag = { startY: y, lastY: y, lastT: performance.now(), v: 0, dy: 0 };
  }
  function dragMove(y) {
    const now = performance.now();
    const raw = y - drag.startY;
    drag.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2; // rubber-band when pulled up
    drag.v = (y - drag.lastY) / Math.max(1, now - drag.lastT);
    drag.lastY = y;
    drag.lastT = now;
    panel.style.transform = `translateY(${drag.dy}px)`;
    scrim.style.setProperty('--scrim', String(1 - Math.min(1, Math.max(0, drag.dy) / panel.offsetHeight)));
  }
  function dragEnd() {
    const { dy, v } = drag;
    drag = null;
    if (dy > panel.offsetHeight * DISMISS_FRACTION || (v > FLICK_SPEED && dy > 10)) { close(); return; }
    panel.style.transform = '';
    scrim.style.removeProperty('--scrim');
    if (!reducedMotion()) panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 320, easing: easing('snappy') });
  }
  top.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    top.setPointerCapture?.(e.pointerId);
    dragStart(e.clientY);
  });
  top.addEventListener('pointermove', (e) => { if (drag) dragMove(e.clientY); });
  top.addEventListener('pointerup', () => { if (drag) dragEnd(); });
  top.addEventListener('pointercancel', () => { if (drag) dragEnd(); });
  // The content drags the sheet only when it's already scrolled to the top.
  let touch = null;
  body.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, atTop: body.scrollTop <= 0 };
  }, { passive: true });
  body.addEventListener('touchmove', (e) => {
    if (!touch || e.touches.length > 1) return;
    const t = e.touches[0];
    if (!drag) {
      const dy = t.clientY - touch.y;
      const dx = t.clientX - touch.x;
      if (!touch.atTop || body.scrollTop > 0 || dy < 8 || Math.abs(dx) > dy) return;
      dragStart(touch.y);
    }
    e.preventDefault();
    dragMove(t.clientY);
  }, { passive: false });
  const endTouch = () => { touch = null; if (drag) dragEnd(); };
  body.addEventListener('touchend', endTouch);
  body.addEventListener('touchcancel', endTouch);

  put(body, typeof content === 'function' ? content(close) : content);
  root().append(scrim);
  if (!sheetStack.length) cardStack(true);
  sheetStack.push(me);
  lockScroll(true);
  document.addEventListener('keydown', onKey);
  panel.focus({ preventScroll: true });
  return { close, panel, body };
}

/** Promise<boolean> confirmation dialog. */
export function confirmDialog({ title, message, confirm = 'Confirm', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => {
      scrim.remove();
      lockScroll(false);
      resolve(v);
    };
    const scrim = h('div', { class: 'scrim dialog-scrim', onclick: (e) => { if (e.target === scrim) done(false); } },
      h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', null, title),
        message ? h('p', { class: 'ink-2' }, message) : null,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: () => done(false) }, cancel),
          h('button', { class: `btn ${danger ? 'danger' : 'pool'}`, onclick: () => done(true) }, confirm))));
    root().append(scrim);
    lockScroll(true);
    scrim.querySelector('.btn:last-child').focus();
  });
}

let toastTimer;
export function toast(message, ms = 2600) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' });
    document.body.append(wrap);
  }
  wrap.replaceChildren(h('div', { class: 'toast' }, message));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => wrap.replaceChildren(), ms);
}

export function topbar({ title, onBack, actions = [] }) {
  const bar = h('header', { class: 'topbar' },
    onBack ? h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: onBack }, icon(ICONS.back)) : h('span', { style: { width: '8px' } }),
    h('div', { class: 'title' }, title || ''),
    ...actions);
  return bar;
}

export function pageHead(title, eyebrow, extra) {
  return h('div', { class: 'page-head' },
    eyebrow ? h('div', { class: 'eyebrow' }, eyebrow) : null,
    h('h1', null, title),
    extra || null);
}

export function sectionHead(title, linkText, onLink) {
  return h('div', { class: 'section-head' },
    h('h2', null, title),
    linkText ? h('button', { class: 'link', onclick: onLink }, linkText) : null);
}

/** Segmented control. options: [{value, label}] */
export function segmented(options, value, onChange, label) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label || '' });
  for (const opt of options) {
    wrap.append(h('button', {
      type: 'button', 'aria-pressed': String(opt.value === value),
      onclick: () => {
        for (const b of wrap.children) b.setAttribute('aria-pressed', 'false');
        wrap.children[options.indexOf(opt)].setAttribute('aria-pressed', 'true');
        onChange(opt.value);
      },
    }, opt.label));
  }
  return wrap;
}

let fieldSeq = 0;
export function field(label, control, hint) {
  const id = control.id || `f${++fieldSeq}`;
  control.id = id;
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    control,
    hint ? h('div', { class: 'hint' }, hint) : null);
}

export function input(props = {}) {
  return h('input', { class: 'input', autocomplete: 'off', ...props });
}

export function select(options, value, props = {}) {
  const el = h('select', { class: 'input', ...props });
  for (const o of options) el.append(h('option', { value: o.value, selected: o.value === value }, o.label));
  return el;
}

export function listItem({ title, sub, leading, trailing, onclick }) {
  return h('button', { class: 'list-item', type: 'button', onclick },
    leading || null,
    h('div', { class: 'grow' },
      h('div', { class: 'li-title' }, title),
      sub ? h('div', { class: 'li-sub' }, sub) : null),
    trailing !== undefined ? trailing : h('span', { class: 'chev' }, icon(ICONS.chevron, 18)));
}

export function emptyState(text) {
  return h('div', { class: 'chart-empty' }, text);
}

/** Lane-line decoration for the hero card. */
export function lanes(kind) {
  const color = kind === 'gym' ? 'var(--iron)' : 'var(--pool)';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lanes');
  svg.setAttribute('viewBox', '0 0 120 200');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 30;
    for (let y = 0; y < 200; y += 14) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 4); r.setAttribute('height', 9); r.setAttribute('rx', 2);
      r.setAttribute('fill', color);
      r.setAttribute('opacity', String(0.12 + i * 0.06));
      svg.append(r);
    }
  }
  return svg;
}

/**
 * Progress ring. frac 0–1; `from` (0–1) is where the sweep starts when
 * animate is true, so a ring can close from its previous value.
 */
export function ring(frac, cls, animate = false, from = 0, size = 40) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const off = (f) => (c * (1 - Math.max(0, Math.min(1, f)))).toFixed(2);
  return svg('svg', { class: `ring ${cls}${animate ? ' animate' : ''}`, viewBox: '0 0 40 40', width: size, height: size, 'aria-hidden': 'true' },
    svg('circle', { class: 'ring-track', cx: 20, cy: 20, r }),
    svg('circle', {
      class: 'ring-fill', cx: 20, cy: 20, r,
      'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': off(frac), style: `--c: ${off(from)}`,
    }));
}
