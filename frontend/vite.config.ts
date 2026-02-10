import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/feedbackatm/',
  resolve: {
    alias: {
      '../../shared-components': path.resolve(__dirname, '../../shared-components'),
    },
    dedupe: ['react', 'react-dom', 'lucide-react'],
  },
  build: {
    commonjsOptions: {
      include: [/shared-components/, /node_modules/],
    },
  },
  preview: {
    port: 5174,
    host: '0.0.0.0',
    allowedHosts: ['wtm.az', 'localhost', '127.0.0.1'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
