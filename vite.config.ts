
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The strategy is now 'generateSW' to let the plugin create the service worker.
      strategies: 'generateSW',

      // We no longer need srcDir or filename for this strategy.

      // This is kept as null since you handle registration in index.tsx.
      injectRegister: null,

      // A workbox object is added to inject the OneSignal script correctly.
      workbox: {
        // This imports the OneSignal SDK into the generated service worker.
        // It will be placed at the top of the file, as required.
        importScripts: [
          'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js',
        ],
        // This ensures all your assets are still cached for offline use.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wav}'],
      },

      // Your PWA manifest remains unchanged.
      manifest: {
        name: 'MCM Alerts',
        short_name: 'MCM Alerts',
        description: 'A reliable notification system for monitoring website uptime, service status, and critical system events. Get instant alerts when it matters most.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0d1117',
        theme_color: '#161b22',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
      },

      devOptions: {
        enabled: true
      },
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
