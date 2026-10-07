import { expect, it } from "vitest";
import { projetarEstatistica } from "../../src/estatistica/index.js";
import { evento } from "./fixtures.js";
const periodoClinico = { inicio: "2026-10-07", fim: "2026-10-07" };
const admin = (inicio: string, fim: string | null = null) => ({ adminId: "admin-01", cicloId: "ciclo-01",
  prescricaoRef: { documentId: "doc-01", documentVersion: 1 }, item: 1, droga: "droga-sintetica",
  quantidadeEfetivaMg: 50, status: "COMPLETA", motivo: null, inicio, fim,
  fonte: { sourceId: "fonte-01", classe: "MANUAL", localizador: null, dataClinica: "2026-10-07",
    dataCaptura: "2026-10-07T12:00:00Z", versao: "1", contentHash: "hash" } });
it.each([
  ["2026-10-08T01:00:00Z", "2026-10-07T22:00:00-03:00", 1],
  ["2026-10-07T02:59:59Z", "2026-10-06T23:59:59-03:00", 0],
  ["2026-10-07T03:00:00Z", "2026-10-07T00:00:00-03:00", 1],
])("mesmo instante %s e %s dá o mesmo período", (utc, local, esperado) => {
  const project = (inicio: string) => projetarEstatistica([evento("admin", admin(inicio), { tipo: "TreatmentAdministration" })], { periodoClinico });
  expect(project(utc)).toEqual(project(local));
  expect(project(utc).denominadorPacientes).toBe(esperado);
});
it("offset equivalente não cria conflito fictício da mesma administração", () => {
  const result = projetarEstatistica([
    evento("a", admin("2026-10-08T01:00:00Z", "2026-10-08T02:00:00Z"), { tipo: "TreatmentAdministration" }),
    evento("b", admin("2026-10-07T22:00:00-03:00", "2026-10-07T23:00:00-03:00"), { tipo: "TreatmentAdministration" }),
  ], { periodoClinico });
  expect(result.administracoesConflito).toBe(0);
  expect(result.administracoesPorStatus.COMPLETA).toBe(1);
});
