// Service Worker for VoiceTranslate - Offline Support
const CACHE_NAME = 'vt-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/avatars/1.jpg',
  '/avatars/2.jpg',
  '/avatars/3.jpg',
  '/avatars/4.jpg',
  '/avatars/5.jpg',
  '/avatars/6.jpg',
  '/avatars/7.jpg',
  '/avatars/8.jpg',
  '/avatars/9.jpg',
  '/avatars/10.jpg',
  '/avatars/11.jpg',
  '/avatars/12.jpg'
];

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.error('Cache addAll error:', err);
        // Continue even if some assets fail to cache
        return Promise.all(
          STATIC_ASSETS.map((asset) =>
            cache.add(asset).catch((e) => {
              console.warn(`Failed to cache ${asset}:`, e);
            })
          )
        );
      });
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
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // API requests - network-first with cache fallback for GET
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET requests
          if (response.ok && request.method === 'GET') {
            const cacheClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cacheClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache for GET requests
          if (request.method === 'GET') {
            return caches.match(request);
          }
          // For failed POST/PUT requests, return error response
          return new Response('Offline - request not available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
    return;
  }

  // Static assets (JS, CSS, images) - cache-first strategy
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.startsWith('/avatars/')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // Cache successful responses
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

  // Main page shell - cache-first with network fallback
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then((response) => {
            // Cache successful page responses
            if (response && response.status === 200) {
              const cacheClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, cacheClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return cached index/home page if available
            return caches.match('/');
          });
      })
    );
    return;
  }

  // Default - network-first strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && request.method === 'GET') {
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
