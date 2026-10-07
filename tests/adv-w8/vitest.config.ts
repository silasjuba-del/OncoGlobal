// Config dedicada às provas adversariais da W8-KIMI (tests/adv-w8/*.adv.ts).
// O vitest raiz só inclui *.{test,spec}.ts e a pasta tests/adv-w8 não tem configuração
// própria no vite.config.ts (fora da faixa do executor); esta config fica DENTRO da faixa.
// Uso: npx vitest run --config tests/adv-w8/vitest.config.ts [filtro]
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  test: {
    include: ["tests/adv-w8/**/*.adv.ts"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
