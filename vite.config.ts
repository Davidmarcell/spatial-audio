import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { recordingMiddleware } from './server/recordingMiddleware'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FREESOUND_');
  const middleware = recordingMiddleware(process.env.FREESOUND_API_KEY || env.FREESOUND_API_KEY);
  return {
  plugins: [react(), {
    name: 'saudade-recording-discovery',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  }],
  preview: {
    host: '127.0.0.1',
    port: 4173,
    open: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    open: false,
  },
}})
