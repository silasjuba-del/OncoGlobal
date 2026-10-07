import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({build:{ssr:resolve(process.cwd(),'src/app/estudio/iniciar.ts'),outDir:'dist/w7-estudio',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'iniciar.mjs'}}}});
