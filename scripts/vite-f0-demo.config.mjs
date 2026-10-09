import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({ build: {
  ssr: resolve(process.cwd(), "tests/f0-fecha/fixtures/demo-servidor.ts"),
  outDir: "dist/f0-demo", emptyOutDir: false,
  rollupOptions: { output: { entryFileNames: "demo-servidor.mjs" } },
} });
