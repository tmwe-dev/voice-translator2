// Service Worker for VoiceTranslate - Offline Support
const CACHE_NAME = 'vt-cache-v5';
const STATIC_ASSETS = [
  '/manifest.json',
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

// Install event - pre-cache static assets (NOT the HTML page)
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

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') return;

  // API requests - network only (no caching)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML pages / navigation - NETWORK-FIRST (always get latest)
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cacheClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cacheClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(r => r || caches.match('/'));
        })
    );
    return;
  }

  // JS/CSS bundles - NETWORK-FIRST (Next.js uses hashed filenames, but always prefer fresh)
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cacheClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cacheClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Images and fonts - cache-first (these rarely change)
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/avatars/')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const cacheClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cacheClone);
            });
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
          const cacheClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cacheClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
