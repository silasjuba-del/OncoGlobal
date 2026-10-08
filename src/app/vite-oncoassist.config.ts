import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({ build: {
  ssr: resolve(process.cwd(), "src/app/oncoassistLocal.ts"),
  outDir: "dist/oncoassist-local", emptyOutDir: true,
  rollupOptions: { output: { entryFileNames: "iniciar.mjs" } },
} });
