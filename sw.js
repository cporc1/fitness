// Offline support: precache the app shell, serve it cache-first and refresh
// in the background. Bump VERSION when shipping changes.

const VERSION = 'v4';
const CACHE = `liftlap-${VERSION}`;
const FONT_CACHE = 'liftlap-fonts';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'js/main.js',
  'js/app.js',
  'js/router.js',
  'js/motion.js',
  'js/store.js',
  'js/util.js',
  'js/ui.js',
  'js/timer.js',
  'js/charts.js',
  'js/stats.js',
  'js/program.js',
  'js/actions.js',
  'js/media.js',
  'js/data/exercises.js',
  'js/data/plans.js',
  'js/data/swim.js',
  'js/data/guides.js',
  'js/data/media.js',
  'js/views/onboarding.js',
  'js/views/today.js',
  'js/views/plan.js',
  'js/views/workout.js',
  'js/views/history.js',
  'js/views/progress.js',
  'js/views/learn.js',
  'js/views/tools.js',
  'js/views/settings.js',
  'js/views/library.js',
  'js/views/session-gym.js',
  'js/views/session-swim.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('liftlap-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function staleWhileRevalidate(cacheName, request) {
  return caches.open(cacheName).then((cache) => cache.match(request, { ignoreSearch: true }).then((cached) => {
    const fresh = fetch(request).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(staleWhileRevalidate(CACHE, new Request(new URL('./', self.location).href)));
      return;
    }
    event.respondWith(staleWhileRevalidate(CACHE, request));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(FONT_CACHE, request));
  }
});
