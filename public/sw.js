/* eslint-disable no-restricted-globals */

// Service Worker for MCM Alerts with OneSignal and Workbox integration

// 1. OneSignal SDK
// This is required for OneSignal to work.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// 2. Workbox Precaching
// The self.__WB_MANIFEST placeholder is the injection point for the list of assets to cache.
// This is filled automatically by vite-plugin-pwa during the build process.
import { precacheAndRoute } from 'workbox-precaching';

console.log('Service Worker: Script loading...');

// The precacheAndRoute function takes the manifest of files to cache and sets up
// a 'fetch' event listener to serve those files from the cache.
precacheAndRoute(self.__WB_MANIFEST || []);

// 3. Custom Service Worker Logic (Install, Activate, Fetch)
// With workbox-precaching, you no longer need manual 'install' or 'activate' events for caching.
// The 'fetch' event is also handled by precacheAndRoute for the precached assets.

self.addEventListener('install', event => {
  console.log('Service Worker: Install event');
  // self.skipWaiting() ensures the new service worker activates immediately.
  self.skipWaiting(); 
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activate event');
  // self.clients.claim() allows the SW to control the page without a reload.
  event.waitUntil(self.clients.claim()); 
});

// You can still add custom fetch listeners for things not handled by the precache,
// like routing for external APIs, but the basic offline functionality is now handled.
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Let OneSignal handle its own requests
  if (url.hostname.includes('onesignal.com') || url.hostname.includes('os.tc')) {
    return;
  }

  // Example of a custom network strategy for a specific path if needed.
  // This is just an example; you can expand this for your API calls if required.
  if (url.pathname === '/api/some-data') {
    event.respondWith(
      caches.open('api-cache').then(cache => {
        return fetch(request)
          .then(response => {
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => cache.match(request));
      })
    );
  }
  
  // For all other requests, Workbox's precaching strategy will handle them.
});

console.log('Service Worker: Script loaded successfully and configured.');
