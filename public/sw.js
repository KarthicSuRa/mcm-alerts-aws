// Service Worker for MCM Alerts with OneSignal integration
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'mcm-alerts-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/alert.wav',
  '/icon-192x192.png', // Notification icon (OneSignal uses this)
  '/badge-72x72.png'   // Badge icon
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
  
  // Caching strategies would go here if needed, but are omitted for simplicity
});

console.log('Service Worker: Script loaded successfully');