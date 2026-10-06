import { describe, expect, it } from "vitest";
import { montarApacBatch, type ItemApacLote } from "../../src/modules/apac/lote.js";

const item = (apacId: string, patientId: string, competencia = "2026-10"): ItemApacLote & { patientId: string } => ({
  apacId, patientId, competencia, cid: "CODIGO-TESTE", esquema: "esquema-sintetico",
  estado: "EMITIDA", artefato: "PRONTO", modalidade: "APAC", motivoBloqueio: null,
});
const criterio = { competencia: null, cid: null, esquema: null, estado: null };

describe("F8 · lote administrativo não cruza pacientes/competências", () => {
  it("ADV-007 · mistura de dois patientId não elege APAC do segundo paciente", () => {
    const lote = montarApacBatch("lote-sintetico", criterio,
      [item("apac-a", "Paciente Teste 01"), item("apac-b", "Paciente Teste 02")], "2026-10-05");
    expect(lote.itens).not.toContain("apac-b");
  });
  it("ADV-007 · critério aberto também não deve unir APACs de três pacientes", () => {
    const lote = montarApacBatch("lote-sintetico", criterio,
      [item("apac-a", "Paciente Teste 01"), item("apac-b", "Paciente Teste 02"),
        item("apac-c", "Paciente Teste 03")], "2026-10-05");
    expect(new Set(lote.itens.map((id) => ({ "apac-a": "01", "apac-b": "02", "apac-c": "03" })[id])).size).toBe(1);
  });
  it("ADV-008 · lote com competência aberta não reúne períodos distintos", () => {
    const lote = montarApacBatch("lote-sintetico", criterio,
      [item("apac-a", "Paciente Teste 01"), item("apac-b", "Paciente Teste 01", "2026-11")], "2026-10-05");
    expect(lote.itens).not.toContain("apac-b");
  });
});
