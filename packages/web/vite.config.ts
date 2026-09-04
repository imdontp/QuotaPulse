import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 7677,
    // `npm run dev -w @quotapulse/web` proxies to the daemon so the dashboard can be
    // developed with hot reload against live data.
    proxy: { '/api': { target: 'http://127.0.0.1:7676', changeOrigin: true } },
  },
});
