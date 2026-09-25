import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Where "npm run dev" forwards /api requests. Must match PORT in backend/.env.
  const proxyTarget = (env.VITE_PROXY_TARGET || 'http://localhost:5001').replace(/\/+$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  }
})
