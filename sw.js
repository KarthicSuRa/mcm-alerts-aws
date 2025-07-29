
const CACHE_NAME = 'mcm-alerts-cache-v1';

// On install, pre-cache some resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  // We don't pre-cache anything here, we will cache on the fly.
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
    })
  );
  console.log('Service Worker: Activated');
});

// Use a stale-while-revalidate strategy for all requests
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // if we got a valid response, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.error('Service Worker: Fetch failed:', err);
          // If fetch fails and we have nothing in cache, we will fail.
          // This is expected. If we have something in cache, it would have been returned already.
        });

        // Return the cached response immediately if it exists,
        // and fetch the update in the background.
        return cachedResponse || fetchPromise;
      });
    })
  );
});