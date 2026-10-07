// RT-11 · BRAIN_OS e ragGRAFO (S1) — LACUNAS: trials, proteção de dose de estudo,
// verificação de arestas em runtime e confronto de fontes divergentes não existem.
// O grafo é referência: nenhum consumidor (nem bom nem mau) o lê ainda.
// Dono provável: BRAIN_OS/ragGRAFO (equipe interna) + src/rules (consumidores, curadoria).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function probe(mod: string, nomes: readonly string[]): Promise<unknown> {
  try {
    const m = (await import(mod)) as Record<string, unknown>;
    for (const nome of nomes) if (typeof m[nome] === "function") return m[nome];
  } catch {
    // módulo inexistente
  }
  return null;
}

const dadosDir = join(process.cwd(), "docs", "referencias", "ragGRAFO-oncologia", "dados");

describe("RT-11 · conhecimento nunca vira regra nem ficha", () => {
  it("SEM_IMPLEMENTACAO: avaliador de trial existe (status_resultado negativo nunca apresentado como ganho)", async () => {
    const fn = await probe("../../src/rules/trials.js", ["avaliarTrial", "resumirTrial"])
      ?? await probe("../../src/kernel/trials.js", ["avaliarTrial"]);
    expect(fn,
      "D-W9-48: trials só POSSIBLE_MATCH (referência + oportunidade, nunca 'elegível'); modelo 02 " +
      "define resumo em uma frase. Não existe módulo de trial: um nó de grafo com status_resultado " +
      "negativo poderia ser apresentado como ganho sem nenhum consumidor que impeça. " +
      "Dono provável: BRAIN_OS (equipe interna) + contracts.")
      .toBeTypeOf("function");
  });

  it("SEM_IMPLEMENTACAO: barreira dose-de-estudo → ficha existe (D-W9-22i)", async () => {
    const fn = await probe("../../src/rules/prescricao/index.js", ["recusarDoseEstudo", "ehDoseDeEstudo"]);
    expect(fn,
      "D-W9-22i: esquemas com dose de estudo (TPF, ddMVAC, capecitabina mg/m² '1 cp'…) NÃO entram " +
      "como ficha sem revisão do Dr. Silas. Nenhum código marca origem de dose nem recusa importar " +
      "dose de braço de estudo para ficha. Dono: src/rules/prescricao/** + curadoria.")
      .toBeTypeOf("function");
  });

  it("SEM_IMPLEMENTACAO: verificador de arestas órfãs em runtime existe (o grafo é dado vivo)", async () => {
    const fn = await probe("../../src/kernel/grafo.js", ["verificarArestas", "carregarGrafo"])
      ?? await probe("../../src/kernel/brainos.js", ["carregarGrafo"]);
    expect(fn,
      "O ragGRAFO existe só como JSONL de referência (nos.jsonl/arestas.jsonl). Nenhum loader em " +
      "src/ valida arestas ao carregar: uma aresta órfã (nó removido) atravessaria silenciosamente " +
      "no momento em que um consumidor existir. Dono provável: kernel (BRAIN_OS) — faixa equipe interna.")
      .toBeTypeOf("function");
  });

  it("SEM_IMPLEMENTACAO: confronto de duas fontes divergentes mostra AMBAS (aula × diretriz FINAL)", async () => {
    const fn = await probe("../../src/kernel/projections/snapshot.js", ["fontesDivergentes"])
      ?? await probe("../../src/kernel/conhecimento.js", ["confrontarFontes"]);
    expect(fn,
      "D-W9-22c: conflito entre fontes aparece, nunca some; NÃO_VERIFICADO nunca é preenchido em " +
      "silêncio por outra fonte. Não há consumidor do grafo que, diante de nó de aula (NAO_VERIFICADO) " +
      "e diretriz FINAL divergentes, exiba ambas. Dono: kernel + curadoria.")
      .toBeTypeOf("function");
  });

  it("nó NAO_VERIFICADO do grafo não é carregado por nenhum ruleset (referência ≠ regra)", () => {
    const nos = readFileSync(join(dadosDir, "nos.jsonl"), "utf8")
      .split("\n").filter(Boolean).map((l) => JSON.parse(l) as { status?: string });
    const naoVerificados = nos.filter((n) => n.status === "NAO_VERIFICADO");
    // Base real: 2.746 nós NAO_VERIFICADO (aulas PRO) + diretrizes FINAIS; todos com status.
    expect(naoVerificados.length).toBeGreaterThan(0);
    expect(nos.every((n) => typeof n.status === "string" && n.status.length > 0)).toBe(true);
    // E nenhum ruleset do corpus declara origem no grafo:
    for (const nome of ["dose.v1.json", "salao-triagem.v1.json", "interacoes.v1.json"]) {
      const rs = JSON.parse(readFileSync(join(process.cwd(), "corpus", "rulesets", nome), "utf8")) as {
        header?: { fonte?: { tipo?: string; referencia?: string } };
      };
      expect(rs.header?.fonte?.referencia ?? "").not.toMatch(/ragGRAFO/iu);
    }
  });
});
