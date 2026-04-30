const CACHE_NAME = 'trevo-erp-v1';

// Install — skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET and API/auth calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/rest/v1/')) return;
  if (event.request.url.includes('/auth/')) return;
  if (event.request.url.includes('/~oauth')) return;
  if (event.request.url.includes('/storage/')) return;
  if (event.request.url.includes('/functions/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});