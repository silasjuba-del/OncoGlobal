// KIMI-11 · Mapa de lacunas executável.
// Lê docs/w5/MATRIZ.md e confronta os IDs SEM_TESTE com a cobertura real da onda W8-KIMI:
// um ID só sai da lista vermelha quando existe arquivo de teste (tests/cobertura/** ou
// tests/adv-w8/**) com o ID no nome do arquivo ou no título/conteúdo. `it.todo` é proibido.
// Aceite da fatia: o teste RODA e REPORTA a lista real — vermelho no início da onda é o
// checklist vivo; fecha verde no fim (docs/progresso/W8-KIMI.md acompanha fatia a fatia).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const MATRIZ = join(RAIZ, "docs/w5/MATRIZ.md");
const PASTAS_COBERTURA = ["tests/cobertura", "tests/adv-w8"];

/** IDs SEM_TESTE da W5 sob responsabilidade desta onda (docs/ondas/W8-KIMI.md). */
const ALVO_W8 = [
  "G-07", "G-08", "G-09", "G-27", "K-26", "FN-16",
  "N17", "N19", "T-34", "T-49", "T-50", "T-51", "T-56",
] as const;

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();

interface LinhaMatriz { id: string; estado: string }

function lerMatriz(): LinhaMatriz[] {
  const texto = readFileSync(MATRIZ, "utf8");
  const linhas: LinhaMatriz[] = [];
  for (const linha of texto.split("\n")) {
    const m = /^\|\s*([A-Z]{1,3}-?\d{1,2}[a-z]?)\s*\|[^|]*\|[^|]*\|\s*(SEM_TESTE|PARCIAL|COBERTO|FORA_DO_F0)\s*\|/.exec(linha);
    if (m?.[1] && m[2]) linhas.push({ id: m[1], estado: m[2] });
  }
  return linhas;
}

function arquivosTs(pasta: string): string[] {
  const fora: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      // O próprio mapa lista os IDs; não conta como prova nem se varre por it.todo.
      else if (/\.(test|adv)\.ts$/.test(f) && !f.startsWith("_mapa")) fora.push(p);
    }
  };
  walk(pasta);
  return fora;
}

/** Cobertura real: ID (normalizado) no nome do arquivo ou no conteúdo (título/it). */
function coberturaReal(): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  const arquivos = PASTAS_COBERTURA.flatMap((p) => {
    try { return arquivosTs(join(RAIZ, p)); } catch { return []; }
  });
  for (const id of ALVO_W8) {
    const alvo = norm(id);
    const achados = arquivos.filter((a) => {
      if (norm(a).includes(alvo)) return true;
      try { return norm(readFileSync(a, "utf8")).includes(alvo); } catch { return false; }
    }).map((a) => a.replace(RAIZ, "").split("\\").join("/"));
    mapa.set(id, achados);
  }
  return mapa;
}

describe("KIMI-11 · mapa executável de lacunas (docs/w5/MATRIZ.md)", () => {
  const matriz = lerMatriz();
  const semTeste = matriz.filter((l) => l.estado === "SEM_TESTE").map((l) => l.id);
  const parcial = matriz.filter((l) => l.estado === "PARCIAL").map((l) => l.id);
  const cobertura = coberturaReal();

  it("reporta a lista real: SEM_TESTE e PARCIAL da MATRIZ", () => {
    console.log("SEM_TESTE na MATRIZ:", semTeste.join(", "));
    console.log("PARCIAL na MATRIZ (", parcial.length, "):", parcial.join(", "));
    expect(semTeste.length).toBeGreaterThan(0);
    // A MATRIZ da base W5 lista exatamente os 13 IDs sob responsabilidade desta onda.
    expect([...ALVO_W8].sort()).toEqual([...semTeste].sort());
  });

  it("nenhum teste da onda usa it.todo (checklist proibido)", () => {
    for (const pasta of PASTAS_COBERTURA) {
      for (const arquivo of arquivosTs(join(RAIZ, pasta))) {
        expect(readFileSync(arquivo, "utf8"), arquivo).not.toMatch(/\bit\.todo|\.todo\(/);
      }
    }
  });

  it("cada ID SEM_TESTE tem arquivo de prova com o ID no nome ou no conteúdo", () => {
    const faltantes = ALVO_W8.filter((id) => (cobertura.get(id) ?? []).length === 0);
    for (const id of ALVO_W8)
      console.log(`${id}: ${(cobertura.get(id) ?? []).join(", ") || "SEM PROVA AINDA"}`);
    expect(faltantes, `IDs SEM_TESTE sem prova: ${faltantes.join(", ")}`).toEqual([]);
  });
});
