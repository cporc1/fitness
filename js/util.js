// Small shared helpers: DOM building, dates, units and formatting.

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'value' && 'value' in el) el.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'selected') el[key] = !!value;
    else el.setAttribute(key, value === true ? '' : value);
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** h('div', {class: 'card', onclick}, 'text', h('span', null, 'child')) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

/** Append children, skipping null/false (native append would print "null"). */
export function put(el, ...children) {
  appendChildren(el, children);
  return el;
}

/** Replace all children, skipping null/false. */
export function fill(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
  return el;
}

/** SVG flavour of h(). */
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value);
    }
  }
  appendChildren(el, children);
  return el;
}

/** Inline stroke icon from a list of SVG path strings. */
export function icon(paths, size = 22) {
  return s('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  }, ...[].concat(paths).map((d) => s('path', { d })));
}

export const ICONS = {
  today: ['M4 5h16v15H4z', 'M4 9h16', 'M8 3v4', 'M16 3v4', 'M8 13h3v3H8z'],
  plan: ['M5 4h14v16H5z', 'M9 8h6', 'M9 12h6', 'M9 16h4'],
  log: ['M12 7v5l3 2', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'],
  progress: ['M4 19h16', 'M6 15l4-4 3 3 5-6', 'M15 8h3v3'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  back: ['M15 5l-7 7 7 7'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
  swap: ['M7 7h11l-3-3', 'M17 17H6l3 3'],
  trash: ['M5 7h14', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  play: ['M8 5v14l11-7z'],
  timer: ['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 9v4l2 2', 'M10 2h4'],
  chevron: ['M9 5l7 7-7 7'],
  dumbbell: ['M3 10v4', 'M6 7v10', 'M18 7v10', 'M21 10v4', 'M6 12h12'],
  wave: ['M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2', 'M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2'],
  rest: ['M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'],
  book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19V5', 'M8 7h7'],
  tool: ['M14 7l3-3 3 3-3 3', 'M17 7L7 17', 'M4 20l3-3'],
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z'],
  scale: ['M5 4h14l1 16H4z', 'M12 8l2 3', 'M9 8h6'],
  flag: ['M5 21V4', 'M5 4h12l-2 4 2 4H5'],
  note: ['M5 4h14v16H5z', 'M8 9h8', 'M8 13h8', 'M8 17h5'],
  drop: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'],
  bolt: ['M13 3L5 14h6l-1 7 8-11h-6z'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  upload: ['M12 20V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8'],
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  dots: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  calendar: ['M4 5h16v15H4z', 'M4 9h16', 'M8 3v4', 'M16 3v4'],
};

// ---------- dates (local calendar days as 'YYYY-MM-DD') ----------

export function pad2(n) { return String(n).padStart(2, '0'); }

export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() { return toISODate(new Date()); }

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(aIso, bIso) {
  const a = parseISODate(aIso);
  const b = parseISODate(bIso);
  return Math.round((b - a) / 86400000);
}

/** Monday of the week containing iso. */
export function weekStart(iso) {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(iso) {
  return (parseISODate(iso).getDay() + 6) % 7;
}

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtDate(iso, opts = {}) {
  const d = parseISODate(iso);
  const base = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  const withYear = opts.year || d.getFullYear() !== new Date().getFullYear();
  const day = opts.weekday ? `${WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}, ` : '';
  return day + base + (withYear ? `, ${d.getFullYear()}` : '');
}

export function fmtMonth(year, monthIndex) { return `${MONTHS_LONG[monthIndex]} ${year}`; }

export function relativeDay(iso) {
  const diff = daysBetween(iso, todayISO());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return fmtDate(iso);
}

// ---------- durations ----------

export function fmtClock(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  const hrs = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const s2 = sec % 60;
  return hrs ? `${hrs}:${pad2(min)}:${pad2(s2)}` : `${min}:${pad2(s2)}`;
}

export function fmtDuration(totalSec) {
  const min = Math.round(totalSec / 60);
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  return `${hrs} h ${pad2(min % 60)} min`;
}

/** Parses "1:45", "1:45.2", "105" → seconds */
export function parseClock(str) {
  if (str === null || str === undefined) return null;
  const t = String(str).trim();
  if (!t) return null;
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// ---------- numbers & units ----------

export const KG_PER_LB = 0.45359237;

export function round(n, step = 1) {
  return Math.round(n / step) * step;
}

export function fmtNum(n, maxDecimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const f = 10 ** maxDecimals;
  const r = Math.round(n * f) / f;
  return r.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

export function toNumber(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

export function uid(prefix = '') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

export function deepClone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

export function plural(n, word, pluralWord) {
  return `${fmtNum(n, 1)} ${n === 1 ? word : (pluralWord || `${word}s`)}`;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function youtubeSearch(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
