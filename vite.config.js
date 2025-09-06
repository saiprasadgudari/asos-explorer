import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Forward our exact API paths during dev
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/stations': {
        target: 'https://sfc.windbornesystems.com',
        changeOrigin: true
      },
      '/historical_weather': {
        target: 'https://sfc.windbornesystems.com',
        changeOrigin: true
      }
    }
  }
})
