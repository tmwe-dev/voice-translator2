// Service Worker for VoiceTranslate - Offline + Push Notifications + Badge
const CACHE_NAME = 'vt-cache-v6';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/avatars/1.png',
  '/avatars/2.png',
  '/avatars/3.png',
  '/avatars/4.png',
  '/avatars/5.png',
  '/avatars/6.png',
  '/avatars/7.png',
  '/avatars/8.png',
  '/avatars/9.png'
];

// =============================================
// INSTALL - pre-cache static assets
// =============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((e) => {
            console.warn(`Failed to cache ${asset}:`, e);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// =============================================
// ACTIVATE - clean old caches
// =============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// =============================================
// PUSH NOTIFICATIONS
// =============================================
self.addEventListener('push', (event) => {
  let data = { title: 'VoiceTranslate', body: 'Nuovo messaggio', icon: '/icons/icon-192x192.png' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'vt-message',
    renotify: true,
    data: {
      url: data.url || '/',
      roomId: data.roomId || null,
      msgCount: data.msgCount || 1
    },
    actions: data.roomId ? [
      { action: 'open', title: 'Apri chat' },
      { action: 'dismiss', title: 'Ignora' }
    ] : []
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Update badge count
      updateBadge(data.msgCount || 1)
    ])
  );
});

// =============================================
// NOTIFICATION CLICK
// =============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    // Clear badge on dismiss
    updateBadge(0);
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Send message to client to navigate/update
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            roomId: event.notification.data?.roomId,
            url: targetUrl
          });
          client.focus();
          updateBadge(0);
          return;
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(targetUrl).then(() => updateBadge(0));
      }
    })
  );
});

// =============================================
// MESSAGE FROM CLIENT
// =============================================
self.addEventListener('message', (event) => {
  if (event.data) {
    switch (event.data.type) {
      case 'SET_BADGE':
        updateBadge(event.data.count || 0);
        break;
      case 'CLEAR_BADGE':
        updateBadge(0);
        break;
      case 'SHOW_LOCAL_NOTIFICATION':
        // Allow client to trigger notifications directly (no push server needed)
        const nd = event.data;
        self.registration.showNotification(nd.title || 'VoiceTranslate', {
          body: nd.body || '',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          vibrate: [100, 50, 100],
          tag: nd.tag || 'vt-local',
          renotify: true,
          data: { url: nd.url || '/', roomId: nd.roomId || null }
        });
        break;
    }
  }
});

// =============================================
// BADGE HELPER
// =============================================
async function updateBadge(count) {
  try {
    if (navigator.setAppBadge && navigator.clearAppBadge) {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    }
  } catch (e) {
    // Badge API not supported, silently ignore
  }
}

// =============================================
// FETCH - caching strategies
// =============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // API requests - network only
  if (url.pathname.startsWith('/api/')) return;

  // HTML / navigation - network-first
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const c = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
          }
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/')))
    );
    return;
  }

  // JS/CSS - network-first
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const c = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images/fonts - cache-first
  if (request.destination === 'image' || request.destination === 'font' ||
      url.pathname.startsWith('/avatars/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const c = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default - network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const c = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
