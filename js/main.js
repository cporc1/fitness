// Entry point: register every screen, then start the app.

import './views/onboarding.js';
import './views/today.js';
import './views/plan.js';
import './views/history.js';
import './views/progress.js';
import './views/more.js';
import './views/library.js';
import './views/session-gym.js';
import './views/session-swim.js';
import { start } from './app.js';

start();

// Offline support when installed from its own web address (not inside a frame).
const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();
if ('serviceWorker' in navigator && !framed && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable */ });
  });
}
