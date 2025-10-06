// sw.ts
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// --- OneSignal Service Worker --- //
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// --- Workbox (from vite-plugin-pwa) --- //
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
