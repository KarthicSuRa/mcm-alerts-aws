// Enhanced Service Worker for MCM Alerts with OneSignal Integration
// Version: Enhanced v2 - Adds custom push/notificationclick handling, improved caching for notifications, and better error resilience
// Compatible with OneSignal Web SDK v16 (as of Oct 2025)

// Import the OneSignal SDK Service Worker (updated to latest recommended)
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'mcm-alerts-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/alert.wav',  // Notification sound - ensure it's cached for offline use
  // Add other static assets (e.g., icons, styles)
];

// Install event - cache essential resources, including notification assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing enhanced version...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets including notification sound');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches, claim clients, and initialize OneSignal if needed
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating enhanced version...');
  
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches to prevent bloat
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
      // Take control of all pages immediately for instant push handling
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: Activated and in control - ready for push notifications');
    })
  );
});

// Enhanced Fetch event - improved skipping for OneSignal and Supabase, with notification-specific caching
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Enhanced skipping: Bypass OneSignal domains and files (updated for v16)
  if (url.hostname.includes('onesignal.com') || 
      url.hostname.includes('os.tc') ||
      url.pathname.includes('OneSignalSDK') ||
      url.pathname.includes('OneSignalSDKWorker')) {
    console.log('Service Worker: Skipping OneSignal request for seamless push:', url.href);
    return;
  }
  
  // Skip Supabase real-time and API (no caching to avoid stale data)
  if (url.hostname.includes('supabase.co') && 
      (url.pathname.includes('/realtime') || 
       url.pathname.includes('/rest/v1/') ||
       url.pathname.includes('/auth/v1/') ||
       url.pathname.includes('/functions/v1/'))) {
    console.log('Service Worker: Skipping Supabase API for realtime notifications:', url.href);
    return;
  }
  
  // Skip other external except trusted CDNs
  if (url.origin !== self.location.origin && 
      !url.hostname.includes('cdnjs.cloudflare.com') &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }
  
  // Cache-first for static assets, including notification sounds/icons
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Network-first for dynamic content (e.g., API fetches for notification data)
  event.respondWith(networkFirst(request));
});

// Helper: Check if static asset (enhanced for notification media)
function isStaticAsset(request) {
  const url = new URL(request.url);
  const extension = url.pathname.split('.').pop();
  const staticExtensions = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'wav', 'mp3', 'json'];
  return staticExtensions.includes(extension) || 
         url.pathname === '/' || 
         url.pathname === '/manifest.json' ||
         url.pathname.includes('/notifications/');  // Cache notification icons if patterned
}

// Enhanced Cache-first: Prioritizes critical assets like sounds for offline notifications
async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache:', request.url);
      
      // Background update for critical resources (e.g., alert.wav for push sounds)
      if (isCriticalResource(request)) {
        updateCacheInBackground(request, cache);
      }
      
      return cachedResponse;
    }
    
    console.log('Service Worker: Cache miss, fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses (enhanced: always cache notification-related for offline)
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      const clone = networkResponse.clone();
      await cache.put(request, clone);
      console.log('Service Worker: Cached new asset:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache-first failed for', request.url, error);
    
    // Fallback to cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('Service Worker: Fallback to cached version:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Network-first: For dynamic fetches, with enhanced fallback
async function networkFirst(request) {
  try {
    console.log('Service Worker: Network-first for dynamic content:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses for offline resilience
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('Service Worker: Network failed, trying cache for', request.url, error);
    
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving stale content from cache:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Critical resources: Enhanced to include notification assets
function isCriticalResource(request) {
  const url = new URL(request.url);
  return url.pathname === '/' || 
         url.pathname.endsWith('.js') || 
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('manifest.json') ||
         url.pathname.endsWith('alert.wav');  // Ensure sound is always fresh
}

// Background cache update
function updateCacheInBackground(request, cache) {
  fetch(request)
    .then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        return cache.put(request, response.clone());
      }
    })
    .then(() => {
      console.log('Service Worker: Background cache update completed for:', request.url);
    })
    .catch(error => {
      console.warn('Service Worker: Background cache update failed for', request.url, error);
    });
}

// Enhanced Background Sync: Queue notification actions (e.g., mark as read) for offline
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync' || event.tag === 'notification-sync') {
    event.waitUntil(doBackgroundSync(event.tag));
  }
});

async function doBackgroundSync(tag) {
  try {
    console.log('Service Worker: Performing background sync for', tag);
    
    // Example: Sync queued notifications or analytics
    // Fetch pending data from IndexedDB or cache, then POST to server
    
    // Notify main app
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({ type: 'BACKGROUND_SYNC_COMPLETE', tag });
    });
    
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Enhanced Push Event Handling: Custom logic after OneSignal (for silent pushes or custom display)
// Note: OneSignal handles default showNotification; this adds custom actions
self.addEventListener('push', event => {
  console.log('Service Worker: Custom push event received:', event);
  
  let title = 'MCM Alert';
  let options = {
    body: event.data ? event.data.text() : 'You have a new alert.',
    icon: '/icon-192x192.png',  // Assume cached icon
    badge: '/badge.png',
    vibrate: [200, 100, 200],  // Vibration for mobile
    data: event.data ? event.data.json() : {},  // Pass data for click handling
    actions: [
      { action: 'view', title: 'View Alert' },
      { action: 'snooze', title: 'Snooze' }
    ]
  };
  
  // If silent push (no body), don't show notification but sync data
  if (event.data && event.data.json().silent) {
    console.log('Service Worker: Silent push - syncing data without notification');
    event.waitUntil(
      self.registration.sync.register('notification-sync')
    );
    return;
  }
  
  // Show notification with cached sound reference (play via client postMessage)
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('Service Worker: Custom notification shown');
        // Post to clients to play sound if app open
        const clients = self.clients.matchAll({ type: 'window' });
        return clients.then(clientList => {
          clientList.forEach(client => {
            client.postMessage({ type: 'PLAY_ALERT_SOUND' });
          });
        });
      })
  );
});

// Enhanced Notification Click: Deep link or postMessage to app
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const url = data.url || '/dashboard';  // Deep link to notification or dashboard
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Focus existing client if open
      for (let client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // Or open new
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }).then(() => {
      // Post notification data to app for handling
      const clients = self.clients.matchAll({ type: 'window' });
      return clients.then(clientList => {
        clientList.forEach(client => {
          client.postMessage({ 
            type: 'NOTIFICATION_CLICKED', 
            data: data,
            notificationId: event.notification.tag 
          });
        });
      });
    })
  );
});

// Message handling: Enhanced for app-SW communication (e.g., for sound, sync)
self.addEventListener('message', event => {
  console.log('Service Worker: Message received from app:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  // New: Handle requests to play sound or queue sync
  if (event.data && event.data.type === 'QUEUE_SYNC') {
    self.registration.sync.register('background-sync');
  }
});

// Enhanced Error Handling: Log push-specific errors
self.addEventListener('error', event => {
  console.error('Service Worker: Error occurred (check for push issues):', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker: Unhandled promise rejection (possible push failure):', event.reason);
});

console.log('Enhanced Service Worker: Loaded successfully with OneSignal v16 integration');