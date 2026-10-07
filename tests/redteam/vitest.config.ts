// Config dedicada às provas adversariais da W10-REDTEAM-GLM (tests/redteam/*).
// O Vitest raiz só inclui *.{test,spec}.ts; esta config inclui também *.adv.ts
// (arquivos que provam falha real e ficam FORA da suíte regular).
// Uso: npx vitest run --config tests/redteam/vitest.config.ts --no-file-parallelism
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  test: {
    include: ["tests/redteam/**/*.test.ts", "tests/redteam/**/*.adv.ts"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
