// Dokita AI — Service Worker
// Caches the app shell and top answers for offline use

const CACHE_NAME = 'dokita-ai-v1';
const OFFLINE_CACHE = 'dokita-offline-v1';

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== OFFLINE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls: network first, fall back to offline message
// - Static assets: cache first, then network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests — network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({
            answer: 'You appear to be offline. Please reconnect to get answers from Dokita AI. You can still view your saved bookmarks.',
            sources: [],
            offline: true,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
    )
  );
});
