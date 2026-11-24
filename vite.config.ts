import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      manifest: {
        name: 'Ночной сеанс',
        short_name: 'Ночной сеанс',
        description: 'Каталог и плеер аниме',
        lang: 'ru',
        theme_color: '#14141a',
        background_color: '#14141a',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Only the manifest icons are precached; navigations and Gateway requests stay on the network.
        cacheId: '0n26',
        importScripts: ['pwa-cache-cleanup.js'],
        globPatterns: [],
        navigateFallback: null,
        inlineWorkboxRuntime: true,
        cleanupOutdatedCaches: false,
      },
    }),
  ],
});
