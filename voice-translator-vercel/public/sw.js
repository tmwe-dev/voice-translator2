// Service Worker for BarTalk — Offline + Push + Badge + Background Sync
// ═══ b.547 — LA CACHE ERA FERMA DA QUATTROCENTOSESSANTA PUSH ═══
// Collaudo di Luca, con la schermata rossa e l'indirizzo che diceva
// «?v=819» mentre il programma in produzione era il numero 832:
// «ReferenceError: Cannot access 'T' before initialization ... hai
// rotto il cazzo». Aveva ragione a stufarsi, e la colpa non era del
// codice che stava guardando: era di QUESTA riga.
//
// Il numero qui sotto decide il NOME della cache. Finche' non cambia,
// la cache non viene mai buttata: il ramo `activate` cancella solo le
// cache che hanno un nome DIVERSO da quello corrente. Ferma a 19 dal
// b.372, si portava dietro il guscio HTML di allora — e quel guscio
// chiede i pezzi di programma di allora, che erano li accanto, nella
// stessa cache. Bastava un singhiozzo di rete perche' il ramo di
// riserva («se la rete non risponde, prendi dalla cache») servisse il
// guscio vecchio: da li in poi, programma di ieri dentro una pagina di
// oggi, e l'errore incomprensibile in faccia a chi guarda.
//
// Adesso il numero SEGUE il numero di rilascio (PUSH in lib/constants.js).
// Non e' un vezzo: e' l'unico modo perche' non resti indietro un'altra
// volta — e la prova sw-cache-viva-b547 diventa rossa se i due si
// allontanano troppo.
const CACHE_VERSION = 867; // = PUSH di lib/constants.js (b.591)
const CACHE_NAME = `vt-cache-v${CACHE_VERSION}`;
const TTS_CACHE_NAME = `vt-tts-v${CACHE_VERSION}`;
const TRANSLATE_CACHE_NAME = `vt-translate-v${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
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
<title>BarTalk — Offline</title>
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
<p>BarTalk needs an internet connection for real-time translation. Please check your connection and try again.</p>
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
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== TTS_CACHE_NAME && n !== TRANSLATE_CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => checkCacheSize())
  );
  self.clients.claim();
});

// =============================================
// PUSH NOTIFICATIONS
// =============================================
self.addEventListener('push', (event) => {
  let data = { title: 'BarTalk', body: 'New message', icon: '/icons/icon-192x192.png' };
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
      self.registration.showNotification(nd.title || 'BarTalk', {
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
// b.168 — CONFERMATO (audit esterno 15/8): qui stavano handleTTSEdgeCache
// e handleTranslateCache, due funzioni che mettevano in cache — dentro il
// Service Worker, quindi sul dispositivo, persistente anche dopo il
// logout — le risposte di /api/tts-edge e /api/translate: testo di
// conversazione, gettoni, contesto di stanza. L'unico punto che le
// avrebbe mai richiamate era gia commentato ("SECURITY: ... DISABLED",
// vedi FETCH piu sotto) — quindi il codice non era MAI stato eseguito in
// questa base — ma restava li, intero e funzionante, a un "togli il
// commento" di distanza da una fuga di dati fra account (32 bit di hash
// nel nome della chiave: anche solo una collisione basterebbe a servire
// la traduzione sbagliata a un altro utente). Rimosse insieme alla loro
// coda offline dedicata (IndexedDB 'vt-offline-queue'/'pending-messages',
// usata SOLO dal ramo catch di handleTranslateCache): non serviva a
// nient'altro. La coda offline che l'app usa davvero e un'altra, vive in
// chatStorage.js lato client — invariata.
// =============================================

// =============================================
// CACHE SIZE MANAGEMENT
// Check total cache size and trim if > 50MB
// =============================================
async function checkCacheSize() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return;
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (usage > maxSize) {
      console.warn(`[SW] Cache size ${(usage / 1024 / 1024).toFixed(2)}MB exceeds 50MB limit, trimming...`);
      // Trim TRANSLATE_CACHE first (most replaceable)
      await trimCacheBySize(TRANSLATE_CACHE_NAME, 100, maxSize / 2);
      // Then trim TTS_CACHE if still over
      await trimCacheBySize(TTS_CACHE_NAME, 50, maxSize / 3);
      // Finally trim main CACHE_NAME if still over
      await trimCacheBySize(CACHE_NAME, 30, maxSize / 4);
    }
  } catch (e) {
    console.warn('[SW] Cache size check failed:', e);
  }
}

async function trimCacheBySize(cacheName, removeCount, targetSize) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (let i = 0; i < Math.min(removeCount, keys.length); i++) {
      await cache.delete(keys[i]);
    }
  } catch (e) {
    console.warn(`[SW] Failed to trim ${cacheName}:`, e);
  }
}

// =============================================
// BACKGROUND SYNC — flush offline message queue
// When connection returns, SW wakes up and sends queued messages
// =============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-offline-queue') {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  try {
    // Notify all open clients to flush their IndexedDB queue
    const clientList = await clients.matchAll({ type: 'window' });
    for (const client of clientList) {
      client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
    }
  } catch (e) {
    console.warn('[SW] Background sync flush failed:', e);
  }
}

// =============================================
// PERIODIC SYNC — keep alive, refresh cache
// =============================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-cache') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Re-cache the app shell
        try { await cache.add('/'); } catch {}
        try { await cache.add('/manifest.json'); } catch {}
      })
    );
  }
});

// =============================================
// FETCH — caching strategies
// =============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // SECURITY (b.168) — /api/tts-edge e /api/translate NON vanno mai
  // messe in cache qui: portano dati privati (testo di conversazione,
  // gettoni, contesto di stanza), che nella cache del Service Worker
  // sopravviverebbero al logout e potrebbero, con una collisione
  // dell'hash a 32 bit usato come chiave, finire serviti a un altro
  // utente. Il codice che lo faceva e stato rimosso del tutto (non solo
  // commentato): vedi la nota piu sotto, dove stava. Sono comunque
  // rotte '/api/', quindi il ramo "API requests — network only" qui
  // sotto le esclude comunque dal resto della cache.

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
        // b.363 — PRIMA LA RETE, POI LA CACHE. Qui era il contrario, e
        // costava caro: dopo un rilascio il browser continuava a servire i
        // pezzi di programma vecchi finche erano in cache. Mescolati ai
        // pezzi nuovi davano errori incomprensibili — "non posso accedere a
        // X prima che sia pronto" — e schermate rotte su un'app che in
        // realta era sana. Ora la rete comanda e la cache resta quello che
        // deve essere: la rete di sicurezza per quando si e senza linea.
        return networkFetch.catch(() => cached);
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
