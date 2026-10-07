import { describe, expect, it } from "vitest";
import { montarApacBatch } from "../../src/modules/apac/lote.js";
import type { ItemApacLote } from "../../src/modules/apac/lote.js";

const CRITERIO = { competencia: "2026-10", cid: "C50", esquema: "esquema-teste", estado: "EMITIDA" as const };

function item(sobre: Partial<ItemApacLote> & Pick<ItemApacLote, "apacId">): ItemApacLote {
  return {
    competencia: "2026-10",
    cid: "C50",
    esquema: "esquema-teste",
    estado: "EMITIDA",
    artefato: "PRONTO",
    modalidade: "APAC",
    motivoBloqueio: null,
    ...sobre,
  };
}

describe("GRK-08 lote APAC", () => {
  it("positivo: agrupa quem casa com o critério e devolve resultado por item", () => {
    const lote = montarApacBatch("lote-01", CRITERIO, [
      item({ apacId: "apac-1" }),
      item({ apacId: "apac-2" }),
    ], "2026-10-05");
    expect(lote.itens).toEqual(["apac-1", "apac-2"]);
    expect(lote.excluidos).toEqual([]);
    expect(lote.resultados).toHaveLength(2);
    expect(lote.geradoEm).toBe("2026-10-05");
    expect(lote.trava).toBe(false);
    expect(lote.criterio).toEqual(CRITERIO);
  });

  it("negativo: bloqueado sai com motivo e cirurgia (AIH) fica de fora, sem parar os demais", () => {
    const lote = montarApacBatch("lote-01", CRITERIO, [
      item({ apacId: "apac-ok" }),
      item({ apacId: "apac-bloq", artefato: "BLOQUEADO", motivoBloqueio: "campo sem fonte" }),
      item({ apacId: "apac-cx", modalidade: "CIRURGIA" }),
      item({ apacId: "apac-outro", competencia: "2026-09" }),
    ], "2026-10-05");
    expect(lote.itens).toEqual(["apac-ok"]);
    expect(lote.trava).toBe(false);
    expect(lote.excluidos).toEqual([
      { apacId: "apac-bloq", motivo: "campo sem fonte" },
      { apacId: "apac-cx", motivo: "cirurgia segue por AIH, fora da APAC" },
      { apacId: "apac-outro", motivo: "fora do critério: competência" },
    ]);
    expect(lote.resultados.map((r) => r.incluido)).toEqual([true, false, false, false]);
  });

  it("borda: critério nulo não filtra; bloqueio sem motivo fica [VERIFICAR]; id repetido não elege", () => {
    const aberto = montarApacBatch("lote-02", {
      competencia: null, cid: null, esquema: null, estado: null,
    }, [
      // D-W5-10: competência ausente não fatura; o teste mantém só "critério nulo não filtra".
      item({ apacId: "apac-a", competencia: "2026-10", cid: null, esquema: null, estado: "RASCUNHO" }),
    ], "2026-10-05");
    expect(aberto.itens).toEqual(["apac-a"]);

    const semMotivo = montarApacBatch("lote-03", CRITERIO, [
      item({ apacId: "apac-b", artefato: "BLOQUEADO", motivoBloqueio: " " }),
      item({ apacId: "apac-c" }),
    ], "2026-10-05");
    expect(semMotivo.excluidos[0]?.motivo).toContain("[VERIFICAR]");
    expect(semMotivo.itens).toEqual(["apac-c"]);

    const repetido = montarApacBatch("lote-04", CRITERIO, [
      item({ apacId: "apac-d" }),
      item({ apacId: "apac-d" }),
      item({ apacId: "apac-e" }),
    ], "2026-10-05");
    expect(repetido.itens).toEqual(["apac-e"]);
    expect(repetido.trava).toBe(false);
    expect(repetido.resultados.filter((r) => !r.incluido)).toHaveLength(2);
  });
});
