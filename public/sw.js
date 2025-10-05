// Import the OneSignal SDK Service Worker
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Service Worker for MCM Alerts with OneSignal integration
const CACHE_NAME = 'mcm-alerts-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/alert.wav',
  // Add other static assets you want to cache
];

// Install event - cache essential resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: Activated and in control');
    })
  );
});

// Fetch event - handle network requests with caching strategy
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip caching for OneSignal domains - let OneSignal handle these
  if (url.hostname.includes('onesignal.com') || 
      url.hostname.includes('os.tc') ||
      url.pathname.includes('OneSignalSDK')) {
    console.log('Service Worker: Skipping OneSignal request:', url.href);
    return;
  }
  
  // Skip caching for Supabase real-time connections and API calls
  if (url.hostname.includes('supabase.co') && 
      (url.pathname.includes('/realtime') || 
       url.pathname.includes('/rest/v1/') ||
       url.pathname.includes('/auth/v1/') ||
       url.pathname.includes('/functions/v1/'))) {
    console.log('Service Worker: Skipping Supabase API request:', url.href);
    return;
  }
  
  // Skip caching for other external domains except trusted CDNs
  if (url.origin !== self.location.origin && 
      !url.hostname.includes('cdnjs.cloudflare.com') &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }
  
  // Use cache-first strategy for static assets
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Use network-first strategy for dynamic content
  event.respondWith(networkFirst(request));
});

// Helper function to determine if a request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  const extension = url.pathname.split('.').pop();
  const staticExtensions = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'wav', 'mp3'];
  return staticExtensions.includes(extension) || url.pathname === '/' || url.pathname === '/manifest.json';
}

// Cache-first strategy
async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache:', request.url);
      
      // Update cache in background for critical resources
      if (isCriticalResource(request)) {
        updateCacheInBackground(request, cache);
      }
      
      return cachedResponse;
    }
    
    console.log('Service Worker: Cache miss, fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache-first failed for', request.url, error);
    
    // Try to return cached version as fallback
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    console.log('Service Worker: Network-first for:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses for future offline access
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('Service Worker: Network failed, trying cache for', request.url, error);
    
    // Fallback to cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving stale content from cache:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Helper function to determine if a resource is critical
function isCriticalResource(request) {
  const url = new URL(request.url);
  return url.pathname === '/' || 
         url.pathname.endsWith('.js') || 
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('manifest.json');
}

// Update cache in background without blocking the response
function updateCacheInBackground(request, cache) {
  fetch(request)
    .then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
        console.log('Service Worker: Background cache update completed for:', request.url);
      }
    })
    .catch(error => {
      console.warn('Service Worker: Background cache update failed for', request.url, error);
    });
}

// Handle background sync (for offline functionality)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync function
async function doBackgroundSync() {
  try {
    console.log('Service Worker: Performing background sync');
    
    // Send any queued data when connection is restored
    // This could include offline actions, analytics, etc.
    
    // Notify the main app that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'BACKGROUND_SYNC_COMPLETE' });
    });
    
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Handle messages from the main application
self.addEventListener('message', event => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Handle errors
self.addEventListener('error', event => {
  console.error('Service Worker: Error occurred:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker: Unhandled promise rejection:', event.reason);
});

console.log('Service Worker: Script loaded successfully');
