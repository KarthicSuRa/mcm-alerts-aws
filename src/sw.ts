import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// --- OneSignal Service Worker --- //
// This is the primary and essential part for background notifications.
// It MUST be at the top level of the service worker script.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// --- Workbox (from vite-plugin-pwa) --- //
// 1. Clean up old caches left from previous versions.
cleanupOutdatedCaches();

// 2. Precache all assets defined in the manifest.
// The `self.__WB_MANIFEST` is a placeholder that vite-plugin-pwa will replace
// with the actual list of files to cache.
precacheAndRoute(self.__WB_MANIFEST);

// --- Optional: Custom event listeners --- //
self.addEventListener('message', (event) => {
  console.log(`[Service Worker] Received message: ${event.data}`);
});
