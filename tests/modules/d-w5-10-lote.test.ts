import { describe, expect, it } from "vitest";
import { montarApacBatch, type ItemApacLote } from "../../src/modules/apac/lote.js";

// D-W5-10 (Dr. Silas, 2026-10-06): lote diário ao faturamento junta VÁRIOS pacientes, UMA competência.
const item = (apacId: string, competencia: string | null = "2026-10"): ItemApacLote => ({
  apacId, competencia, cid: "CODIGO-TESTE", esquema: "esquema-sintetico",
  estado: "EMITIDA", artefato: "PRONTO", modalidade: "APAC", motivoBloqueio: null,
});
const aberto = { competencia: null, cid: null, esquema: null, estado: null };

describe("D-W5-10 · lote APAC diário", () => {
  it("APACs de pacientes diferentes na mesma competência entram juntas (ex-ADV-007)", () => {
    const lote = montarApacBatch("lote-dia", aberto, [item("apac-p01"), item("apac-p02"), item("apac-p03")], "2026-10-06");
    expect(lote.itens).toEqual(["apac-p01", "apac-p02", "apac-p03"]);
  });
  it("outra competência sai com motivo e não derruba o lote (ADV-008)", () => {
    const lote = montarApacBatch("lote-dia", aberto, [item("apac-a"), item("apac-b", "2026-11")], "2026-10-06");
    expect(lote.itens).toEqual(["apac-a"]);
    expect(lote.criterio.competencia).toBe("2026-10");
    expect(lote.excluidos[0]?.motivo).toContain("outra competência");
  });
  it("competência ausente fica fora, nunca presumida", () => {
    const lote = montarApacBatch("lote-dia", aberto, [item("apac-a"), item("apac-x", null)], "2026-10-06");
    expect(lote.itens).toEqual(["apac-a"]);
  });
});
