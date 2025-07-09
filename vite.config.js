// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import { resolve } from 'path'

// export default defineConfig({
//   plugins: [react()],
//   base: '/ticketing-system/',
//   build: {
//     outDir: 'dist',
//     rollupOptions: {
//       input: {
//         main: resolve(__dirname, 'index.html'),
//       },
//     },
//   },
//   resolve: {
//     alias: {
//       '@': resolve(__dirname, 'src'),
//     },
//   },
//   optimizeDeps: {
//     include: ['@supabase/supabase-js'],
//   },
// })

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  // Use `/ticketing-system/` only when building for production
  base: process.env.NODE_ENV === 'production'
    ? '/ticketing-system/'
    : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
  },
  // Optional: you can explicitly turn on the SPA fallback
  server: {
    fs: {
      strict: false,
    }
  }
})
