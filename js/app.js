// App shell: state access, navigation and rendering.

import * as store from './store.js';
import { h, icon, ICONS } from './util.js';
import { configure as configureTimer, keepAwake, unlockAudio } from './timer.js';
import { setCustomExercises } from './data/exercises.js';
import { initRouter, activeTab, current, scrollFor, go, back, replace, tab, resetNav } from './router.js';
import { applyMotionPrefs } from './motion.js';

export { current, go, back, replace, tab, resetNav };

const TABS = [
  { id: 'today', label: 'Today', icon: ICONS.today },
  { id: 'plan', label: 'Plan', icon: ICONS.plan },
  { id: 'log', label: 'Log', icon: ICONS.log },
  { id: 'progress', label: 'Progress', icon: ICONS.progress },
  { id: 'more', label: 'More', icon: ICONS.more },
];

const routes = {};
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

function tabBar(active) {
  return h('nav', { class: 'tabbar', 'aria-label': 'Main' },
    TABS.map((t) => h('button', {
      class: 'tab', type: 'button', 'aria-current': t.id === active ? 'page' : 'false',
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
    applyMotionPrefs(state.settings);
    configureTimer({ sound: state.settings?.sound });

    let route = current();
    if (!state.profile?.onboarded) route = { name: 'onboarding', params: {} };
    const renderFn = routes[route.name] || routes.today;
    // `entering` is true only when arriving on a screen, never on a data
    // refresh, so entrance animations don't replay on every save.
    const viewEl = renderFn(route.params || {}, state, { entering: !!opts.entering });
    const fullScreen = viewEl.dataset?.full === 'true';

    keepAwake(!!state.active && state.settings?.wakeLock !== false && (route.name === 'session' || route.name === 'swim-session'));

    appEl.replaceChildren(viewEl, fullScreen ? '' : tabBar(activeTab()));
    if (opts.scrollTop) window.scrollTo(0, 0);
    else if (opts.restoreScroll) window.scrollTo(0, scrollFor(route));
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
  initRouter({ render });
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
