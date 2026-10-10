// Service worker for Web Push notifications only (no offline caching / PWA
// install prompt - this app isn't a full PWA, just needs a push target).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'SPARTA Alarm', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'SPARTA Alarm';
  const options = {
    body: data.body || '',
    icon: data.icon || '/alfamart-logo.png',
    badge: data.badge || '/alfamart-logo.png',
    tag: data.tag || 'sparta-alarm',
    requireInteraction: Boolean(data.requireInteraction),
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
