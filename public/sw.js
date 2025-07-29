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

// Enhanced push event handler
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Error parsing push data:', e);
    data = {
      title: 'New Notification',
      message: event.data ? event.data.text() : 'You have a new alert.'
    };
  }

  const title = data.title || 'MCM Alerts';
  const options = {
    body: data.message || 'You have a new alert.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.id || 'mcm-alert', // Prevents duplicate notifications
    requireInteraction: data.severity === 'high', // Keep high severity notifications visible
    data: {
      url: data.url || '/',
      notificationId: data.id,
      severity: data.severity,
      timestamp: data.timestamp
    },
    actions: [
      {
        action: 'view',
        title: 'View Alert'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Enhanced notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click Received.', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return; // Just close the notification
  }

  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clientList => {
      // If a window for the app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification closed:', event);
  // You could track analytics here
});

// Enhanced fetch strategy
self.addEventListener('fetch', event => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip caching for Supabase real-time connections
  if (event.request.url.includes('supabase.co/realtime')) {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If we got a valid response, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.error('Service Worker: Fetch failed:', err);
          // Return cached response if network fails
          return cachedResponse;
        });
        
        // Return cached response immediately, then update cache in background
        return cachedResponse || fetchPromise;
      });
    })
  );
});
