// sw.ts
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// --- Workbox (from vite-plugin-pwa) --- //
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
