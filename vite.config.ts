import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolveClerkPublicKey } from './scripts/lib/clerkPublicKey'

function readOptional(file: string): string | null {
  try { return readFileSync(file, 'utf-8') } catch { return null }
}

// process.env override, then a developer's .dev.vars, then the committed
// production value in wrangler.jsonc (see scripts/lib/clerkPublicKey.ts).
function getClerkPublicKey(): string {
  return resolveClerkPublicKey({
    env: process.env.CLERK_PUBLIC,
    devVars: readOptional('.dev.vars'),
    wranglerConfig: readOptional('wrangler.jsonc'),
  })
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Infinite Sudoku',
        short_name: 'Sudoku',
        description: 'A beautiful, endlessly replayable Sudoku game',
        theme_color: '#6366f1',
        background_color: '#1e1b4b',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  define: {
    'import.meta.env.CLERK_PUBLIC': JSON.stringify(getClerkPublicKey()),
  },
  server: {
    // Set by scripts/dev-full.mjs: route API calls to the local Pages Functions.
    proxy: process.env.PAGES_PORT
      ? { '/api': { target: `http://localhost:${process.env.PAGES_PORT}`, changeOrigin: false } }
      : undefined,
  },
})
