import { defineConfig } from "vitest/config";
// Reproducoes fora do escopo de escrita W3: devem falhar enquanto o dono nao corrigir.
// Executar explicitamente; nao enfraquecer expectativas nem marcar como skip/fails.
export default defineConfig({ test: { include: ["tests/w3/*.repro.ts"], fileParallelism: false } });
