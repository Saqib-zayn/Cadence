const CACHE = 'cadence-v1';

self.addEventListener('install', event => {
  // Cache the app shell immediately
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.json']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Remove stale caches from previous versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Only intercept same-origin requests
  if (url.origin !== location.origin) return;

  // Stale-while-revalidate for same-origin assets
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached); // offline: serve cached version

      // Return cached immediately if available, update in background
      return cached || networkFetch;
    })
  );
});
