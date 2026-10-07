// Navigation: one page stack per tab, kept in step with the browser history
// so the iPhone's edge swipe (and any back button) goes back a page.
//
// Rules for screens:
// - Tap a workout → push its page. Tap an exercise, stroke or drill → a sheet.
// - Full-screen modes (live sessions, celebration, setup) hide the tab bar.
// - Never more than 2 levels deep under a tab.
// - Each tab keeps its own stack and scroll position. Tapping the active tab
//   pops to its root, or scrolls to the top when already there.
//
// History model: the entry the app started on is the root. Each pushed page
// adds one entry ({ ll: depth }), so `depth` always equals the active tab's
// stack length. Switching tabs unwinds those entries and pushes the new tab's.

import { reducedMotion } from './motion.js';

const SID = Math.random().toString(36).slice(2); // tells our entries from stale ones after a reload
const TRANSIENT = new Set(['session', 'swim-session', 'edit-session', 'edit-swim', 'celebration']);

const nav = { tab: 'today', stacks: {}, scroll: {} };
let depth = 0;
let forward = []; // popped routes, so the browser's forward button can restore them
let pending = null; // tab switch waiting for history to unwind
let fallback = null; // in case a history traversal never reports back
let ignoreNext = false; // our own corrective traversal
let renderView = () => {};

/** Which workout card is morphing into (or back out of) the Workout page hero. */
export const sharedHero = { id: null };

const stack = (id = nav.tab) => (nav.stacks[id] ||= []);
const routeKey = (r) => `${r.name}:${JSON.stringify(r.params || {})}`;
const isTransient = (r) => TRANSIENT.has(r.name) || !!r.params?.celebrate;

export function initRouter({ render }) {
  renderView = render;
  try { history.scrollRestoration = 'manual'; } catch { /* unsupported */ }
  history.replaceState({ ll: 0, sid: SID }, '');
  window.addEventListener('popstate', onPop);
}

export function activeTab() { return nav.tab; }

export function current() {
  const st = stack();
  return st.length ? st[st.length - 1] : { name: nav.tab, params: {} };
}

export function scrollFor(route) { return nav.scroll[routeKey(route)] || 0; }

function saveScroll() { nav.scroll[routeKey(current())] = window.scrollY; }

/**
 * Run a screen change, animated with a view transition when the browser
 * supports it and motion isn't reduced. kind: push | pop | tab | fade | none.
 */
export function withTransition(kind, update) {
  const root = document.documentElement;
  if (kind === 'none' || reducedMotion() || typeof document.startViewTransition !== 'function' || document.visibilityState !== 'visible') {
    update();
    return null;
  }
  root.dataset.vt = kind;
  try {
    const t = document.startViewTransition(update);
    t.finished.finally(() => { if (root.dataset.vt === kind) delete root.dataset.vt; });
    return t;
  } catch {
    delete root.dataset.vt;
    update();
    return null;
  }
}

function show(kind, opts) {
  withTransition(kind, () => renderView({ ...opts, entering: true }));
}

function traverse(delta, onTimeout) {
  clearTimeout(fallback);
  fallback = setTimeout(() => { fallback = null; onTimeout(); }, 800);
  history.go(delta);
}

/** Push a page onto the current tab. */
export function go(name, params = {}) {
  saveScroll();
  stack().push({ name, params });
  forward = [];
  depth += 1;
  history.pushState({ ll: depth, sid: SID }, '');
  show('push', { scrollTop: true });
}

/** Go back one page (through history, so it matches the swipe gesture). */
export function back() {
  if (depth > 0) {
    traverse(-1, () => popLocal(1, 'pop'));
  } else if (stack().length) {
    popLocal(1, 'pop'); // out of step with history: pop without it
  }
}

/** Replace the current page, e.g. after saving a new record. */
export function replace(name, params = {}) {
  const st = stack();
  if (st.length) st[st.length - 1] = { name, params };
  else { st.push({ name, params }); depth += 1; history.pushState({ ll: depth, sid: SID }, ''); }
  show('fade', { scrollTop: true });
}

/** Switch tab; on the active tab, pop to its root or scroll to the top. */
export function tab(id, { reset = false } = {}) {
  saveScroll();
  if (id === nav.tab && !reset) {
    if (depth > 0) traverse(-depth, () => popLocal(depth, 'pop'));
    else if (stack().length) popLocal(stack().length, 'pop');
    else window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    return;
  }
  if (depth > 0) {
    pending = { tab: id, reset };
    traverse(-depth, () => finishTabSwitch());
    return;
  }
  pending = { tab: id, reset };
  finishTabSwitch();
}

/** Forget every tab's pages, e.g. after deleting all data. */
export function resetNav(id = 'today') { tab(id, { reset: true }); }

function finishTabSwitch() {
  const { tab: id, reset } = pending || {};
  pending = null;
  if (!id) return;
  nav.stacks[nav.tab] = stack().filter((r) => !isTransient(r));
  if (reset) { nav.stacks = {}; nav.scroll = {}; }
  const kind = id === nav.tab ? 'fade' : 'tab';
  nav.tab = id;
  forward = [];
  depth = 0;
  history.replaceState({ ll: 0, sid: SID }, '');
  for (let i = 1; i <= stack().length; i++) history.pushState({ ll: i, sid: SID }, '');
  depth = stack().length;
  show(kind, { restoreScroll: true });
}

function popLocal(n, kind) {
  const st = stack();
  for (let i = 0; i < n && st.length; i++) forward.push(st.pop());
  depth = Math.max(0, depth - n);
  show(kind, { restoreScroll: true });
}

function onPop(e) {
  clearTimeout(fallback);
  fallback = null;
  if (ignoreNext) { ignoreNext = false; return; }
  if (pending) { finishTabSwitch(); return; }
  const ours = e.state && e.state.sid === SID;
  const target = ours ? Math.max(0, e.state.ll || 0) : 0;
  if (!ours) {
    // A history entry from before a reload: treat it as the root.
    history.replaceState({ ll: 0, sid: SID }, '');
  }
  const kind = e.hasUAVisualTransition ? 'none' : null;
  if (target < depth) {
    const st = stack();
    const n = Math.min(depth - target, st.length);
    for (let i = 0; i < n; i++) forward.push(st.pop());
    depth = target;
    show(kind || 'pop', { restoreScroll: true });
  } else if (target > depth) {
    if (forward.length < target - depth) {
      // Nothing to go forward to (those pages belonged to another tab): go back where we were.
      ignoreNext = true;
      history.go(depth - target);
      return;
    }
    const st = stack();
    while (depth < target) { st.push(forward.pop()); depth += 1; }
    show(kind || 'push', { scrollTop: true });
  }
}
