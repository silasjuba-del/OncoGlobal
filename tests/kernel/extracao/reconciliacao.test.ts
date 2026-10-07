import { describe, expect, it } from "vitest";
import type { ClinicalFact, FactDomain, FactSourceType } from "../../../src/kernel/extracao/tipos.js";
import {
  chaveDoFato, detectarConflitos, farmacosMencionados, HIERARQUIA_TEXTO, reconciliarCampo,
  reconciliarCampos, reconciliarTratamento,
} from "../../../src/kernel/extracao/reconciliacao.js";

let sequencia = 0;
function fato(over: Partial<ClinicalFact> & { domain: FactDomain; sourceType: FactSourceType }): ClinicalFact {
  sequencia += 1;
  return {
    id: `fato-${sequencia}`, segmentId: "seg-1", patientCandidateId: null, value: null,
    evidence: "EXPLICIT", sourceId: `fonte-${over.sourceType}`, rawEvidence: "linha sintética",
    confidence: 1, requiresConfirmation: false, ...over,
  };
}

describe("FUGU-07 · hierarquia por domínio", () => {
  it("a hierarquia mais forte resolve, mas o conflito com a fonte fraca continua visível", () => {
    const ap = fato({ domain: "histology", sourceType: "pathology", value: "adenocarcinoma" });
    const plaud = fato({ domain: "histology", sourceType: "plaud", value: "carcinoma epidermoide" });
    const campo = reconciliarCampo("histology", [plaud, ap]);
    expect(campo.resolvedFactId).toBe(ap.id);
    expect(campo.conflict).toBe(true);
    expect(campo.hierarquia).toBe(HIERARQUIA_TEXTO.histology);
    expect(campo.candidates.map((c) => c.id)).toEqual([ap.id, plaud.id]);
  });

  it("divergência no mesmo nível não é decidida por id: fica sem resolução", () => {
    const a = fato({ domain: "histology", sourceType: "pathology", value: "adenocarcinoma" });
    const b = fato({ domain: "histology", sourceType: "pathology", value: "carcinoma de pequenas células" });
    const campo = reconciliarCampo("histology", [a, b]);
    expect(campo.resolvedFactId).toBeNull();
    expect(campo.conflict).toBe(true);
  });

  it("fonte única é resolvida sem conflito; ausência não elege valor", () => {
    const unico = fato({ domain: "lab", sourceType: "medical_note", value: { marker: "Hb" } });
    expect(reconciliarCampo("lab", [unico])).toMatchObject({ resolvedFactId: unico.id, conflict: false });
    expect(reconciliarCampo("lab", [])).toMatchObject({ resolvedFactId: null, conflict: false, candidates: [] });
  });

  it("agrupa por campo: marcadores diferentes não disputam o mesmo valor", () => {
    const her2 = fato({ domain: "biomarker", sourceType: "pathology", value: { marker: "HER2" } });
    const re = fato({ domain: "biomarker", sourceType: "pathology", value: { marker: "RE" } });
    expect(chaveDoFato(her2)).toBe("biomarker:HER2");
    expect(chaveDoFato(re)).toBe("biomarker:RE");
    const campos = reconciliarCampos([her2, re]);
    expect(Object.keys(campos)).toEqual(["biomarker:HER2", "biomarker:RE"]);
  });
});

describe("FUGU-07 · tratamento separado em estados", () => {
  it("retirada verbalizada × prescrição com o fármaco vira conflito planejado ≠ ordenado", () => {
    const prescricao = fato({
      domain: "drug", sourceType: "prescription", value: { raw: "carboplatina", normalizado: "CARBOPLATINA" },
    });
    const plano = fato({ domain: "plan", sourceType: "medical_note", value: "Plano: retirar carboplatina do próximo ciclo." });
    const t = reconciliarTratamento([prescricao, plano]);
    expect(t.prescrito).toEqual(["CARBOPLATINA"]);
    expect(t.suspensoAdiado).toEqual(["CARBOPLATINA"]);
    expect(t.conflitoPlanejadoOrdenado).toBe(true);
    expect(farmacosMencionados(plano.value as string)).toEqual(["CARBOPLATINA"]);
  });
});

describe("FUGU-07 · conflitos clínicos detectados", () => {
  const conflitos = (fatos: readonly ClinicalFact[]) => detectarConflitos(fatos).map((c) => c.kind);

  it("M0 × metástase documentada é CONFLICT (nunca escolha silenciosa)", () => {
    const estagio = fato({ domain: "stage", sourceType: "pathology", value: { literal: "cT2N0M0" } });
    const metastase = fato({ domain: "metastasis", sourceType: "imaging_report", value: { sitio: "osso" } });
    expect(conflitos([estagio, metastase])).toContain("CONFLICT");
    const semM0 = fato({ id: "sem-m0", domain: "stage", sourceType: "pathology", value: { literal: "cT4N2M1" } });
    expect(conflitos([semM0, metastase])).not.toContain("CONFLICT");
  });

  it("evento anterior ao diagnóstico é TEMPORAL_CONFLICT", () => {
    const diagnostico = fato({
      domain: "diagnosis", sourceType: "medical_note", date: "11/11/2025",
      value: { sitioCanonico: "mama" },
    });
    const pet = fato({ domain: "imaging", sourceType: "imaging_report", date: "02/02/2025", value: { siteRaw: "L5" } });
    expect(conflitos([diagnostico, pet])).toContain("TEMPORAL_CONFLICT");
    const depois = fato({ id: "depois", domain: "imaging", sourceType: "imaging_report", date: "01/12/2025", value: { siteRaw: "L5" } });
    expect(conflitos([diagnostico, depois])).not.toContain("TEMPORAL_CONFLICT");
  });

  it("ciclos distintos na mesma data são dose/data incoerente", () => {
    const c1 = fato({ domain: "cycle", sourceType: "prescription", date: "01/03/2029", value: { numero: 3 } });
    const c2 = fato({ domain: "cycle", sourceType: "administration", date: "01/03/2029", value: { numero: 4 } });
    expect(conflitos([c1, c2])).toContain("CONFLICT");
    const c3 = fato({ id: "c3", domain: "cycle", sourceType: "administration", date: "02/03/2029", value: { numero: 4 } });
    expect(conflitos([c1, c3])).not.toContain("CONFLICT");
  });

  it("lateralidade divergente entre fontes aciona o gate G-07 e vira CONFLICT", () => {
    const a = fato({
      domain: "imaging", sourceType: "imaging_report", sourceId: "fonte-A",
      value: { sitioCanonico: "mama", lateralidade: "DIREITO" },
    });
    const b = fato({
      domain: "imaging", sourceType: "pathology", sourceId: "fonte-B",
      value: { sitioCanonico: "mama", lateralidade: "ESQUERDO" },
    });
    const encontrados = detectarConflitos([a, b]);
    expect(encontrados.some((c) => c.kind === "CONFLICT" && /G-07|lateralidade/.test(c.reason))).toBe(true);
  });

  it("sítio anatômico divergente entre fontes é CONFLICT", () => {
    const a = fato({ domain: "imaging", sourceType: "imaging_report", sourceId: "fonte-A", value: { sitioCanonico: "mama" } });
    const b = fato({ domain: "imaging", sourceType: "medical_note", sourceId: "fonte-B", value: { sitioCanonico: "pulmao" } });
    expect(conflitos([a, b])).toContain("CONFLICT");
  });

  it("TNM incompatível no mesmo tipo de avaliação é CONFLICT; tipos diferentes coexistem (A3)", () => {
    const clinico = fato({ domain: "stage", sourceType: "medical_note", value: { literal: "cT2N0M0", tipo: "CLINICO" } });
    const outroClinico = fato({ domain: "stage", sourceType: "imaging_report", value: { literal: "cT4N2M1", tipo: "CLINICO" } });
    expect(conflitos([clinico, outroClinico])).toContain("CONFLICT");
    const patologico = fato({ id: "pat", domain: "stage", sourceType: "pathology", value: { literal: "pT3N1M0", tipo: "PATOLOGICO" } });
    expect(conflitos([clinico, patologico])).not.toContain("CONFLICT");
  });

  it("conflito planejado ≠ ordenado entra na detecção geral", () => {
    const prescricao = fato({ domain: "drug", sourceType: "prescription", value: { normalizado: "CARBOPLATINA" } });
    const plano = fato({ domain: "plan", sourceType: "medical_note", value: "Plano: suspender carboplatina." });
    const encontrados = detectarConflitos([prescricao, plano]);
    expect(encontrados.some((c) => /planned_regimen/.test(c.reason))).toBe(true);
  });

  it("sem conflito real, nenhuma exceção é inventada", () => {
    const a = fato({ domain: "histology", sourceType: "pathology", value: "adenocarcinoma" });
    expect(detectarConflitos([a])).toEqual([]);
  });
});