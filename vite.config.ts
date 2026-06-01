import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
  server: { port: 5173 },
});
