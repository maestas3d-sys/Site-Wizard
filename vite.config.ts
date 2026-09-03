import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // The report template is fetched at generation time (reportGeneration.ts)
      // — it must be precached or report generation breaks offline. Workbox's
      // default globPatterns don't include .docx, so it's added explicitly;
      // this pattern already covers everything under public/ (icons,
      // favicon, the template) once copied into the build output.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,docx}'],
      },
      manifest: {
        name: 'Site Wizard — Field Reports',
        short_name: 'Site Wizard',
        description: 'Offline field capture and report generation for structural site visits.',
        theme_color: '#0f4c5c',
        background_color: '#f1f5f9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
