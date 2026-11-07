/**
 * Service Worker for SonoriaFM PWA
 * Handles offline caching, background audio, and install prompts
 */

const CACHE_NAME = 'sonoriafm-v1';
const STATIC_CACHE = 'sonoriafm-static-v1';
const DYNAMIC_CACHE = 'sonoriafm-dynamic-v1';
const AUDIO_CACHE = 'sonoriafm-audio-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  // Add your built assets here (will be populated by build script)
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== AUDIO_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (CDN, APIs)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle different resource types
  if (isAudioRequest(request)) {
    event.respondWith(handleAudioRequest(request));
  } else if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Background sync for analytics
self.addEventListener('sync', (event) => {
  if (event.tag === 'analytics-sync') {
    event.waitUntil(syncAnalytics());
  }
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nueva actualización en SonoriaFM',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SonoriaFM', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Focus existing window if open
          for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// Helper functions

function isAudioRequest(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(mp3|wav|ogg|m4a|aac|ts|m3u8)$/i) ||
         url.pathname.includes('/stream/') ||
         url.pathname.includes('/audio/');
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);

  // Try cache first
  const cached = await cache.match(request);
  if (cached) {
    console.log('[SW] Serving audio from cache:', request.url);
    return cached;
  }

  // Fetch from network
  try {
    const response = await fetch(request);

    // Only cache successful responses
    if (response.ok) {
      const cloned = response.clone();
      cache.put(request, cloned);
      console.log('[SW] Cached audio:', request.url);
    }

    return response;
  } catch (error) {
    console.error('[SW] Audio fetch failed:', error);
    return new Response('Audio unavailable offline', { status: 503 });
  }
}

async function handleApiRequest(request) {
  // For API requests, try network first, then cache for GET
  if (request.method === 'GET') {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);

    try {
      const response = await fetch(request);

      if (response.ok) {
        const cloned = response.clone();
        cache.put(request, cloned);
      }

      return response;
    } catch (error) {
      if (cached) {
        console.log('[SW] Serving API from cache:', request.url);
        return cached;
      }
      return new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Non-GET requests - just try network
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  // Try network first for navigation
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Fallback to cached index.html for SPA
    const cached = await cache.match('/');
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function syncAnalytics() {
  // Get pending analytics from IndexedDB and send
  // This would be implemented with a proper IndexedDB wrapper
  console.log('[SW] Syncing analytics...');
  // Implementation depends on your analytics batching strategy
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CACHE_AUDIO') {
    // Pre-cache specific audio files
    cacheAudioFiles(event.data.urls);
  } else if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

async function cacheAudioFiles(urls) {
  const cache = await caches.open(AUDIO_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.error('[SW] Failed to cache audio:', url, error);
      }
    })
  );
}