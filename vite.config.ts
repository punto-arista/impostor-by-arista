/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg', 'icons/apple-180.png'],
      manifest: {
        name: 'impostor. by arista',
        short_name: 'impostor.',
        description: 'impostor: todos saben la palabra. menos uno.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'portrait',
        background_color: '#111512',
        theme_color: '#111512',
        icons: [
          { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache de todo el build. Las llamadas a Supabase NO se cachean aquí:
        // el catálogo vive en IndexedDB (src/data/catalog.ts).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El catálogo semilla solo se usa en modo local (sin Supabase): no se precachea.
        globIgnores: ['**/seed-*.js'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
  },
});
