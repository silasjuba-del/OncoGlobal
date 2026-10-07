import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const codigos = new Set(["ARGUMENTOS_INVALIDOS", "DATA_DIR_ABSOLUTO_OBRIGATORIO", "PORTA_INVALIDA",
  "CREDENCIAIS_LOCAIS_AUSENTES", "LEDGER_LOCAL_AUSENTE", "CONFIGURACAO_LOCAL_INVALIDA", "SERVIDOR_LOCAL_INDISPONIVEL"]);
try {
  execFileSync(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "build", "--config", "src/app/vite-oncoassist.config.ts"],
    { cwd: root, stdio: "pipe" });
  const { startCLI } = await import(pathToFileURL(resolve(root, "dist/oncoassist-local/iniciar.mjs")).href);
  await startCLI(process.argv.slice(2));
} catch (erro) {
  console.error(erro instanceof Error && codigos.has(erro.message) ? erro.message : "FALHA_AO_INICIAR_ONCOASSIST");
  process.exitCode = 1;
}
