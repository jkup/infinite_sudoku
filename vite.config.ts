import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Load CLERK_PUBLIC from .dev.vars (local dev) or process.env (Cloudflare build)
function getClerkPublicKey(): string {
  if (process.env.CLERK_PUBLIC) return process.env.CLERK_PUBLIC
  try {
    const vars = readFileSync('.dev.vars', 'utf-8')
    const match = vars.match(/^CLERK_PUBLIC=(.+)$/m)
    return match?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
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
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/sign-in/, /^\/sign-up/],
      },
    }),
  ],
  define: {
    'import.meta.env.CLERK_PUBLIC': JSON.stringify(getClerkPublicKey()),
  },
})
