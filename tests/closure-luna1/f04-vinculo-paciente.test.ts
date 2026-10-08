import { describe, expect, it } from "vitest";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { confrontarNomeIdentificador } from "../../src/rules/w8/vinculoDocumento.js";
import { ambienteHttp } from "../server/http-fixture.js";

const AGORA = "2026-10-08T12:00:00Z";
const PACIENTE = "paciente-sintetico-07";
const ENCONTRO = "encontro-sintetico-07";

async function post<T>(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, rota: string, entrada: unknown) {
  const response = await ambiente.request(rota, "POST", JSON.stringify(entrada), ambiente.token, "application/json");
  return { status: response.status, data: JSON.parse(response.body) as T };
}

function cadastrarPaciente(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, nome: string) {
  salvarDraft(ambiente.db, { draftId: "seed-paciente-f04", patientId: PACIENTE,
    sourceId: "source-seed-f04", rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0,
    criadoEm: AGORA });
  confirmar(ambiente.db, { operationId: "op-seed-f04", patientId: PACIENTE, tumorLotId: null,
    encounterId: ENCONTRO, reviewDecisionId: "review-seed-f04", sessao: ambiente.sessoes.obter(ambiente.token)!,
    em: AGORA, registros: [{ draftId: "seed-paciente-f04", expectedRevision: 0, eventId: "event-paciente-f04",
      tipo: "Paciente", payload: { patientId: PACIENTE, identificadores: [], nome, nascimento: null,
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
});
