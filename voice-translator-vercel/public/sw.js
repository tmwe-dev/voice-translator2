// Service Worker for VoiceTranslate — Offline + Push + Badge + Background Sync
const CACHE_VERSION = 7;
const CACHE_NAME = `vt-cache-v${CACHE_VERSION}`;
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

// Offline fallback page (inline HTML)
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VoiceTranslate — Offline</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0c29;color:#fff;
display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}
.container{max-width:400px}
h1{font-size:1.5rem;margin-bottom:1rem;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
p{color:#a0a0b8;line-height:1.6;margin-bottom:1.5rem}
button{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;padding:12px 32px;border-radius:12px;font-size:1rem;cursor:pointer}
button:active{transform:scale(0.96)}
.icon{font-size:3rem;margin-bottom:1rem}
</style></head><body>
<div class="container">
<div class="icon">📡</div>
<h1>You're Offline</h1>
<p>VoiceTranslate needs an internet connection for real-time translation. Please check your connection and try again.</p>
<button onclick="location.reload()">Retry</button>
</div></body></html>`;

// =============================================
// INSTALL — pre-cache static assets + offline page
// =============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache offline page
      await cache.put(
        new Request('/_offline'),
        new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } })
      );
      // Cache static assets (non-blocking failures)
      await Promise.all(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((e) => console.warn(`Cache miss: ${asset}`, e))
        )
      );
    })
  );
  self.skipWaiting();
});

// =============================================
// ACTIVATE — clean old caches
// =============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// =============================================
// PUSH NOTIFICATIONS
// =============================================
self.addEventListener('push', (event) => {
  let data = { title: 'VoiceTranslate', body: 'New message', icon: '/icons/icon-192x192.png' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; }
    catch (e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'vt-message',
    renotify: true,
    data: { url: data.url || '/', roomId: data.roomId || null, msgCount: data.msgCount || 1 },
    actions: data.roomId
      ? [{ action: 'open', title: 'Open chat' }, { action: 'dismiss', title: 'Dismiss' }]
      : []
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      updateBadge(data.msgCount || 1)
    ])
  );
});

// =============================================
// NOTIFICATION CLICK
// =============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') { updateBadge(0); return; }

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
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
      if (clients.openWindow) return clients.openWindow(targetUrl).then(() => updateBadge(0));
    })
  );
});

// =============================================
// MESSAGE FROM CLIENT
// =============================================
self.addEventListener('message', (event) => {
  if (!event.data) return;
  switch (event.data.type) {
    case 'SET_BADGE':
      updateBadge(event.data.count || 0);
      break;
    case 'CLEAR_BADGE':
      updateBadge(0);
      break;
    case 'SHOW_LOCAL_NOTIFICATION': {
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
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// =============================================
// BADGE HELPER
// =============================================
async function updateBadge(count) {
  try {
    if (navigator.setAppBadge && navigator.clearAppBadge) {
      count > 0 ? await navigator.setAppBadge(count) : await navigator.clearAppBadge();
    }
  } catch (e) { /* Badge API not supported */ }
}

// =============================================
// FETCH — caching strategies
// =============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, extensions, chrome internals
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname !== self.location.hostname) return;

  // API requests — network only (real-time data)
  if (url.pathname.startsWith('/api/')) return;

  // WebSocket upgrades — skip
  if (request.headers.get('Upgrade') === 'websocket') return;

  // HTML / navigation — network-first with offline fallback
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const c = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match('/_offline'))
        )
    );
    return;
  }

  // JS/CSS — stale-while-revalidate
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          if (res && res.status === 200) {
            const c = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // Images/fonts/avatars — cache-first
  if (
    request.destination === 'image' || request.destination === 'font' ||
    url.pathname.startsWith('/avatars/') || url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.status === 200) {
            const c = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
          }
          return res;
        });
      })
    );
    return;
  }

  // Default — network-first
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) {
          const c = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
