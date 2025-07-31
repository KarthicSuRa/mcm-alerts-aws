const CACHE_NAME = 'mcm-alerts-cache-v1';

// On install, pre-cache some resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
  console.log('Service Worker: Activated');
});

// Basic fetch strategy - let OneSignal handle push notifications
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip caching for Supabase real-time connections and API calls
  if (event.request.url.includes('supabase.co/realtime') || 
      event.request.url.includes('/rest/v1/') ||
      event.request.url.includes('/auth/v1/') ||
      event.request.url.includes('onesignal.com')) {
    return;
  }

  // Skip caching for external domains except CDNs
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin && 
      !url.hostname.includes('cdnjs.cloudflare.com') &&
      !url.hostname.includes('fonts.googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.warn('Service Worker: Fetch failed for', event.request.url, err);
          return cachedResponse;
        });
        
        // Return cached response immediately if available, update cache in background
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Note: OneSignal will handle push notifications through their own service worker
// This service worker focuses on caching and basic PWA functionality
