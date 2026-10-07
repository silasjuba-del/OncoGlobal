import { describe, expect, it } from "vitest";
import { montarApacBatch } from "../../src/modules/apac/lote.js";
import type { ItemApacLote } from "../../src/modules/apac/lote.js";

const criterio = { competencia: "2026-10", cid: null, esquema: null, estado: "EMITIDA" };
const item = (apacId: string, alteracoes: Partial<ItemApacLote> = {}): ItemApacLote => ({
  apacId,
  competencia: "2026-10",
  cid: null, esquema: null, estado: "EMITIDA",
  artefato: "PRONTO", modalidade: "APAC", motivoBloqueio: null,
  ...alteracoes,
});

describe("Q36/F8 · ApacBatch operacional (escopo: seleção de itens, sem identidade do paciente)", () => {
  it("positivo: itens válidos permanecem no lote após excluir item bloqueado", () => {
    const itens = [
      item("apac-teste-01"),
      item("apac-teste-bloqueada", { artefato: "BLOQUEADO", motivoBloqueio: "dado pendente" }),
      item("apac-teste-02"),
    ];
    const resultado = montarApacBatch("lote-teste", criterio, itens, "2026-10-05");
    expect(resultado.itens).toEqual(["apac-teste-01", "apac-teste-02"]);
    expect(resultado.excluidos).toEqual([{ apacId: "apac-teste-bloqueada", motivo: "dado pendente" }]);
    expect(resultado.resultados.map((r) => r.incluido)).toEqual([true, false, true]);
    expect(resultado.trava).toBe(false);
  });

  it("negativo: competência divergente, duplicata e cirurgia saem; outra APAC segue", () => {
    const resultado = montarApacBatch("lote-teste", criterio, [
      item("apac-teste-ok"),
      item("apac-teste-outra-competencia", { competencia: "2026-09" }),
      item("apac-teste-repetida"),
      item("apac-teste-repetida"),
      item("cirurgia-teste", { modalidade: "CIRURGIA" }),
    ], "2026-10-05");
    expect(resultado.itens).toEqual(["apac-teste-ok"]);
    expect(resultado.excluidos.map((e) => e.apacId)).toEqual([
      "apac-teste-outra-competencia", "apac-teste-repetida",
      "apac-teste-repetida", "cirurgia-teste",
    ]);
    expect(resultado.excluidos.every((e) => e.motivo.length > 0)).toBe(true);
    expect(resultado.trava).toBe(false);
  });
});
