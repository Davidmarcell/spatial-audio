import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function normalizeBasePath(basePath: string | undefined) {
  if (!basePath || basePath === '/') return '/'
  const trimmed = basePath.replace(/^\/+|\/+$/g, '')
  return `/${trimmed}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  plugins: [react()],
  preview: {
    host: '127.0.0.1',
    port: 4173,
    open: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true,
  },
})
