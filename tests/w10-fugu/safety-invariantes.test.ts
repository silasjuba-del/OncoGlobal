import { describe, expect, it } from "vitest";
import type { ClinicalFact, FactDomain, FactSourceType } from "../../src/kernel/extracao/tipos.js";
import {
  historicalMetastaticDisease, validarSegurancaAntiAlucinacao,
} from "../../src/kernel/extracao/safety.js";

let sequencia = 0;
function fato(over: Partial<ClinicalFact> & { domain: FactDomain; sourceType?: FactSourceType }): ClinicalFact {
  sequencia += 1;
  return {
    id: `adv-${sequencia}`, segmentId: "seg-1", patientCandidateId: null, value: null,
    sourceType: "medical_note", evidence: "EXPLICIT", sourceId: "fonte-1",
    rawEvidence: "linha sintética", confidence: 1, requiresConfirmation: false, ...over,
  };
}

const contexto = { conflitoTemporalDetectado: false } as const;

describe("FUGU-08 · invariantes anti-alucinação (adversarial)", () => {
  it("1 · ausência nunca vira 'negativo'", () => {
    const tentativa = fato({ domain: "biomarker", value: { marker: "HER2", value: "negativo" } });
    const r = validarSegurancaAntiAlucinacao([tentativa], contexto);
    expect(r.facts).toEqual([]);
    expect(r.violacoes.map((v) => v.invariante)).toContain(1);
    expect(r.rejeitados).toHaveLength(1);
  });

  it("2 · inferência sem regra nomeada não entra como fato", () => {
    const semRegra = fato({ domain: "toxicity", evidence: "DERIVED", value: { suspeita: "neuropatia" } });
    const r = validarSegurancaAntiAlucinacao([semRegra], contexto);
    expect(r.violacoes.map((v) => v.invariante)).toContain(2);
    const comRegra = fato({
      id: "com-regra", domain: "toxicity", evidence: "DERIVED", value: { suspeita: "neuropatia" },
      regra: "REGRA-SINTOMA-TOXICIDADE",
    });
    expect(validarSegurancaAntiAlucinacao([comRegra], contexto).facts).toHaveLength(1);
  });

  it("2b · proposta incerta não entra como confirmada sem regra nem clique", () => {
    const promovida = fato({ domain: "imaging", evidence: "UNCERTAIN", value: { siteRaw: "L5" } });
    const r = validarSegurancaAntiAlucinacao([promovida], contexto);
    expect(r.violacoes.some((v) => v.invariante === 2 && /confirmado/.test(v.motivo))).toBe(true);
  });

  it("3 · fato sem frase original ou sem origem é rejeitado", () => {
    const semFrase = fato({ domain: "symptom", value: "dor", rawEvidence: "  " });
    const semFonte = fato({ id: "sem-fonte", domain: "symptom", value: "dor", sourceId: "" });
    const r = validarSegurancaAntiAlucinacao([semFrase, semFonte], contexto);
    expect(r.violacoes.filter((v) => v.invariante === 3)).toHaveLength(2);
  });

  it("4 · número falado no Plaud exige confirmação e confiança baixa", () => {
    const semConfirmacao = fato({
      domain: "lab", sourceType: "plaud", value: { marker: "Creatinina", value: null },
      rawEvidence: "Creatinina quatorze.", confidence: 0.6, requiresConfirmation: false,
    });
    const confiancaAlta = fato({
      id: "confianca-alta", domain: "lab", sourceType: "plaud", value: { marker: "Hb" },
      rawEvidence: "Hemoglobina 11", confidence: 0.95, requiresConfirmation: true,
    });
    const correto = fato({
      id: "correto", domain: "lab", sourceType: "plaud", value: { marker: "Creatinina", value: null },
      rawEvidence: "Creatinina quatorze.", confidence: 0.6, requiresConfirmation: true,
    });
    const r = validarSegurancaAntiAlucinacao([semConfirmacao, confiancaAlta, correto], contexto);
    expect(r.facts.map((f) => f.id)).toEqual(["correto"]);
    expect(r.violacoes.filter((v) => v.invariante === 4)).toHaveLength(2);
  });

  it("5 · fármaco incerto exige raw + normalizado + confiança + confirmação", () => {
    const incompleto = fato({
      domain: "drug", evidence: "INFERRED", regra: "FARMACO-FONETICO",
      value: { raw: "carboplatna", incerto: true }, confidence: 0.72, requiresConfirmation: true,
    });
    expect(validarSegurancaAntiAlucinacao([incompleto], contexto).violacoes.map((v) => v.invariante)).toContain(5);
    const completo = fato({
      id: "completo", domain: "drug", evidence: "INFERRED", regra: "FARMACO-FONETICO",
      value: { raw: "carboplatna", normalizado: "CARBOPLATINA", incerto: true },
      confidence: 0.72, requiresConfirmation: true,
    });
    expect(validarSegurancaAntiAlucinacao([completo], contexto).facts).toHaveLength(1);
  });

  it("6 · evento antes do diagnóstico sem conflito marcado é rejeitado", () => {
    const diagnostico = fato({ domain: "diagnosis", date: "11/11/2025", value: { sitioCanonico: "mama" } });
    const pet = fato({ id: "pet", domain: "imaging", date: "02/02/2025", value: { siteRaw: "L5" } });
    const semMarcacao = validarSegurancaAntiAlucinacao([diagnostico, pet], contexto);
    expect(semMarcacao.violacoes.map((v) => v.invariante)).toContain(6);
    const comMarcacao = validarSegurancaAntiAlucinacao([diagnostico, pet], { conflitoTemporalDetectado: true });
    expect(comMarcacao.violacoes.map((v) => v.invariante)).not.toContain(6);
    expect(comMarcacao.facts).toHaveLength(2);
  });

  it("7 · histórico metastático já registrado nunca volta a false", () => {
    const metastase = fato({ domain: "metastasis", value: { sitio: "osso" } });
    const r = validarSegurancaAntiAlucinacao([metastase], { conflitoTemporalDetectado: false, historicalMetastaticDiseaseAnterior: false });
    expect(r.violacoes.map((v) => v.invariante)).toContain(7);
    expect(validarSegurancaAntiAlucinacao([metastase], { conflitoTemporalDetectado: false }).facts).toHaveLength(1);
  });

  it("historicalMetastaticDisease é monotônico e reconhece M1 no literal TNM", () => {
    const m1 = fato({ domain: "stage", value: { literal: "cT4N2M1" } });
    const m0 = fato({ id: "m0", domain: "stage", value: { literal: "cT2N0M0" } });
    expect(historicalMetastaticDisease([m1])).toBe(true);
    expect(historicalMetastaticDisease([m0])).toBe(false);
  });
});