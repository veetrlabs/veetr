// Service Worker for offline capability
const CACHE_NAME = 'veetr-v1.8';
const STATIC_CACHE_NAME = 'veetr-static-v1.8';
const DYNAMIC_CACHE_NAME = 'veetr-dynamic-v1.8';

// Core app shell - always cache these
const CORE_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_NAME);
  event.waitUntil(
    Promise.all([
      // Cache core app shell
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching core app shell');
        return cache.addAll(CORE_CACHE);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_NAME);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - implement cache-first strategy with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle HTTP/HTTPS requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Skip BLE and other browser APIs
  if (request.url.includes('bluetooth') || 
      request.url.includes('navigator.') ||
      request.url.includes('chrome-extension')) {
    return;
  }

  // Skip GitHub API requests - always fetch fresh
  if (request.url.includes('api.github.com')) {
    return;
  }

  // Special handling for navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle asset requests
  event.respondWith(handleAssetRequest(request));
});

async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    // Cache successful navigation responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, serve from cache
    console.log('[SW] Network failed for navigation, serving from cache');
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to index.html for SPA
    const indexResponse = await caches.match('/index.html');
    if (indexResponse) {
      return indexResponse;
    }
    
    // Ultimate fallback
    return new Response(`
      <html>
        <head><title>Veetr - Offline</title></head>
        <body>
          <h1>Veetr Sailing Instruments</h1>
          <p>You're offline and the app isn't cached yet.</p>
          <p>Please connect to the internet to load the app initially.</p>
          <button onclick="window.location.reload()">Try Again</button>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

async function handleAssetRequest(request) {
  // Never cache API requests - always fetch fresh
  if (request.url.includes('/api/') || 
      request.url.includes('api.github.com') ||
      request.url.includes('api.')) {
    console.log('[SW] API request - fetching fresh:', request.url);
    try {
      return await fetch(request);
    } catch (error) {
      console.log('[SW] API request failed:', request.url, error);
      throw error;
    }
  }

  // Cache-first strategy for assets (JS, CSS, images, etc.)
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('[SW] Serving from cache:', request.url);
    return cachedResponse;
  }

  try {
    // Try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached new asset:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for asset:', request.url);
    
    // For CSS/JS files, try to serve a fallback
    if (request.destination === 'style') {
      return new Response('/* Offline fallback CSS */', {
        headers: { 'Content-Type': 'text/css' }
      });
    }
    
    if (request.destination === 'script') {
      return new Response('// Offline fallback JS', {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
    
    // For other resources, return a 503
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        console.log('[SW] Received SKIP_WAITING message');
        self.skipWaiting();
        break;
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
      case 'CLEAR_CACHE':
        clearAllCaches().then(() => {
          event.ports[0].postMessage({ success: true });
        });
        break;
    }
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('[SW] All caches cleared');
}