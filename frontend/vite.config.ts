import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8080' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'jsmediatags': path.resolve(__dirname, 'node_modules/jsmediatags/dist/jsmediatags.min.js'),
    },
  },
  optimizeDeps: {
    include: ['butterchurn', 'butterchurn-presets'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'framer-motion', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 8000,
  },
});
