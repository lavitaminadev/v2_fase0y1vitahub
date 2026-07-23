import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  envDir: '../../',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'icon-192x192.png', 'icon-512x512.png', 'icon-maskable-512x512.png', 'brand/la-vitamina-mark.svg', 'brand/la-vitamina-lockup.png', 'brand/open-sans.woff2'],
    manifest: {
      name: 'VITAHUB | La Vitamina',
      short_name: 'VITAHUB',
      description: 'Sistema operativo de La Vitamina',
      theme_color: '#173f35',
      background_color: '#f3f5ef',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  })],
  build: {
    rollupOptions: {
      output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
            if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query';
            if (id.includes('node_modules/react-router')) return 'vendor-router';
            if (id.includes('node_modules')) return 'vendor';
            if (id.includes('/src/core/api') || id.includes('/src/core/auth') || id.includes('/packages/shared')) return 'vendor';
          },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
})
