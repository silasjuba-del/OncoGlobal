// Prova ADV-011 copiada de RED@5e1093d: permutações de eventos sintéticos.
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
  it("ADV-011 · bytes, chaves e IDs são canônicos sem escolher entre candidatos discordantes", () => {
    const a = fato("a", "marcador", "A");
    const b = fato("b", "marcador", "B");
    const c = fato("c", "sintoma", "S");
    const direto = projetar([c, b, a]);
    const inverso = projetar([a, b, c]);
    expect(JSON.stringify(direto)).toBe(JSON.stringify(inverso));
    expect(direto.eventIds).toEqual(["a", "b", "c"]);
    expect(Object.keys(direto.campos)).toEqual(["marcador", "sintoma"]);
    expect(direto.campos.marcador).toMatchObject({
      estado: "VERMELHO", valor: null, eventIds: ["a", "b"],
      candidatos: [{ eventId: "a", valor: "A" }, { eventId: "b", valor: "B" }],
    });
  });
  it("ADV-011 · supersedes mantém precedência explícita e proposta CURRENT não promove conflito", () => {
    const a = fato("a", "marcador", "A");
    const b = { ...fato("b", "marcador", "B"), supersedesEventId: "a" };
    const corrected = projetar([b, a]);
    expect(corrected).toEqual(projetar([a, b]));
    expect(corrected.campos.marcador).toMatchObject({ estado: "VERDE", valor: "B", eventIds: ["b"] });
    const c = fato("c", "marcador", "C");
    const current = projetarSnapshot([c, a], base.patientId, base.tumorLotId,
      base.encounterId, "v1", [{ campo: "marcador", valor: "sugestão sintética", sourceId: "doc" }]);
    expect(current.kind).toBe("CURRENT");
    expect(current.campos.marcador).toMatchObject({ estado: "VERMELHO", valor: null,
      candidatos: [{ eventId: "a", valor: "A" }, { eventId: "c", valor: "C" }] });
    expect(JSON.stringify(current)).toBe(JSON.stringify(projetarSnapshot(
      [a, c], base.patientId, base.tumorLotId, base.encounterId, "v1",
      [{ campo: "marcador", valor: "sugestão sintética", sourceId: "doc" }],
    )));
  });
});
