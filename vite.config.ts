import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
  worker: { format: 'es' },
  server: {
    proxy: { '/api': 'http://127.0.0.1:5178' },
  },
});
