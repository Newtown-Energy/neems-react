import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'host.docker.internal',  // Allow Docker's hostname
      'localhost'              // Keep local access
    ],
    proxy: {
      '/api/': {
        target: process.env.NEEMS_CORE_SERVER ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api') // keeps the /api prefix
      }
    }
  }
})
