import { isAbsolute, relative } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// W5 §4-P2 (AMB-P03): as provas vermelhas do RED (tests/adv/**) ficam FORA da execução padrão
// (`vitest run` = `npm test` = última etapa do `npm run verify`). Entram só quando pedidas:
//   npx vitest run tests/adv --no-file-parallelism
//   npx vitest run tests/adv/<arquivo> --no-file-parallelism
// ou com W5_ADV=1. O `tsc --noEmit` continua cobrindo tests/adv (o tsconfig não muda).
const PASTA_ADV = "tests/adv";

function normalizarFiltro(arg: string, raiz: string): string {
  const relativo = isAbsolute(arg) ? relative(raiz, arg) : arg;
  return relativo.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
}

/** true só quando a linha de comando (filtro começando com tests/adv) ou W5_ADV=1 pede tests/adv. */
export function pedeTestesAdv(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  raiz: string,
): boolean {
  if (env.W5_ADV === "1") return true;
  return argv.some((arg) => {
    if (arg.startsWith("-")) return false;
    const filtro = normalizarFiltro(arg, raiz);
    return filtro === PASTA_ADV || filtro.startsWith(`${PASTA_ADV}/`);
  });
}

export default defineConfig(async () => {
  const plugins = [];
  if (!process.env.VITEST) {
    const { default: react } = await import("@vitejs/plugin-react");
    plugins.push(react());
  }
  const comAdv = pedeTestesAdv(process.argv.slice(2), process.env, process.cwd());
  return {
    plugins,
    test: {
      // Preserva o exclude padrão do Vitest; tests/adv/** sai da execução padrão.
      exclude: comAdv ? [...configDefaults.exclude] : [...configDefaults.exclude, `**/${PASTA_ADV}/**`],
      // O plugin do React junto do jsdom estoura os 60s de arranque do worker no Windows.
      pool: "threads",
      maxWorkers: 1,
      // npm run verify termina em `npm test` sem flag CLI; ainda assim, um arquivo por vez.
      fileParallelism: false,
    },
  };
});
