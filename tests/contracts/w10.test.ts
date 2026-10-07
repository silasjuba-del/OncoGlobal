import { describe, expect, it } from "vitest";
import {
  ClinicalFact, PatientCandidate, ReviewAction, PrescriptionItem, ProtocolTemplate,
  VereditoAntiglosa, TriagemExtraW10, QuickLine,
} from "../../src/contracts/index.js";

const fato = {
  id: "f1", segmentId: "s1", patientCandidateId: null, domain: "lab", value: 140,
  sourceType: "medical_note", evidence: "EXPLICIT", sourceId: "doc1",
  rawEvidence: "creatinina 1,4", confidence: 0.95, requiresConfirmation: false,
};
const item = {
  drug: "docetaxel", classe: "QT", sequence: 3, standardDose: 75, doseBasis: "MG_M2",
  calculatedDose: 120, prescribedDose: 120, unit: "mg", adjustmentPercent: null, adjustmentReason: null,
  route: "EV", diluent: "SF 250 mL", finalVolumeMl: 250, infusionTime: "60 min", days: ["d1"],
  observacao: null, source: "PROTOCOL", overrideMotivo: null,
};

describe("contratos W10", () => {
  it("fato inferido sem regra é recusado", () => {
    expect(ClinicalFact.safeParse({ ...fato, evidence: "INFERRED" }).success).toBe(false);
    expect(ClinicalFact.safeParse({ ...fato, evidence: "INFERRED", regra: "R-NEURO-01" }).success).toBe(true);
  });
  it("número falado do Plaud exige confirmação", () => {
    expect(ClinicalFact.safeParse({ ...fato, sourceType: "plaud" }).success).toBe(false);
    expect(ClinicalFact.safeParse({ ...fato, sourceType: "plaud", requiresConfirmation: true }).success).toBe(true);
  });
  it("candidato a paciente nunca dispensa revisão (D-W9-34a)", () => {
    const c = { segmentId: "s1", patientId: "p1", score: 0.99, reasons: {}, requiresReview: false };
    expect(PatientCandidate.safeParse(c).success).toBe(false);
  });
  it("descartar exceção exige motivo; ligar exige paciente", () => {
    const base = { exceptionId: "e1", medicoId: "m1", em: "2030-01-01T10:00:00-03:00" };
    expect(ReviewAction.safeParse({ ...base, acao: "DESCARTAR" }).success).toBe(false);
    expect(ReviewAction.safeParse({ ...base, acao: "LIGAR_PACIENTE" }).success).toBe(false);
    expect(ReviewAction.safeParse({ ...base, acao: "LIGAR_PACIENTE", patientId: "p1" }).success).toBe(true);
  });
  it("ajuste de dose só −20/−30/−40 e com motivo (D-W9-26)", () => {
    expect(PrescriptionItem.safeParse({ ...item, adjustmentPercent: -25, adjustmentReason: "x" }).success).toBe(false);
    expect(PrescriptionItem.safeParse({ ...item, adjustmentPercent: -20 }).success).toBe(false);
    expect(PrescriptionItem.safeParse({ ...item, adjustmentPercent: -20, adjustmentReason: "neutropenia" }).success).toBe(true);
  });
  it("antineoplásico manual exige motivo", () => {
    expect(PrescriptionItem.safeParse({ ...item, source: "MANUAL" }).success).toBe(false);
  });
  it("ficha precisa de identidade completa e ao menos um item", () => {
    const f = { templateId: "t1", tumor: "mama", nome: "TCHP", cenario: "neoadjuvante", versao: "1", hash: "h",
      codigoInstitucional: null, intervaloDias: 21, ciclos: 6, itens: [item], limiaresBula: null,
      fonte: "SBOC 2026", status: "RASCUNHO" };
    expect(ProtocolTemplate.safeParse(f).success).toBe(true);
    expect(ProtocolTemplate.safeParse({ ...f, itens: [] }).success).toBe(false);
  });
  it("antiglosa: achado bloqueante impede exportação", () => {
    const v = { apacId: "a1", competencia: "2030-01", exportavel: true,
      achados: [{ regraId: "SIGTAP-01", caixaNumero: 12, severidade: "BLOQUEIA_EXPORTACAO", motivo: "código inexistente", fonte: "SIGTAP 2030-01" }] };
    expect(VereditoAntiglosa.safeParse(v).success).toBe(false);
    expect(VereditoAntiglosa.safeParse({ ...v, exportavel: false }).success).toBe(true);
  });
  it("sinais extras ausentes são null, não 0", () => {
    expect(TriagemExtraW10.safeParse({ pad: null, crCentesimos: null }).success).toBe(true);
  });
  it("receita de uma linha preserva a expressão", () => {
    const q = { expression: "ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA", pendencias: [],
      parsed: { drug: "ondansetrona", doseValue: 8, doseUnit: "mg", route: "VO", frequency: "8/8h", prn: true,
        prnIndication: "náusea", maxDaily: null, duration: null } };
    expect(QuickLine.safeParse(q).success).toBe(true);
  });
});
