import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/react/',
  build: {
    outDir: 'dist'
  },
  publicDir: 'public',
  server: {
    proxy: {
      '/chat': 'http://localhost:3000',
      '/getEmbedToken': 'http://localhost:3000',
      '/getDatasetMetadata': 'http://localhost:3000',
      '/system': 'http://localhost:3000',
      '/fabric': 'http://localhost:3000'
    }
  }
})