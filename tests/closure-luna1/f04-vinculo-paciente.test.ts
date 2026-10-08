import { describe, expect, it } from "vitest";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { confrontarNomeIdentificador } from "../../src/rules/w8/vinculoDocumento.js";
import { calcularCnsDefinitivo } from "../../src/rules/cns.js";
import { ambienteHttp } from "../server/http-fixture.js";

const AGORA = "2026-10-08T12:00:00Z";
const PACIENTE = "paciente-sintetico-07";
const ENCONTRO = "encontro-sintetico-07";

async function post<T>(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, rota: string, entrada: unknown) {
  const response = await ambiente.request(rota, "POST", JSON.stringify(entrada), ambiente.token, "application/json");
  return { status: response.status, data: JSON.parse(response.body) as T };
}

function cadastrarPaciente(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, nome: string,
  identificadores: Array<{ tipo: "CNS" | "CPF" | "PRONTUARIO"; valor: string }> = []) {
  salvarDraft(ambiente.db, { draftId: "seed-paciente-f04", patientId: PACIENTE,
    sourceId: "source-seed-f04", rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0,
    criadoEm: AGORA });
  confirmar(ambiente.db, { operationId: "op-seed-f04", patientId: PACIENTE, tumorLotId: null,
    encounterId: ENCONTRO, reviewDecisionId: "review-seed-f04", sessao: ambiente.sessoes.obter(ambiente.token)!,
    em: AGORA, registros: [{ draftId: "seed-paciente-f04", expectedRevision: 0, eventId: "event-paciente-f04",
      tipo: "Paciente", payload: { patientId: PACIENTE, identificadores, nome, nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false }, fontes: [], revisao: "CONFIRMADO" }] });
}

describe("closure F04 · vínculo documental explicitamente revisado", () => {
  it("preserva conflito nome × cadastro e não cria evento nem operação", () => {
    expect(confrontarNomeIdentificador({ nomeDocumento: "Paciente Teste 09",
      identificador: { tipo: "CNS", valor: "123" }, cadastroNome: "Maria Alves de Souza",
      cadastroIdentificadores: [{ tipo: "CNS", valor: "123" }] })).toMatchObject({ liga: false });
  });

  it("exige contexto, grava decisão atribuída à sessão e reproduz replay sem duplicar", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente, "Maria Alves de Souza");
      const extracted = await post<{ draftId: string; revision: number }>(ambiente, "/consulta/extrair", {
        recordingId: "recording-sintetico-f04", sourceId: "documento-sintetico-f04", sourceType: "medical_note",
        rawTranscript: "Nome do paciente: Maria Alves de Souza\nResumo sintético para revisão.",
      });
      expect(extracted.status).toBe(201);
      const sourceDraft = lerDraft(ambiente.db, extracted.data.draftId)!;
      const exception = (sourceDraft.payload as { state: { confirmationRequired: Array<{ id: string; kind: string }> } })
        .state.confirmationRequired.find((item) => item.kind === "UNLINKED_PATIENT")!;
      const pedido = { exceptionId: exception.id, acao: "LIGAR_PACIENTE", draftId: extracted.data.draftId,
        expectedRevision: 0, patientId: PACIENTE, sourceId: "documento-sintetico-f04",
        encounterId: ENCONTRO, tumorLotId: null, idempotencyKey: "f04-synthetic-link-1" };
      const semContexto = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/revisar", pedido);
      expect(semContexto).toMatchObject({ status: 409, data: { codigo: "CONTEXTO_CONSULTA_NAO_SELECIONADO" } });
      expect(lerDraft(ambiente.db, pedido.draftId)?.patientId).toBeNull();

      const contexto = await post<{ codigo: string }>(ambiente, "/consulta/contexto/selecionar", {
        patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null,
      });
      expect(contexto.status).toBe(200);
      const gravado = await post<{ codigo: string; revision: number }>(ambiente, "/consulta/rascunho/revisar", pedido);
      expect(gravado).toMatchObject({ status: 200, data: { codigo: "VINCULO_REVISTO", revision: 1 } });
      expect(lerDraft(ambiente.db, pedido.draftId)?.payload).toMatchObject({ patientLinkReview: {
        patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null, reviewDecisionId: expect.any(String),
      } });
      const replay = await post<{ codigo: string; replay?: boolean }>(ambiente, "/consulta/rascunho/revisar", pedido);
      expect(replay).toMatchObject({ status: 200, data: { codigo: "VINCULO_REVISTO", replay: true } });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'").get())
        .toMatchObject({ n: 1 });
      expect(ambiente.db.prepare("SELECT criadoPor FROM clinical_event WHERE tipo='ReviewDecision'").get())
        .toMatchObject({ criadoPor: expect.stringContaining("medico-teste") });
    } finally { await ambiente.close(); }
  });

  it("rejeita nome documental divergente antes de qualquer alteração", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente, "Maria Alves de Souza");
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE,
        encounterId: ENCONTRO, tumorLotId: null });
      const extracted = await post<{ draftId: string }>(ambiente, "/consulta/extrair", {
        recordingId: "recording-sintetico-conflict", sourceId: "documento-sintetico-conflict", sourceType: "medical_note",
        rawTranscript: "Nome do paciente: Outra Pessoa Sintética\nConteúdo sintético.",
      });
      const sourceDraft = lerDraft(ambiente.db, extracted.data.draftId)!;
      const exception = (sourceDraft.payload as { state: { confirmationRequired: Array<{ id: string; kind: string }> } })
        .state.confirmationRequired.find((item) => item.kind === "UNLINKED_PATIENT")!;
      const response = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/revisar", {
        exceptionId: exception.id, acao: "LIGAR_PACIENTE", draftId: extracted.data.draftId,
        expectedRevision: 0, patientId: PACIENTE, sourceId: "documento-sintetico-conflict",
        encounterId: ENCONTRO, tumorLotId: null, idempotencyKey: "f04-synthetic-link-conflict",
      });
      expect(response).toMatchObject({ status: 409, data: { codigo: "CONFLITO_IDENTIDADE_DOCUMENTAL" } });
      expect(lerDraft(ambiente.db, extracted.data.draftId)).toMatchObject({ patientId: null, revision: 0 });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM operation WHERE operationId LIKE 'review-link-%'").get())
        .toMatchObject({ n: 0 });
    } finally { await ambiente.close(); }
  });

  it("não liga silenciosamente CNS de um cadastro com nome documental de outro", async () => {
    const ambiente = await ambienteHttp();
    try {
      const cns = calcularCnsDefinitivo("12345678901");
      cadastrarPaciente(ambiente, "Paciente Teste 07", [{ tipo: "CNS", valor: cns }]);
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE,
        encounterId: ENCONTRO, tumorLotId: null });
      const extracted = await post<{ draftId: string }>(ambiente, "/consulta/extrair", {
        recordingId: "recording-sintetico-cns-trocado", sourceId: "documento-sintetico-cns-trocado",
        sourceType: "medical_note", rawTranscript: `Nome do paciente: Paciente Teste 09\nCNS: ${cns}\nNota sintética.`,
      });
      const sourceDraft = lerDraft(ambiente.db, extracted.data.draftId)!;
      const exception = (sourceDraft.payload as { state: { confirmationRequired: Array<{ id: string; kind: string }> } })
        .state.confirmationRequired.find((item) => item.kind === "UNLINKED_PATIENT")!;
      const response = await post<{ codigo: string; motivo: string }>(ambiente, "/consulta/rascunho/revisar", {
        exceptionId: exception.id, acao: "LIGAR_PACIENTE", draftId: extracted.data.draftId,
        expectedRevision: 0, patientId: PACIENTE, sourceId: "documento-sintetico-cns-trocado",
        encounterId: ENCONTRO, tumorLotId: null, idempotencyKey: "f04-cns-name-conflict-01",
      });
      expect(response).toMatchObject({ status: 409, data: { codigo: "CONFLITO_IDENTIDADE_DOCUMENTAL" } });
      expect(response.data.motivo).toMatch(/nome/i);
      expect(lerDraft(ambiente.db, extracted.data.draftId)).toMatchObject({ patientId: null, revision: 0 });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'").get())
        .toMatchObject({ n: 0 });
    } finally { await ambiente.close(); }
  });

  it("preserva o comando legado como identidade apenas sem selecionar consulta nem confirmar fatos", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente, "Maria Alves de Souza");
      const extracted = await post<{ draftId: string }>(ambiente, "/consulta/extrair", {
        recordingId: "recording-sintetico-legacy", sourceId: "documento-sintetico-legacy", sourceType: "medical_note",
        rawTranscript: "Resumo sintético sem identificador ou nome documental.",
      });
      const response = await post<{ codigo: string; fatosConfirmados: number }>(ambiente,
        "/consulta/rascunho/revisar", { draftId: extracted.data.draftId, expectedRevision: 0, patientId: PACIENTE });
      expect(response).toMatchObject({ status: 200, data: { codigo: "VINCULO_REVISTO", fatosConfirmados: 0 } });
      expect(ambiente.sessoes.consultaSelecionada(ambiente.token)).toBeNull();
      expect(lerDraft(ambiente.db, extracted.data.draftId)).toMatchObject({ patientId: PACIENTE,
        payload: { patientLinkReview: { patientId: PACIENTE, tumorLotId: null, identityOnly: true,
          segmentId: expect.any(String) } } });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='FATO'").get()).toMatchObject({ n: 0 });
    } finally { await ambiente.close(); }
  });

  it("vincular um segmento não autoriza promover fatos de outro segmento da mesma gravação", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente, "Paciente Teste 07");
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE,
        encounterId: ENCONTRO, tumorLotId: null });
      const extracted = await post<{ draftId: string; facts: Array<{ id: string; segmentId: string; rawEvidence: string }> }>(
        ambiente, "/consulta/extrair", { recordingId: "recording-multisegment-f04",
          sourceId: "source-multisegment-f04", sourceType: "medical_note",
          rawTranscript: ["Chamo Paciente Teste 07, bom dia.",
            "Creatinina 1,1 mg/dL em 08/10/2026.", "Chamo Paciente Teste 08, bom dia.",
            "Creatinina 1,2 mg/dL em 08/10/2026."].join("\n") });
      const draft = lerDraft(ambiente.db, extracted.data.draftId)!;
      const source = draft.payload as { state: { segments: Array<{ id: string }>;
        confirmationRequired: Array<{ id: string; kind: string; segmentId: string | null }> } };
      expect(source.state.segments.length).toBeGreaterThanOrEqual(2);
      const firstSegmentId = source.state.segments[0]!.id;
      const exception = source.state.confirmationRequired.find((item) => item.kind === "UNLINKED_PATIENT"
        && item.segmentId === firstSegmentId)!;
      const otherFact = extracted.data.facts.find((fact) => fact.segmentId !== firstSegmentId);
      expect(otherFact).toBeDefined();
      if (!otherFact) throw new Error("FATO_SINTETICO_DO_SEGMENTO_NAO_LIGADO_AUSENTE");
      const linked = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/revisar", {
        exceptionId: exception.id, acao: "LIGAR_PACIENTE", draftId: draft.draftId,
        expectedRevision: 0, patientId: PACIENTE, sourceId: "source-multisegment-f04",
        encounterId: ENCONTRO, tumorLotId: null, idempotencyKey: "f04-multisegment-link-01",
      });
      expect(linked).toMatchObject({ status: 200, data: { codigo: "VINCULO_REVISTO" } });
      expect(lerDraft(ambiente.db, draft.draftId)?.payload).toMatchObject({
        patientLinkReview: { segmentId: firstSegmentId },
      });
      const rejected = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/preparar-revisao", {
        draftId: draft.draftId, expectedRevision: 1, patientId: PACIENTE,
        factIds: [otherFact.id], operationId: "f04-other-segment-promotion",
      });
      expect(rejected).toMatchObject({ status: 409, data: { codigo: "FATO_FORA_DO_SEGMENTO_VINCULADO" } });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'").get())
        .toMatchObject({ n: 1 });
      expect(ambiente.db.prepare("SELECT 1 AS ok FROM operation WHERE operationId='f04-other-segment-promotion'").get()).toBeUndefined();
    } finally { await ambiente.close(); }
  });
});
