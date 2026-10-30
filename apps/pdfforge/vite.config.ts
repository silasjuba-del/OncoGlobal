import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5199, strictPort: true },
  build: { outDir: 'dist', target: 'chrome128' },
  optimizeDeps: { exclude: ['pdfjs-dist'] },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // O ESM de @cantoo/pdf-lib importa o CJS @pdf-lib/upng por default; o Vite resolve a interop, o Node puro não.
    server: { deps: { inline: ['@cantoo/pdf-lib'] } },
  },
});
