// Config dedicada às provas de layout e movimento em Chromium real (tests/hostil-cursor/navegador/*).
// O Vitest raiz só inclui *.{test,spec}.*; *.navegador.ts fica FORA da suíte regular porque os
// shards de CI não instalam navegador. Roda no job browser-b2, depois do `playwright install`.
// Uso: npx vitest run --config tests/hostil-cursor/navegador/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: new URL("../../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  test: {
    include: ["tests/hostil-cursor/navegador/**/*.navegador.ts"],
    pool: process.platform === "win32" ? "forks" : "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
