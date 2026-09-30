import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ['.'] },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          radix: ['radix-ui', 'cmdk'],
          // recharts is deliberately NOT listed. Naming it here hoisted it out
          // of the lazily-loaded dashboard routes into a shared chunk, which
          // Vite then added to index.html's modulepreload — so every visitor
          // downloaded 109KB of charting library on the homepage and the
          // creators page, for something only the admin and creator dashboards
          // render. Left unlisted, it rides along inside those routes' own
          // chunks and is fetched only when someone opens one.
        },
      },
    },
  },
})
