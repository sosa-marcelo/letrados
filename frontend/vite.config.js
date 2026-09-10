import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo el frontend corre en 5173 y el backend en 3000.
// El proxy manda todo lo que empieza con /api al backend, así no hace falta CORS.
// En producción Express sirve el `dist` compilado y la API en el mismo origen,
// por eso el cliente HTTP siempre usa rutas relativas (/api/...).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
