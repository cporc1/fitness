// Reusable UI pieces: sheets, confirm dialogs, toasts and form controls.
// (The claude.ai viewer blocks alert/confirm/prompt, so dialogs are built in-page.)

import { h, icon, ICONS } from './util.js';

const root = () => document.getElementById('overlay-root');

let openSheets = 0;
function lockScroll(on) {
  openSheets += on ? 1 : -1;
  document.body.style.overflow = openSheets > 0 ? 'hidden' : '';
}

/**
 * Bottom sheet. content: Node or (close) => Node.
 * Returns { close }.
 */
export function sheet(title, content, { onClose } = {}) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scrim.remove();
    lockScroll(false);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const body = typeof content === 'function' ? content(close) : content;
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grabber' }),
    h('div', { class: 'sheet-head' },
      h('h2', null, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon(ICONS.close))),
    body);
  const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } }, panel);
  root().append(scrim);
  lockScroll(true);
  document.addEventListener('keydown', onKey);
  return { close, panel };
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
