import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Opt-in sequential mutation proof, only for the owned contract. Restores exact bytes.
const raiz = fileURLToPath(new URL("../../", import.meta.url));
const arquivo = new URL("../../src/contracts/divergencia.ts", import.meta.url);
const original = readFileSync(arquivo);
const restaurar = () => writeFileSync(arquivo, original);
process.once("SIGINT", () => { restaurar(); process.exit(130); });
process.once("SIGTERM", () => { restaurar(); process.exit(143); });
const mutacoes = [
  ["I1", 'd.estado === "ABERTA" && d.decisao !== null', "false"],
  ["I2", 'd.estado !== "ABERTA" || d.decisao !== null', "false"],
  ["I3", "polos: z.array(PoloDivergencia).min(2)", "polos: z.array(PoloDivergencia).min(1)"],
  ["I4", '/^NCCN(?:\\b|-)/i.test(p.fonteId) && p.natureza !== "PARAFRASE"', "false"],
  ["I5", "new Set(grupo.map(x => x.id)).size !== grupo.length", "false"],
  ["I6", 'd.estado === "SUPERADA" && !d.superadaPor', "false"],
];
let falhou = false;
try {
  for (const [id, de, para] of mutacoes) {
    const texto = original.toString("utf8");
    if (!texto.includes(de)) throw Error(`Mutação ${id} não encontrou o alvo`);
    writeFileSync(arquivo, texto.replace(de, para));
    const r = spawnSync(process.execPath, [fileURLToPath(new URL("../../node_modules/vitest/vitest.mjs", import.meta.url)),
      "run", "tests/divergencias/contrato-regra.test.ts", "--reporter=dot"], { cwd: raiz, encoding: "utf8", timeout: 60000 });
    const evidencia = (r.stdout ?? "") + (r.stderr ?? "");
    const detectada = r.status === 1 && evidencia.includes(`I${id.slice(1)}:`);
    console.log(`${id}: ${detectada ? "DETECTADA (teste falhou)" : "NAO COMPROVADA"}; exit=${r.status}`);
    if (!detectada) { falhou = true; console.log(evidencia.slice(-2000)); }
    restaurar();
  }
} finally { restaurar(); }
if (falhou) process.exitCode = 1;
