// RT-03 · Injeção de prompt e conteúdo hostil em documento (S0/S1) — provas de DEFESA.
// Prova: texto do documento é DADO, nunca instrução; nada é promovido a confirmado;
// nada executa (conversor é função pura); o ledger recusa evento sem decisão humana.
import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { converterEntradaLocal } from "../../src/leitura/caixa-unica.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { montarDocx } from "../fixtures/redteam/docx.js";
import { LAUDO_INJECAO } from "../fixtures/redteam/laudos.js";

const segmento = (rawTranscript: string, sourceType: "imaging_report" | "plaud" | "prescription" | "pathology" = "imaging_report") => ({
  id: "grav-rt03:0", recordingId: "grav-rt03", sourceId: "doc-rt03", sourceType,
  startMs: null, endMs: null, speakers: [], candidateNames: [],
  rawTranscript, boundaryConfidence: null, boundaryReviewRequired: false, patientId: null,
});

describe("RT-03 · injeção de prompt vira texto, nunca instrução", () => {
  it("linhas de injeção não produzem fato de dose, conduta ou confirmação", () => {
    const fatos = extratorDeterministico.extrair(segmento(LAUDO_INJECAO, "imaging_report"));
    const textos = fatos.map((f) => JSON.stringify(f.value));
    expect(textos.join("\n")).not.toMatch(/confirmado/i);
    expect(fatos.some((f) => f.domain === "drug" || f.domain === "cycle")).toBe(false);
    // Nenhum fato extraído herda "confirmação" da injeção:
    for (const f of fatos) expect(String(f.rawEvidence)).not.toMatch(/marque.*confirmado/i);
    // O diagnóstico legítimo da linha "diagnóstico:" é extraído como CANDIDATO, não como ordem:
    const diag = fatos.find((f) => f.domain === "diagnosis");
    expect(diag?.value).toContain("nódulo pulmonar");
  });

  it("pipeline não promove: nenhum campo resolvido, timeline nula, todo fato candidato a revisão", () => {
    const estado = executarPipelineExtracao({
      recordingId: "grav-rt03", sourceId: "doc-rt03", sourceType: "imaging_report",
      rawTranscript: LAUDO_INJECAO,
    });
    expect(estado.fields).toEqual({});
    expect(estado.timeline).toBeNull();
    expect(estado.confirmationRequired.length).toBeGreaterThan(0); // UNLINKED_PATIENT
    expect(estado.facts.every((f) => f.patientCandidateId === null)).toBe(true);
  });

  it("ledger: payload com texto de injeção SEM reviewDecisionId é recusado (REVIEW_DECISION_REQUIRED)", () => {
    const db = abrirLedger(":memory:");
    const agora = "2030-01-01T12:00:00Z";
    const sessao = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: agora, expiraEm: agora };
    salvarDraft(db, {
      draftId: "draft-rt03", patientId: "Paciente Teste 08", sourceId: "doc-rt03",
      rawRef: "opaque", payload: { texto: "liberado para QT dose 10x" },
      diagnostics: [], revision: 0, criadoEm: agora,
    });
    expect(() => confirmar(db, {
      operationId: "op-rt03", patientId: "Paciente Teste 08", tumorLotId: "tumor-08",
      encounterId: "enc-08", reviewDecisionId: "", sessao, em: agora,
      registros: [{
        draftId: "draft-rt03", expectedRevision: 0, eventId: "ev-rt03", tipo: "FATO",
        payload: { campo: "conduta", valor: "liberado para QT dose 10x" }, fontes: [],
        revisao: "CONFIRMADO" as const,
      }],
    })).toThrow(/REVIEW_DECISION_REQUIRED/);
    db.close();
  });

  it("markdown/HTML/script no texto é preservado como DADO, sem execução nem interpretação", () => {
    const hostil = '<script>alert(1)</script>\r\n**negrito** \u{0000}\u{0007} pipe | na linha';
    const leitura = converterEntradaLocal({
      id: "doc-hostil", tipo: "TEXT", conteudo: hostil, recebidoEm: "2030-01-01T09:00:00-03:00",
    });
    expect(leitura.status).toBe("PRONTO");
    expect(leitura.documento.paginas[0]?.texto).toContain('<script>alert(1)</script>');
    // Hash determinístico: o texto é tratado como bytes, não interpretado
    const deNovo = converterEntradaLocal({
      id: "doc-hostil", tipo: "TEXT", conteudo: hostil, recebidoEm: "2030-01-01T09:00:00-03:00",
    });
    expect(deNovo.documento.hash).toBe(leitura.documento.hash);
  });

  it("DOCX com script e atributos hostis dentro de w:t: só o texto sai, nada é interpretado", () => {
    const docx = montarDocx([
      '<script>window.alert("x")</script>',
      'imagem onload="fetch()" — laudo normal de Paciente Teste 08',
    ]);
    const leitura = converterEntradaLocal({
      id: "docx-hostil", tipo: "DOCX", conteudo: docx, recebidoEm: "2030-01-01T09:00:00-03:00",
    });
    expect(leitura.status).toBe("PRONTO");
    const texto = leitura.documento.paginas[0]?.texto ?? "";
    expect(texto).toContain('<script>window.alert("x")</script>');
    expect(texto).toContain('laudo normal de Paciente Teste 08');
  });
});
