import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // Ensure service worker gets proper treatment
      external: [],
      output: {
        // Don't hash the service worker file
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'sw') {
            return 'sw.js'
          }
          return 'assets/[name]-[hash].js'
        }
      }
    }
  },
  base: '/',
  define: {
    global: 'globalThis',
  },
  // Ensure public files are copied including sw.js
  publicDir: 'public'
}))
