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

// Enhanced push event handler with better error handling
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.', event);
  
  if (!event.data) {
    console.error('Push event has no data');
    return;
  }

  let data = {};
  try {
    data = event.data.json();
    console.log('[Service Worker] Push data parsed:', data);
  } catch (e) {
    console.error('Error parsing push data:', e);
    // Try to get text data as fallback
    try {
      const textData = event.data.text();
      console.log('[Service Worker] Push text data:', textData);
      data = {
        title: 'New Notification',
        message: textData || 'You have a new alert.',
        body: textData || 'You have a new alert.'
      };
    } catch (textError) {
      console.error('Error parsing push text data:', textError);
      data = {
        title: 'MCM Alerts',
        message: 'You have a new alert.',
        body: 'You have a new alert.'
      };
    }
  }

  const title = data.title || 'MCM Alerts';
  const body = data.body || data.message || 'You have a new alert.';
  
  const options = {
    body: body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.id || `mcm-alert-${Date.now()}`, // Unique tag to prevent duplicates
    requireInteraction: data.severity === 'high' || data.severity === 'critical',
    silent: false, // Ensure notifications make sound
    renotify: true, // Allow replacing previous notifications with same tag
    data: {
      url: data.url || '/',
      notificationId: data.id,
      severity: data.severity,
      timestamp: data.timestamp || new Date().toISOString()
    },
    actions: [
      {
        action: 'view',
        title: 'View Alert',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  console.log('[Service Worker] Showing notification with options:', options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[Service Worker] Notification shown successfully');
      })
      .catch(error => {
        console.error('[Service Worker] Error showing notification:', error);
      })
  );
});

// Enhanced notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received:', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    console.log('[Service Worker] Notification dismissed');
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';
  console.log('[Service Worker] Opening URL:', urlToOpen);
  
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clientList => {
      console.log('[Service Worker] Found clients:', clientList.length);
      
      // Check if a window is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('[Service Worker] Focusing existing window');
          return client.focus().then(() => {
            // Optionally navigate to the specific notification
            if (client.navigate && urlToOpen !== '/') {
              return client.navigate(urlToOpen);
            }
          });
        }
      }
      
      // Otherwise, open a new window
      if (clients.openWindow) {
        console.log('[Service Worker] Opening new window');
        return clients.openWindow(urlToOpen);
      }
    }).catch(error => {
      console.error('[Service Worker] Error handling notification click:', error);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification closed:', event);
  // Track analytics or cleanup if needed
});

// Background sync for failed push notifications (optional)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(
      // Handle any failed push notifications here
      Promise.resolve()
    );
  }
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', event => {
  console.log('[Service Worker] Push subscription changed:', event);
  
  event.waitUntil(
    // Re-subscribe with new endpoint
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.newSubscription?.options?.applicationServerKey
    }).then(newSubscription => {
      console.log('[Service Worker] New subscription created:', newSubscription);
      // Send new subscription to your server
      return fetch('/api/update-push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oldEndpoint: event.oldSubscription?.endpoint,
          newSubscription: newSubscription.toJSON()
        })
      });
    }).catch(error => {
      console.error('[Service Worker] Error handling subscription change:', error);
    })
  );
});

// Enhanced fetch strategy
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip caching for Supabase real-time connections and API calls
  if (event.request.url.includes('supabase.co/realtime') || 
      event.request.url.includes('/rest/v1/') ||
      event.request.url.includes('/auth/v1/')) {
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
