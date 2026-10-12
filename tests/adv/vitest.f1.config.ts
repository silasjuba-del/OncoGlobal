import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** F1 regular + adversarial: a configuração raiz exclui tests/adv por padrão. */
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    include: [
      'tests/f1/**/*.{test,spec,adv}.{ts,tsx}',
      'tests/adv/f1*.{test,spec,adv}.{ts,tsx}',
      'tests/adv/f1*/**/*.{test,spec,adv}.{ts,tsx}',
    ],
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
    passWithNoTests: false,
  },
});
