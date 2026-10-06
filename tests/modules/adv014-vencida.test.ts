import { describe, expect, it } from "vitest";
import { montarApacBatch, type ItemApacLote } from "../../src/modules/apac/lote.js";

// Copiado de f0/w5-red@4890792:tests/adv/f08-vencida.adv.test.ts.
const item = (id: string, estado: ItemApacLote["estado"]): ItemApacLote => ({
  apacId: id, competencia: "2026-10", cid: "CODIGO-TESTE", esquema: "esquema-sintetico",
  estado, artefato: "PRONTO", modalidade: "APAC", motivoBloqueio: null,
});
const aberto = { competencia: null, cid: null, esquema: null, estado: null };

describe("F8 · D90 vencida não entra na seleção de faturamento (saída de função apenas)", () => {
  it("ADV-014 · critério aberto não inclui VENCIDA apesar de artefato PRONTO", () => {
    expect(montarApacBatch("lote-01", aberto, [item("vencida-1", "VENCIDA")], "2026-10-05").itens).toEqual([]);
  });
  it("ADV-014 · pedido explícito por VENCIDA não converte prazo vencido em item elegível", () => {
    expect(montarApacBatch("lote-02", { ...aberto, estado: "VENCIDA" },
      [item("vencida-2", "VENCIDA")], "2026-10-05").itens).toEqual([]);
  });
  it("ADV-014 · item vencido é excluído sem derrubar item emitido no mesmo lote", () => {
    const r = montarApacBatch("lote-03", aberto,
      [item("emitida", "EMITIDA"), item("vencida-3", "VENCIDA")], "2026-10-05");
    expect(r.itens).toEqual(["emitida"]);
    expect(r.trava).toBe(false);
  });
});
