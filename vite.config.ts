import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.CLERK_PUBLIC': JSON.stringify(getClerkPublicKey()),
  },
})
