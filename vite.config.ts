import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project repo (not <owner>.github.io itself) from a
// subpath — https://<owner>.github.io/Site-Wizard/ — so every asset URL,
// the manifest's start_url/scope, and the service worker's precache all
// need that prefix. Local dev and any other static host (Vercel, Netlify,
// a plain `npm run preview`) serve from the root, so this only applies
// when the deploy workflow sets GITHUB_PAGES=true.
const isGhPagesBuild = process.env.GITHUB_PAGES === 'true'
const base = isGhPagesBuild ? '/Site-Wizard/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // The report template is fetched at generation time (reportGeneration.ts)
      // — it must be precached or report generation breaks offline. Workbox's
      // default globPatterns don't include .docx, so it's added explicitly;
      // this pattern already covers everything under public/ (icons,
      // favicon, the template) once copied into the build output. ttf/otf/
      // woff2 cover the self-hosted brand fonts (Futura BT, Roboto Slab,
      // Cormorant Garamond) — headings and eyebrows would silently fall
      // back to the platform font offline without them.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,docx,ttf,otf,woff2}'],
      },
      manifest: {
        name: 'Site Wizard — Field Reports',
        short_name: 'Site Wizard',
        description: 'Offline field capture and report generation for structural site visits.',
        theme_color: '#003D4C', // W+R brand primary (design handoff, Direction 3)
        background_color: '#faf8f4',
        display: 'standalone',
        start_url: base,
        scope: base,
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
