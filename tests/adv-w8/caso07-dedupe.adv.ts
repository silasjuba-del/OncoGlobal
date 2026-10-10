// KIMI-17 · CASO 07 · deduplicação de exames (D1/D2 — CASO-REAL-01-LICOES.md §2).
// Regra: chave = laboratório + número do exame + data de entrada; NUNCA a data impressa no
// topo. D1: páginas idênticas ⇒ um exame. D2: reimpressão com cabeçalho de extração
// diferente ⇒ um exame. D3: mesmo diagnóstico, materiais/datas diferentes ⇒ dois exames.
// ESTADO 2026-10-07: o gate de presença passa. O motor que o teste resolve é
// src/modules/documentos/dedupe.ts (unicos/duplicatas; chave laboratorio+numeroExame+dataEntrada).
// Não trocar por src/rules/w8/dedupeExame.ts: o contrato é outro. Título SEM_IMPLEMENTACAO
// permanece histórico; a asserção not.toBeNull() não foi afrouxada.
import { describe, expect, it } from "vitest";

interface ResultadoDedupe { unicos: number; duplicatas: { paginas: string[] }[] }

async function deduplicar(): Promise<((paginas: unknown[]) => ResultadoDedupe) | null> {
  for (const caminho of ["../../src/leitura/dedupe.js", "../../src/modules/documentos/dedupe.js",
    "../../src/leitura/exames.js"]) {
    try {
      const mod = (await import(caminho)) as Record<string, unknown>;
      const fn = mod["deduplicarExames"] ?? mod["dedupeExames"] ?? mod["deduplicar"];
      if (typeof fn === "function") return fn as (paginas: unknown[]) => ResultadoDedupe;
    } catch { /* módulo ausente */ }
  }
  return null;
}

describe("CASO 07 · D1/D2 · deduplicação de exames por (laboratório, nº exame, data de entrada)", () => {
  it("SEM_IMPLEMENTACAO: existe motor de deduplicação de exames (DEPENDE_W7 — faixa src/leitura)", async () => {
    expect(await deduplicar(),
      "Caso 07: 8 páginas de exame devem colapsar para 6 exames únicos (cintilografia ×2, " +
      "IHQ ×2); sem motor de dedupe em src/, nada verifica a chave D2 nem impede contagem em dobro").not.toBeNull();
  });

  it("D1 · positivo: páginas idênticas da cintilografia colapsam para UM exame (MED-5001)", async () => {
    const fn = await deduplicar();
    if (!fn) return;
    const r = fn([
      { arquivo: "07", laboratorio: "MN", numeroExame: "MED-5001", dataEntrada: "2026-07-22", conteudo: "X" },
      { arquivo: "08", laboratorio: "MN", numeroExame: "MED-5001", dataEntrada: "2026-07-22", conteudo: "X" },
    ]);
    expect(r.unicos).toBe(1);
  });

  it("D2 · positivo: reimpressão com data de extração diferente no topo NÃO impede a dedupe", async () => {
    const fn = await deduplicar();
    if (!fn) return;
    const r = fn([
      { arquivo: "10", laboratorio: "LAB", numeroExame: "LAB-9004", dataEntrada: "2026-08-06",
        dataImpressaNoTopo: "2026-08-09", conteudo: "IHQ" },
      { arquivo: "11", laboratorio: "LAB", numeroExame: "LAB-9004", dataEntrada: "2026-08-06",
        dataImpressaNoTopo: "2026-09-01", conteudo: "IHQ (reimpressão)" },
    ]);
    expect(r.unicos).toBe(1); // a chave nunca usa a data impressa no topo
  });

  it("D3 · negativo: RTU e IHQ com o mesmo diagnóstico permanecem DOIS exames", async () => {
    const fn = await deduplicar();
    if (!fn) return;
    const r = fn([
      { arquivo: "09", laboratorio: "LAB", numeroExame: "LAB-9003", dataEntrada: "2026-08-05" },
      { arquivo: "10", laboratorio: "LAB", numeroExame: "LAB-9004", dataEntrada: "2026-08-06" },
    ]);
    expect(r.unicos).toBe(2);
  });
});
