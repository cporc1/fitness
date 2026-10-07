// App shell: state access, navigation and rendering.

import * as store from './store.js';
import { h, icon, ICONS } from './util.js';
import { configure as configureTimer, keepAwake, unlockAudio } from './timer.js';
import { setCustomExercises } from './data/exercises.js';

const TABS = [
  { id: 'today', label: 'Today', icon: ICONS.today },
  { id: 'plan', label: 'Plan', icon: ICONS.plan },
  { id: 'log', label: 'Log', icon: ICONS.log },
  { id: 'progress', label: 'Progress', icon: ICONS.progress },
  { id: 'more', label: 'More', icon: ICONS.more },
];

const routes = {};
const nav = { tab: 'today', stack: [], scroll: {} };
let sessionsCache = null;
let rendering = false;

export function registerRoute(name, render) { routes[name] = render; }

/** Snapshot of everything views need. */
export function ctx() {
  if (!sessionsCache) sessionsCache = store.allSessions();
  const custom = store.get('custom');
  setCustomExercises(custom?.exercises);
  return {
    profile: store.get('profile'),
    settings: store.get('settings'),
    schedule: store.get('schedule'),
    custom,
    swaps: store.get('swaps') || {},
    body: store.get('body'),
    daily: store.get('daily'),
    active: store.get('active'),
    sessions: sessionsCache,
  };
}

export function current() {
  return nav.stack.length ? nav.stack[nav.stack.length - 1] : { name: nav.tab, params: {} };
}

export function go(name, params = {}) {
  nav.scroll[routeKey(current())] = window.scrollY;
  nav.stack.push({ name, params });
  render({ scrollTop: true });
}

export function back() {
  nav.stack.pop();
  render({ restoreScroll: true });
}

/** Replace the current pushed route (e.g. after saving a new record). */
export function replace(name, params = {}) {
  if (nav.stack.length) nav.stack[nav.stack.length - 1] = { name, params };
  else nav.stack.push({ name, params });
  render({ scrollTop: true });
}

export function tab(id) {
  nav.scroll[routeKey(current())] = window.scrollY;
  if (nav.tab === id && !nav.stack.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  nav.tab = id;
  nav.stack = [];
  render({ restoreScroll: true });
}

function routeKey(r) { return `${r.name}:${JSON.stringify(r.params || {})}`; }

function tabBar(activeTab) {
  return h('nav', { class: 'tabbar', 'aria-label': 'Main' },
    TABS.map((t) => h('button', {
      class: 'tab', type: 'button', 'aria-current': t.id === activeTab ? 'page' : 'false',
      onclick: () => tab(t.id),
    }, icon(t.icon, 24), t.label)));
}

export function render(opts = {}) {
  if (rendering) return;
  rendering = true;
  try {
    const appEl = document.getElementById('app');
    const state = ctx();
    applyTheme(state.settings?.theme);
    configureTimer({ sound: state.settings?.sound });

    let route = current();
    if (!state.profile?.onboarded) route = { name: 'onboarding', params: {} };
    const renderFn = routes[route.name] || routes.today;
    const viewEl = renderFn(route.params || {}, state);
    const fullScreen = viewEl.dataset?.full === 'true';

    keepAwake(!!state.active && state.settings?.wakeLock !== false && (route.name === 'session' || route.name === 'swim-session'));

    appEl.replaceChildren(viewEl, fullScreen ? '' : tabBar(nav.tab));
    if (opts.scrollTop) window.scrollTo(0, 0);
    else if (opts.restoreScroll) window.scrollTo(0, nav.scroll[routeKey(route)] || 0);
  } finally {
    rendering = false;
  }
}

// Only touch data-theme when the user picked one in Settings, so a host
// (like the claude.ai viewer) can still set it when the app is on "auto".
let ownTheme = false;
function applyTheme(theme) {
  const rootEl = document.documentElement;
  if (theme === 'light' || theme === 'dark') { rootEl.dataset.theme = theme; ownTheme = true; }
  else if (ownTheme) { delete rootEl.dataset.theme; ownTheme = false; }
}

export function invalidateSessions() { sessionsCache = null; }

export function start() {
  store.init();
  store.subscribe((name) => {
    if (name === '__sync') return;
    if (name === '*' || name.startsWith('sessions-')) sessionsCache = null;
    if (name === 'active') return; // session views re-render themselves
    render();
  });
  // Ask the browser not to clear this app's storage under pressure.
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* unsupported */ }
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('scroll', () => {
    const bar = document.querySelector('.topbar');
    if (bar) bar.classList.toggle('scrolled', window.scrollY > 4);
  }, { passive: true });
  render();
  store.connectCloud().catch(() => {});
}
