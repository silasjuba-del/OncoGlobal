import { describe, expect, it } from "vitest";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { classificarMetastaseVisceral, seriesDeImagem } from "../../src/kernel/projections/radiologia.js";
import { reconciliarCampo, valorNaoResolvivel } from "../../src/kernel/extracao/reconciliacao.js";
import type { ClinicalFact } from "../../src/kernel/extracao/tipos.js";

const base = { recordingId: "adv", sourceId: "fonte-adv", sourceType: "medical_note" as const };

function fato(over: Partial<ClinicalFact> & { domain: ClinicalFact["domain"] }): ClinicalFact {
  return {
    id: "adv-fato", segmentId: "seg-1", patientCandidateId: null, value: null,
    sourceType: "medical_note", evidence: "EXPLICIT", sourceId: "fonte-adv",
    rawEvidence: "linha sintética", confidence: 1, requiresConfirmation: false, ...over,
  };
}

describe("ADV · extração/pipeline não promove o que não foi dito", () => {
  it("negação não vira diagnóstico nem achado positivo", () => {
    const r = executarPipelineExtracao({ ...base, rawTranscript: "Não há neoplasia de mama.\nSem sinais de lesão em L5." });
    expect(r.facts).toEqual([]);
    expect(r.caixaRevisao.itens.some((i) => i.kind === "CONFLICT")).toBe(false);
  });

  it("linfonodo medido não vira N2 nem estadiamento", () => {
    const r = executarPipelineExtracao({ ...base, rawTranscript: "Linfonodo de 24 mm em axila direita." });
    expect(r.facts.some((f) => f.domain === "stage")).toBe(false);
    expect(r.facts.some((f) => f.domain === "metastasis")).toBe(false);
  });

  it("'sem M1 visceral nos exames apresentados' não produz M0", () => {
    const r = executarPipelineExtracao({
      ...base, sourceType: "imaging_report",
      rawTranscript: "TC tórax: sem M1 visceral identificável nos exames apresentados.\nFoco em L5 medindo 20 mm.",
    });
    expect(r.facts.some((f) => f.domain === "stage")).toBe(false);
    expect(r.timeline).toBeNull();
    const veredito = classificarMetastaseVisceral(seriesDeImagem(r.facts));
    expect(["SEM_M1_VISIVEL", "SUSPEITO", "INDETERMINADO"]).toContain(veredito.estado);
    expect(JSON.stringify(veredito)).not.toContain("\"M0\"");
  });

  it("número falado não resolve o campo: valor fica nulo e o campo não é eleito", () => {
    const r = executarPipelineExtracao({
      recordingId: "adv-plaud", sourceId: "fonte-adv", sourceType: "plaud",
      rawTranscript: "Chamo Paciente Teste 07.\nCreatinina quatorze.",
    });
    const lab = r.facts.find((f) => f.domain === "lab")!;
    expect(lab).toMatchObject({ confidence: 0.6, requiresConfirmation: true });
    expect((lab.value as { value: null }).value).toBeNull();
    // O número falado não traz marcador: o campo é "lab" e não pode ser eleito sem valor.
    expect(r.fields["lab"]).toMatchObject({ resolvedFactId: null, conflict: false });
    expect(r.fields["lab"]!.candidates).toHaveLength(1);
    expect(r.exceptions.some((e) => e.kind === "SPOKEN_NUMBER")).toBe(true);
  });

  it("confirmação forjada não cria timeline: só LIGAR_PACIENTE com exceção real", () => {
    const texto = "Bom dia, chamo Paciente Teste 07.\nCreatinina quatorze.";
    const semAcao = executarPipelineExtracao({ ...base, sourceType: "plaud", rawTranscript: texto });
    const vinculo = semAcao.caixaRevisao.itens.find((i) => i.kind === "UNLINKED_PATIENT")!;
    const em = "2026-10-07T09:00:00-03:00";

    const soConfirmar = executarPipelineExtracao({
      ...base, sourceType: "plaud", rawTranscript: texto,
      confirmacoes: [{ exceptionId: vinculo.id, acao: "CONFIRMAR", medicoId: "medico-teste", em }],
    });
    expect(soConfirmar.timelines).toEqual([]);

    const idInexistente = executarPipelineExtracao({
      ...base, sourceType: "plaud", rawTranscript: texto,
      confirmacoes: [{ exceptionId: "exc:UNLINKED_PATIENT:nao-existe", acao: "LIGAR_PACIENTE", medicoId: "medico-teste", em, patientId: "P07" }],
    });
    expect(idInexistente.timelines).toEqual([]);

    const ligado = executarPipelineExtracao({
      ...base, sourceType: "plaud", rawTranscript: texto,
      confirmacoes: [{ exceptionId: vinculo.id, acao: "LIGAR_PACIENTE", medicoId: "medico-teste", em, patientId: "P07" }],
    });
    expect(ligado.timelines).toHaveLength(1);
    expect(ligado.timelines[0]!.patientId).toBe("P07");
  });
});

describe("ADV · reconciliação não elege valor sem valor", () => {
  it("fato sem valor utilizável deixa o campo sem resolução", () => {
    const vazio = fato({ domain: "lab", value: { marker: "Creatinina", value: null, unit: null, raw: "quatorze", normalizado: false } });
    const semNormalizar = fato({ id: "sem-normalizar", domain: "lab", value: { marker: "X", value: 10, unit: null, raw: "10 UI/L", normalizado: false } });
    const ok = fato({ id: "ok", domain: "lab", value: { marker: "Hb", value: 11.2, unit: "g/dL", raw: "11,2 g/dL", normalizado: true } });
    expect(valorNaoResolvivel(vazio)).toBe(true);
    expect(valorNaoResolvivel(semNormalizar)).toBe(true);
    expect(valorNaoResolvivel(ok)).toBe(false);
    expect(reconciliarCampo("lab", [vazio])).toMatchObject({ resolvedFactId: null, conflict: false });
    expect(reconciliarCampo("lab", [semNormalizar])).toMatchObject({ resolvedFactId: null });
    expect(reconciliarCampo("lab", [ok])).toMatchObject({ resolvedFactId: "ok" });
  });

  it("fato normalizado continua vencendo o conflito e mantendo o conflito visível", () => {
    const ok = fato({ id: "ok", domain: "lab", sourceType: "medical_note", value: { marker: "Hb", value: 11.2, unit: "g/dL", normalizado: true } });
    const divergente = fato({ id: "div", domain: "lab", sourceType: "plaud", value: { marker: "Hb", value: 9, unit: "g/dL", normalizado: true } });
    const campo = reconciliarCampo("lab", [divergente, ok]);
    expect(campo.resolvedFactId).toBe("ok");
    expect(campo.conflict).toBe(true);
  });
});
