// Decisão do Dr. Silas (01/11/2026): administração parcial, interrompida, omitida ou com reação
// infusional exige justificativa e volta ao médico no encontro seguinte. Dados sintéticos.
import { describe, expect, it } from "vitest";
import { TreatmentAdministration, exigeRetornoMedico } from "../../src/contracts/clinico.js";
import { exigeJustificativa } from "../../src/ui/consulta/AdministracaoCiclo.js";

const base = {
  adminId: "adm-sintetico-1", cicloId: "ciclo-sintetico", prescricaoRef: { documentId: "rx-sintetico", documentVersion: 1 },
  item: 6, droga: "Paclitaxel", quantidadeEfetivaMg: 364, status: "COMPLETA" as const, motivo: null,
  inicio: "2026-10-12T12:00:00.000Z", fim: "2026-10-12T13:00:00.000Z",
  fonte: { sourceId: "adm-fonte-sintetica", classe: "MANUAL" as const, localizador: null, dataClinica: "2026-10-12",
    dataCaptura: "2026-10-12T13:05:00.000Z", versao: "administracao-salao@1", contentHash: "a".repeat(64) },
};

describe("administração com retorno ao médico", () => {
  it("reação infusional sem justificativa é recusada, com justificativa é aceita", () => {
    expect(TreatmentAdministration.safeParse({ ...base, reacaoInfusional: true }).success).toBe(false);
    expect(TreatmentAdministration.safeParse({ ...base, reacaoInfusional: true, motivo: "   " }).success).toBe(false);
    expect(TreatmentAdministration.safeParse({ ...base, reacaoInfusional: true, motivo: "Reação aos 40 min" }).success).toBe(true);
  });
  it("parcial exige justificativa não vazia", () => {
    expect(TreatmentAdministration.safeParse({ ...base, status: "PARCIAL", quantidadeEfetivaMg: 200 }).success).toBe(false);
    expect(TreatmentAdministration.safeParse({ ...base, status: "PARCIAL", quantidadeEfetivaMg: 200, motivo: " " }).success).toBe(false);
  });
  it("registro legado sem o campo de reação continua válido", () => {
    expect(TreatmentAdministration.safeParse(base).success).toBe(true);
  });
  it("só volta ao médico o que não foi completo ou teve reação", () => {
    const parse = (x: object) => TreatmentAdministration.parse({ ...base, ...x });
    expect(exigeRetornoMedico(parse({}))).toBe(false);
    expect(exigeRetornoMedico(parse({ reacaoInfusional: false }))).toBe(false);
    expect(exigeRetornoMedico(parse({ reacaoInfusional: true, motivo: "Reação" }))).toBe(true);
    for (const status of ["PARCIAL", "INTERROMPIDA"] as const) expect(exigeRetornoMedico(parse({ status, motivo: "Motivo" }))).toBe(true);
    expect(exigeRetornoMedico(parse({ status: "OMITIDA", quantidadeEfetivaMg: 0, motivo: "Motivo", inicio: null, fim: null }))).toBe(true);
  });
  it("o formulário pede justificativa nas mesmas situações", () => {
    expect(exigeJustificativa({ status: "COMPLETA", reacaoInfusional: false })).toBe(false);
    expect(exigeJustificativa({ status: "COMPLETA", reacaoInfusional: true })).toBe(true);
    expect(exigeJustificativa({ status: "PARCIAL", reacaoInfusional: false })).toBe(true);
    expect(exigeJustificativa({ status: "", reacaoInfusional: false })).toBe(false);
  });
});
