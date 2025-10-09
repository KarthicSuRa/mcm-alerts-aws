
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // This tells the plugin to use your custom service worker as a base
      // and inject the list of files to cache into it.
      strategies: 'injectManifest',

      // This points to the source directory and file of your service worker.
      srcDir: 'public',
      filename: 'sw.js', // Correct, current property name

      // This prevents the plugin from adding its own registration script,
      // since you already register the worker in `index.tsx`.
      injectRegister: null,

      // This ensures that the plugin includes all necessary files
      // in the precache manifest for offline support.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wav}'],
      },

      // This configures the PWA `manifest.webmanifest` file generation.
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
