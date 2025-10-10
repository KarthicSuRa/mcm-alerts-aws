
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      injectRegister: null,
      workbox: {
        importScripts: [
          'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js',
          'pwa-badging.js'
        ],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wav}'],
      },
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
