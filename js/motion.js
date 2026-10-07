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
