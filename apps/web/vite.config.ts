import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // cPanel keeps the production .env at the repository root, outside public_html.
  envDir: '../../',
  plugins: [
    react(),
    VitePWA({
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
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
