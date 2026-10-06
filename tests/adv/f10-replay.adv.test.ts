import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";

const base: ClinicalEvent = {
  eventId: "event-a", operationId: "op-a", eventIndex: 0,
  patientId: "Paciente Teste 01", tumorLotId: "tumor-teste", encounterId: "consulta-teste",
  tipo: "FATO", payload: { reviewDecisionId: "revisao-teste", data: { campo: "marcador", valor: "A" } },
  fontes: [], revisao: "CONFIRMADO", criadoEm: "2026-10-05T12:00:00Z",
  criadoPor: { tipo: "SESSAO", id: "medico-teste" }, supersedesEventId: null,
};
const fato = (id: string, campo: string, valor: unknown): ClinicalEvent => ({
  ...base, eventId: id, operationId: `op-${id}`,
  payload: { reviewDecisionId: `rd-${id}`, data: { campo, valor } },
});
const projetar = (eventos: ClinicalEvent[]) =>
  projetarSnapshot(eventos, base.patientId, base.tumorLotId, base.encounterId, "v1");

describe("F10 · reconstrução determinística, entradas equivalentes em ordem diferente (W4-06)", () => {
  it("ADV-011 · dois fatos iguais têm hash idêntico independente da ordem de replay", () => {
    const a = fato("a", "marcador", "A"), b = fato("b", "marcador", "A");
    expect(projetar([a, b]).contentHash).toBe(projetar([b, a]).contentHash);
  });
  it("ADV-011 · candidatos de conflito preservam ambos com bytes determinísticos", () => {
    const a = fato("a", "marcador", "A"), b = fato("b", "marcador", "B");
    expect(projetar([a, b]).campos.marcador?.estado).toBe("VERMELHO");
    expect(projetar([a, b]).contentHash).toBe(projetar([b, a]).contentHash);
  });
  it("ADV-011 · campos independentes não alteram conteúdo/hash ao trocar ordem", () => {
    const a = fato("a", "marcador", "A"), b = fato("b", "sintoma", "S");
    expect(projetar([a, b]).contentHash).toBe(projetar([b, a]).contentHash);
  });
});
