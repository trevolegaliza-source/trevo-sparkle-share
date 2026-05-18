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

// Push — recebe payload da edge function enviar-push e mostra notification nativa
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = payload.title || 'Trevo ERP';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || undefined,
    data: { url: payload.url || '/' },
    requireInteraction: false,
  };
  const tasks = [self.registration.showNotification(title, options)];
  // Badge no icone do app (iOS 16.4+ PWA, Android Chrome, macOS Safari 16.4+)
  if (typeof payload.unread_count === 'number' && self.navigator && 'setAppBadge' in self.navigator) {
    tasks.push(
      payload.unread_count > 0
        ? self.navigator.setAppBadge(payload.unread_count).catch(() => {})
        : self.navigator.clearAppBadge().catch(() => {})
    );
  }
  event.waitUntil(Promise.all(tasks));
});

// Click na notification — foca aba existente ou abre nova
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
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