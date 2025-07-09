import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.NODE_ENV === 'production'
    ? '/tciket_hub/' // ✅ GitHub Pages path – match your actual repo name exactly
    : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js']
  },
  server: {
    fs: {
      strict: false
    }
  }
})
