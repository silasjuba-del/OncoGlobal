import { describe, expect, it } from "vitest";
import {
  executarPipelineExtracao, type ExtractionInput, type ExtractionSource,
} from "../../src/orchestration/pipeline-extracao.js";
import {
  conflitoPlanejadoOrdenado, reconciliarTratamento,
} from "../../src/kernel/extracao/reconciliacao.js";
import type { ClinicalFact, ReviewAction } from "../../src/kernel/extracao/tipos.js";

const em = "2030-01-03T10:00:00-03:00";
const contexto = { encounterId: "enc-sintetico", dataClinica: "03/01/2030" };

const entrada: ExtractionInput = {
  recordingId: "consulta-f03", sourceId: "fala-sintetica", sourceType: "plaud",
  rawTranscript: "ela vai fazer cisplatina, corrigi da outra vez a carboplatina.",
  contexto,
  additionalSources: [{
    recordingId: "receita-f03", sourceId: "prescricao-sintetica", sourceType: "prescription",
    rawTranscript: "carboplatina AUC 6 D1", contexto,
  }],
};

function ligacoes(
  estado: ReturnType<typeof executarPipelineExtracao>,
  pacientes: readonly string[] = ["paciente-sintetico", "paciente-sintetico"],
): ReviewAction[] {
  return estado.exceptions.filter((e) => e.kind === "UNLINKED_PATIENT").map((excecao, indice) => ({
    exceptionId: excecao.id, acao: "LIGAR_PACIENTE", medicoId: "medico-sintetico",
    em, patientId: pacientes[indice] ?? "",
  }));
}

function fato(id: string, domain: ClinicalFact["domain"], value: unknown, date?: string): ClinicalFact {
  return {
    id, segmentId: "segmento-puro", patientCandidateId: null,
    domain, value, sourceType: domain === "plan" ? "medical_note" : "prescription",
    evidence: "EXPLICIT", sourceId: id, rawEvidence: `origem literal ${id}`,
    ...(date === undefined ? {} : { date }),
    confidence: 1, requiresConfirmation: false,
  };
}

describe("F03 · plano verbalizado ≠ prescrição no dono da reconciliação", () => {
  it("confronta fármacos diferentes e conserva os dois candidatos com fonte", () => {
    const plano = fato("plan-1", "plan", "Plano: seguir cisplatina.");
    const receita = fato("rx-1", "drug", { raw: "carboplatina", normalizado: "CARBOPLATINA" });
    expect(reconciliarTratamento([plano, receita])).toMatchObject({
      proposto: ["CISPLATINA"], prescrito: ["CARBOPLATINA"],
      conflitoPlanejadoOrdenado: true,
    });
    expect(conflitoPlanejadoOrdenado([plano, receita])).toMatchObject({
      kind: "CONFLICT", factIds: [plano.id, receita.id],
      sourceIds: [plano.sourceId, receita.sourceId],
    });
  });

  it("retirada declarada ainda prescrita é CONFLICT, mas ausência de prescrição não o é", () => {
    const plano = fato("retirar", "plan", "Plano: suspender carboplatina no próximo ciclo.");
    const receita = fato("rx", "drug", { normalizado: "CARBOPLATINA" });
    expect(conflitoPlanejadoOrdenado([plano, receita])?.factIds).toEqual(["retirar", "rx"]);
    expect(conflitoPlanejadoOrdenado([plano])).toBeNull();
  });

  it("datas clínicas diferentes não viram contradição de tratamento", () => {
    const plano = fato("plan-1", "plan", "Plano: seguir cisplatina.", "03/01/2030");
    const receita = fato("rx-1", "drug", { normalizado: "CARBOPLATINA" }, "04/01/2030");
    expect(conflitoPlanejadoOrdenado([plano, receita])).toBeNull();
  });

  it("regime coincidente e menção apenas histórica não geram CONFLICT", () => {
    const receita = fato("rx-1", "drug", { normalizado: "CARBOPLATINA" });
    expect(conflitoPlanejadoOrdenado([
      fato("plano-atual", "plan", "Plano: seguir carboplatina."), receita,
    ])).toBeNull();
    expect(conflitoPlanejadoOrdenado([
      fato("historico", "plan", "Plano: anteriormente cisplatina."), receita,
    ])).toBeNull();
  });

  it("incerteza de plano ou fármaco não vira status confirmado por ligação de paciente", () => {
    const plano = fato("plano", "plan", "Plano: seguir cisplatina.");
    const receita = fato("prescricao", "drug", { normalizado: "CARBOPLATINA" });
    const incertoPlano: ClinicalFact = { ...plano, evidence: "UNCERTAIN", requiresConfirmation: true };
    const incertaReceita: ClinicalFact = { ...receita, evidence: "UNCERTAIN", requiresConfirmation: true };
    expect(reconciliarTratamento([incertoPlano, receita]).proposto).toEqual([]);
    expect(conflitoPlanejadoOrdenado([incertoPlano, receita])?.kind).toBe("CONFLICT");
    expect(reconciliarTratamento([plano, incertaReceita]).prescrito).toEqual([]);
    expect(conflitoPlanejadoOrdenado([plano, incertaReceita])).toBeNull();
  });
});

describe("F03 · consumidor real do pipeline não presume identidade nem autoridade", () => {
  it("antes da revisão persistida mantém o plano literal incerto e NÃO junta fontes", () => {
    const r = executarPipelineExtracao({
      ...entrada, openedPatientId: "paciente-sintetico",
      registeredPatients: [{ patientId: "paciente-sintetico" }],
    });
    const plano = r.facts.find((f) => f.domain === "plan");
    expect(plano).toMatchObject({
      value: "ela vai fazer cisplatina", evidence: "UNCERTAIN", requiresConfirmation: true,
      sourceId: "fala-sintetica",
      rawEvidence: "ela vai fazer cisplatina, corrigi da outra vez a carboplatina.",
    });
    expect(r.facts.some((f) => f.domain === "drug" && f.sourceId === "prescricao-sintetica")).toBe(true);
    expect(r.exceptions.some((e) => e.reason.includes("planned_regimen"))).toBe(false);
    expect(r.timelines).toEqual([]);
    expect(r.segments.every((s) => s.patientId === null)).toBe(true);
  });

  it("com ambas as decisões já persistidas e mesmo encontro/data: CONFLICT com candidatos das duas fontes", () => {
    const semVinculo = executarPipelineExtracao(entrada);
    // A função só recebe ações vindas do ledger; este fixture representa ações já
    // confirmadas pelo médico. O pipeline não escreve nem inventa eventos/autor.
    const r = executarPipelineExtracao({ ...entrada, confirmacoes: ligacoes(semVinculo) });
    const plano = r.facts.find((f) => f.domain === "plan")!;
    const prescricao = r.facts.find((f) => f.domain === "drug")!;
    const conflito = r.exceptions.find((e) => e.reason.includes("planned_regimen"));
    expect(conflito).toMatchObject({
      kind: "CONFLICT", factIds: [plano.id, prescricao.id],
      sourceIds: ["fala-sintetica", "prescricao-sintetica"],
    });
    expect(r.confirmationRequired).toContainEqual(conflito);
    expect(Object.values(r.fields).flatMap((campo) => campo.candidates.map((f) => f.id)))
      .toEqual(expect.arrayContaining([plano.id, prescricao.id]));
    expect(r.fields[`${plano.segmentId}::plan`]?.resolvedFactId).toBeNull();
    expect(r.timelines.flatMap((t) => t.treatments)
      .some((t) => t.status === "PROPOSTO" && t.regimen === "CISPLATINA")).toBe(false);
    expect(r.timelines.flatMap((t) => t.treatments))
      .toContainEqual(expect.objectContaining({ status: "PRESCRITO", regimen: "CARBOPLATINA" }));
    expect(r.segments.every((s) => s.patientId === null)).toBe(true);
  });

  it("um vínculo só, pacientes distintos, outro encontro ou outra data não autorizam confronto", () => {
    const preliminar = executarPipelineExtracao(entrada);
    const [fala, receita] = ligacoes(preliminar);
    expect(fala).toBeDefined();
    expect(receita).toBeDefined();
    const variantes: ExtractionInput[] = [
      { ...entrada, confirmacoes: [fala!] },
      { ...entrada, confirmacoes: ligacoes(preliminar, ["paciente-a", "paciente-b"]) },
      { ...entrada, confirmacoes: [fala!, receita!], additionalSources: [{
        ...entrada.additionalSources![0]!, contexto: { ...contexto, encounterId: "outro-encontro" },
      }] },
      { ...entrada, confirmacoes: [fala!, receita!], additionalSources: [{
        ...entrada.additionalSources![0]!, contexto: { ...contexto, dataClinica: "04/01/2030" },
      }] },
      { ...entrada, confirmacoes: [fala!, receita!], additionalSources: [{
        ...entrada.additionalSources![0]!, contexto: { ...contexto, dataClinica: "31/02/2030" },
      }] },
    ];
    for (const variante of variantes) {
      const r = executarPipelineExtracao(variante);
      expect(r.exceptions.some((e) => e.reason.includes("planned_regimen"))).toBe(false);
      expect(r.facts).toHaveLength(2);
    }
  });

  it("ações de vínculo contraditórias no mesmo segmento não ligam paciente nem geram confronto", () => {
    const preliminar = executarPipelineExtracao(entrada);
    const [fala, receita] = ligacoes(preliminar);
    const r = executarPipelineExtracao({ ...entrada,
      confirmacoes: [fala!, { ...fala!, patientId: "paciente-diferente" }, receita!] });
    expect(r.exceptions.some((e) => e.reason.includes("planned_regimen"))).toBe(false);
    expect(r.timelines).toHaveLength(1); // só a prescrição tem vínculo não ambíguo
    expect(r.timelines[0]?.patientId).toBe("paciente-sintetico");
  });

  it("reimpressão da prescrição não duplica o CONFLICT e conserva as três fontes/fatos", () => {
    const prescricao = entrada.additionalSources![0]!;
    const repetida: ExtractionSource = {
      ...prescricao, recordingId: "reimpressao-f03",
    };
    const comRepeticao: ExtractionInput = {
      ...entrada, additionalSources: [prescricao, repetida],
    };
    const preliminar = executarPipelineExtracao(comRepeticao);
    const r = executarPipelineExtracao({ ...comRepeticao,
      confirmacoes: ligacoes(preliminar, ["paciente-sintetico", "paciente-sintetico", "paciente-sintetico"]) });
    expect(r.facts).toHaveLength(3);
    expect(r.deduplicacao.repeticoes).toHaveLength(1);
    expect(r.deduplicacao.repeticoes[0]?.fatoRepetidoIds).toHaveLength(1);
    const conflitos = r.exceptions.filter((e) => e.reason.includes("planned_regimen"));
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0]?.factIds).toHaveLength(2);
    expect(r.facts.map((f) => f.sourceId)).toEqual([
      "fala-sintetica", "prescricao-sintetica", "prescricao-sintetica",
    ]);
  });

  it("mesmo sourceId reutilizado em outra data clínica não vira reingestão", () => {
    const prescricao = entrada.additionalSources![0]!;
    const novaData: ExtractionSource = {
      ...prescricao, recordingId: "outra-data-f03",
      contexto: { ...contexto, dataClinica: "04/01/2030" },
    };
    const r = executarPipelineExtracao({
      ...entrada, additionalSources: [prescricao, novaData],
    });
    expect(r.deduplicacao.repeticoes).toEqual([]);
    expect(r.facts).toHaveLength(3);
  });
});
