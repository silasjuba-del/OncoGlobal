import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { normalizarFatos } from "../../src/kernel/extracao/normalizacao.js";
import { detectarConflitos, reconciliarCampos } from "../../src/kernel/extracao/reconciliacao.js";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";

const gravacao = "gravacao-pacientes-teste-07-08";
const fonte = "fonte-sintetica-07-08";

function extrairDoisPacientes(texto07: string, texto08: string) {
  return executarPipelineExtracao({
    recordingId: gravacao,
    sourceId: fonte,
    sourceType: "medical_note",
    rawTranscript: [
      "Bom dia, chamo Paciente Teste 07.",
      texto07,
      "Boa tarde, chamo Paciente Teste 08.",
      texto08,
    ].join("\n"),
    registeredPatients: [
      { patientId: "paciente-teste-07", name: "Paciente Teste 07" },
      { patientId: "paciente-teste-08", name: "Paciente Teste 08" },
    ],
    identityHintsBySegment: {
      [`${gravacao}:0`]: { name: "Paciente Teste 07" },
      [`${gravacao}:1`]: { name: "Paciente Teste 08" },
    },
    openedPatientId: "paciente-teste-08",
  });
}

describe("FUGU-EIXO-01 · extração de dois pacientes sintéticos", () => {
  it("separa pacientes, preserva fonte/negação; cadastro e consulta aberta não vinculam fatos", () => {
    const linha07 = "Sem neoplasia de mama; Nega dor; Hb 11,2 g/dL";
    const linha08 = "Diagnóstico: carcinoma de mama; Dor; Hb 9,1 g/dL";
    const estado = extrairDoisPacientes(linha07, linha08);
    const [segmento07, segmento08] = estado.segments;

    expect(estado.segments.map((segmento) => segmento.candidateNames[0]))
      .toEqual(["Paciente Teste 07", "Paciente Teste 08"]);
    expect(estado.segments.map((segmento) => segmento.patientId)).toEqual([null, null]);
    expect(estado.patientCandidates).toHaveLength(4);
    expect(estado.patientCandidates.every((candidato) => candidato.requiresReview)).toBe(true);
    expect(estado.patientCandidates.filter((candidato) => candidato.segmentId === segmento07!.id)[0]?.patientId)
      .toBe("paciente-teste-07");
    expect(estado.patientCandidates.filter((candidato) => candidato.segmentId === segmento08!.id)[0]?.patientId)
      .toBe("paciente-teste-08");
    expect(estado.facts.every((fato) => fato.sourceId === fonte && fato.patientCandidateId === null))
      .toBe(true);
    expect(estado.timeline).toBeNull();
    expect(estado.timelines).toEqual([]);
    expect(estado.confirmationRequired.filter((item) => item.kind === "UNLINKED_PATIENT")
      .map((item) => item.segmentId)).toEqual([segmento07!.id, segmento08!.id]);

    const fatos07 = estado.facts.filter((fato) => fato.segmentId === segmento07!.id);
    const fatos08 = estado.facts.filter((fato) => fato.segmentId === segmento08!.id);
    expect(fatos07.map((fato) => fato.domain)).toEqual(["lab"]);
    expect(fatos07[0]).toMatchObject({ sourceId: fonte, rawEvidence: linha07 });
    expect(fatos08).toHaveLength(3);
    expect(fatos08.map((fato) => fato.domain))
      .toEqual(expect.arrayContaining(["diagnosis", "symptom", "lab"]));
    expect(fatos08.every((fato) => fato.rawEvidence === linha08)).toBe(true);
  });

  it("negação de dor na mesma oração não apaga náusea afirmada nem cria dor positiva", () => {
    const linha07 = "Nega dor, relata náusea.";
    const estado = extrairDoisPacientes(linha07, "Nega náusea; Dor.");
    const [segmento07, segmento08] = estado.segments;
    const sintomas07 = estado.facts.filter((fato) =>
      fato.segmentId === segmento07!.id && fato.domain === "symptom");
    const sintomas08 = estado.facts.filter((fato) =>
      fato.segmentId === segmento08!.id && fato.domain === "symptom");

    expect(sintomas07).toHaveLength(1);
    expect(String(sintomas07[0]?.value)).toMatch(/náusea/iu);
    expect(String(sintomas07[0]?.value)).not.toMatch(/\bdor\b/iu);
    expect(sintomas07[0]).toMatchObject({ sourceId: fonte, rawEvidence: linha07 });
    expect(sintomas08.map((fato) => fato.value)).toEqual(["Dor."]);
  });

  it("não reconcilia Hb divergente de dois pacientes sem vínculo como se fosse um campo só", () => {
    const estado = extrairDoisPacientes(
      "01/10/2026 Hb 11,2 g/dL",
      "01/10/2026 Hb 9,1 g/dL",
    );
    const labs = estado.facts.filter((fato) => fato.domain === "lab");
    const camposLab = Object.values(estado.fields).filter((campo) => campo.domain === "lab");

    expect(labs).toHaveLength(2);
    expect(new Set(labs.map((fato) => fato.segmentId)).size).toBe(2);
    expect(new Set(camposLab.flatMap((campo) => campo.candidates.map((fato) => fato.id))))
      .toEqual(new Set(labs.map((fato) => fato.id)));
    // Antes de LIGAR_PACIENTE, um campo nunca pode conter candidatos de ambos os segmentos.
    expect(camposLab.some((campo) =>
      new Set(campo.candidates.map((fato) => fato.segmentId)).size > 1)).toBe(false);
  });

  it("não inventa conflito TNM entre Paciente Teste 07 e Paciente Teste 08", () => {
    const estado = extrairDoisPacientes(
      "Estadiamento cT2N0M0 documentado.",
      "Estadiamento cT3N0M0 documentado.",
    );
    const estagios = estado.facts.filter((fato) => fato.domain === "stage");
    expect(estagios).toHaveLength(2);
    expect(new Set(estagios.map((fato) => fato.segmentId)).size).toBe(2);
    expect(estado.caixaRevisao.itens.filter((item) => item.kind === "CONFLICT"
      && estagios.every((fato) => item.factIds.includes(fato.id)))).toEqual([]);
    expect(Object.values(estado.fields).filter((campo) => campo.domain === "stage")
      .some((campo) => estagios.every((fato) =>
        campo.candidates.some((candidato) => candidato.id === fato.id)))).toBe(false);
  });

  it("preserva um conflito TNM verdadeiro entre duas fontes explicitamente no mesmo escopo", () => {
    // A seleção das duas fontes do Paciente Teste 07 é premissa da fixture, não um vínculo pelo resolver.
    const ap = segmentarTranscricao({
      recordingId: "registro-pt07-ap", sourceId: "fonte-pt07-ap", sourceType: "pathology", page: 2,
      turns: [
        { text: "Chamo Paciente Teste 07.", startMs: null, endMs: null },
        { text: "Estadiamento cT2N0M0.", startMs: null, endMs: null },
      ],
    })[0]!;
    const nota = segmentarTranscricao({
      recordingId: "registro-pt07-nota", sourceId: "fonte-pt07-nota", sourceType: "medical_note",
      turns: [
        { text: "Chamo Paciente Teste 07.", startMs: null, endMs: null },
        { text: "Estadiamento cT3N0M0.", startMs: null, endMs: null },
      ],
    })[0]!;
    const estagios = normalizarFatos([
      ...extratorDeterministico.extrair(ap),
      ...extratorDeterministico.extrair(nota),
    ]).filter((fato) => fato.domain === "stage");

    expect(estagios).toHaveLength(2);
    expect(estagios.map((fato) => fato.sourceId)).toEqual(["fonte-pt07-ap", "fonte-pt07-nota"]);
    expect(estagios.map((fato) => fato.rawEvidence))
      .toEqual(["Estadiamento cT2N0M0.", "Estadiamento cT3N0M0."]);
    expect(estagios[0]?.page).toBe(2);
    expect(estagios.every((fato) => fato.patientCandidateId === null)).toBe(true);
    expect([ap.patientId, nota.patientId]).toEqual([null, null]);

    const campo = reconciliarCampos(estagios).stage;
    expect(campo?.conflict).toBe(true);
    expect(campo?.candidates.map((fato) => fato.id))
      .toEqual(expect.arrayContaining(estagios.map((fato) => fato.id)));
    const conflito = detectarConflitos(estagios).find((item) => item.kind === "CONFLICT"
      && estagios.every((fato) => item.factIds.includes(fato.id)));
    expect(conflito?.sourceIds).toEqual(["fonte-pt07-ap", "fonte-pt07-nota"]);
  });
});
