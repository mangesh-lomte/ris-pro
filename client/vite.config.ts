import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/viewer': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/app-config.js': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/app.bundle': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '^/.*\\.bundle\\..*': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '^/.*\\.wasm$': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/init-service-worker.js': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/dicom-web': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/wado': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
});

