import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
const evento = (id: string, encounterId: string, criadoEm: string, valor: string,
  supersedesEventId: string | null = null): ClinicalEvent => ({
  eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "Paciente Teste 01",
  tumorLotId: "tumor-teste", encounterId, criadoEm, tipo: "FATO", revisao: "CONFIRMADO",
  criadoPor: { tipo: "SESSAO", id: "medico-teste" }, fontes: [], supersedesEventId,
  payload: { reviewDecisionId: `rd-${id}`, data: { campo: "nota", valor,
    rulesetRefs: [{ id: "ruleset-teste", version: id, hash: `hash-${id}` }] } },
});
const p = (events: ClinicalEvent[], encounterId: string) =>
  projetarSnapshot(events, "Paciente Teste 01", "tumor-teste", encounterId, "v1");
const antigo = evento("v1", "consulta-1", "2026-10-05T12:00:00Z", "antes sintético");
const futuro = evento("v2", "consulta-2", "2026-10-06T12:00:00Z", "depois sintético", "v1");
describe("F10/F11 · histórico e instante em representações diferentes", () => {
  it("ADV-018 · supersedes futuro não apaga snapshot histórico nem ruleset v1", () => {
    expect(p([antigo, futuro], "consulta-1")).toEqual(p([antigo], "consulta-1"));
  });
  it("ADV-018 · consulta nova usa revisão v2 confirmada", () => {
    expect(p([antigo, futuro], "consulta-2").campos.nota?.valor).toBe("depois sintético");
  });
  it("ADV-018 · futuro independente não entra no snapshot anterior", () => {
    const independente = { ...futuro, supersedesEventId: null };
    expect(p([antigo, independente], "consulta-1")).toEqual(p([antigo], "consulta-1"));
  });
});
