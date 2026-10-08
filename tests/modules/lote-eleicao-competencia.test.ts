import { describe, expect, it } from "vitest";
import { montarApacBatch, type ItemApacLote } from "../../src/modules/apac/lote.js";

// D-W5-10: a competência do lote é a do PRIMEIRO item plenamente elegível.
// Item sem competência é excluído e NÃO interrompe a eleição (ordem não esvazia o lote).
const item = (apacId: string, competencia: string | null = "2026-10"): ItemApacLote => ({
  apacId, competencia, cid: "CODIGO-TESTE", esquema: "esquema-sintetico",
  estado: "EMITIDA", artefato: "PRONTO", modalidade: "APAC", motivoBloqueio: null,
});
const aberto = { competencia: null, cid: null, esquema: null, estado: null };

describe("lote APAC · eleição de competência independe da ordem", () => {
  it("item sem competência antes do elegível: elegível entra, sem-competência sai com motivo", () => {
    const lote = montarApacBatch("lote-dia", aberto, [item("apac-x", null), item("apac-a")], "2026-10-08");
    expect(lote.itens).toEqual(["apac-a"]);
    expect(lote.criterio.competencia).toBe("2026-10");
    expect(lote.excluidos).toEqual([
      { apacId: "apac-x", motivo: "competência ausente" },
    ]);
    expect(lote.resultados.map((r) => [r.apacId, r.incluido])).toEqual([["apac-x", false], ["apac-a", true]]);
  });

  it("só itens sem competência: lote vazio, nada presumido", () => {
    const lote = montarApacBatch("lote-dia", aberto, [item("apac-x", null), item("apac-y", null)], "2026-10-08");
    expect(lote.itens).toEqual([]);
    expect(lote.criterio.competencia).toBeNull();
    expect(lote.excluidos.map((e) => e.apacId)).toEqual(["apac-x", "apac-y"]);
  });

  it("bloqueados e fora do critério antes do elegível não roubam a eleição", () => {
    const lote = montarApacBatch("lote-dia", aberto, [
      { ...item("apac-bloq"), artefato: "BLOQUEADO" as const, motivoBloqueio: "campo sem fonte" },
      { ...item("apac-cx"), modalidade: "CIRURGIA" as const },
      { ...item("apac-bloq-sem-motivo"), artefato: "BLOQUEADO" as const, motivoBloqueio: " " },
      item("apac-a"),
    ], "2026-10-08");
    expect(lote.itens).toEqual(["apac-a"]);
    expect(lote.criterio.competencia).toBe("2026-10");
    expect(lote.excluidos.map((e) => e.apacId)).toEqual([
      "apac-bloq", "apac-cx", "apac-bloq-sem-motivo",
    ]);
  });

  it("critério explícito preside: elegível de outra competência não muda o lote", () => {
    const criterio = { competencia: "2026-10", cid: null, esquema: null, estado: null };
    const lote = montarApacBatch("lote-dia", criterio, [item("apac-z", "2026-09")], "2026-10-08");
    expect(lote.itens).toEqual([]);
    expect(lote.criterio.competencia).toBe("2026-10");
    expect(lote.excluidos[0]?.motivo).toBe("fora do critério: competência");
  });
});
