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
describe("F10/F11 · mesmo instante em representações diferentes", () => {
  for (const [id, instante] of [["offset", "2026-10-05T09:00:00-03:00"],
    ["fracao", "2026-10-05T12:00:00.000Z"], ["positivo", "2026-10-05T15:00:00+03:00"]]) {
    it(`ADV-019 · cutoff inclui mesmo instante representado com ${id}`, () => {
      const equivalente = evento(`equiv-${id}`, "consulta-anterior", instante!, "antes sintético");
      const result = p([antigo, equivalente], "consulta-1");
      expect(result.eventIds).toContain(equivalente.eventId);
      expect(result.campos.nota?.estado).toBe("VERDE");
    });
  }
  it("ADV-019 · horizonte usa o maior instante da consulta, mesmo com offset lexicalmente maior", () => {
    const cedo = evento("cedo", "consulta-1", "2026-10-05T13:00:00+03:00", "antes sintético");
    const entre = evento("entre", "consulta-anterior", "2026-10-05T11:00:00Z", "antes sintético");
    const result = p([cedo, antigo, entre], "consulta-1");
    expect(result.eventIds).toEqual(["cedo", "entre", "v1"]);
    expect(result.campos.nota?.estado).toBe("VERDE");
  });
  it("ADV-019 · evento futuro com representação lexical menor não entra no histórico", () => {
    const depois = evento("depois", "consulta-2", "2026-10-05T10:00:00-03:00", "depois sintético");
    expect(p([antigo, depois], "consulta-1")).toEqual(p([antigo], "consulta-1"));
  });
});
