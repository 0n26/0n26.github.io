import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { normalizePath } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    fs: {
      // Keep Vite's default deny list when excluding private service checkouts.
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**',
        `${normalizePath(fileURLToPath(new URL('./services/', import.meta.url)))}**`],
    },
  },
  test: {
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
  plugins: [
    react(),
    {
      name: 'title-retry-url',
      resolveId(id) {
        if (id === 'virtual:title-retry-url') return '\0' + id;
      },
      load(id) {
        if (id !== '\0virtual:title-retry-url') return;
        if (this.environment.mode !== 'build') return 'export default "/src/pages/title/index.ts"';
        const ref = this.emitFile({ type: 'chunk', id: fileURLToPath(new URL('./src/pages/title/index.ts', import.meta.url)) });
        return `export default import.meta.ROLLUP_FILE_URL_${ref}`;
      },
    },
    {
      name: 'pages-oauth-callback',
      apply: 'build',
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          const index = bundle['index.html'];
          if (index?.type !== 'asset') this.error('Missing application HTML for the OAuth callback');
          // Pages serves callback.html at the exact slashless URL before trying a directory redirect.
          for (const fileName of ['auth/callback.html', 'auth/callback/index.html']) {
            this.emitFile({ type: 'asset', fileName, source: index.source });
          }
        },
      },
    },
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
