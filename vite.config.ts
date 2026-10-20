import { existsSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Inside Docker on Windows or macOS, a mounted folder doesn't send file-change events,
// so the dev server polls instead. Otherwise edits and git pulls show stale code.
const inDocker = existsSync('/.dockerenv')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: inDocker ? { host: true, watch: { usePolling: true, interval: 300 } } : {},
})
