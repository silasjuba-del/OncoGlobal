import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { aoCommitar, confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { ambienteHttp } from "./http-fixture.js";

const PACIENTE = "paciente-sintetico-g3a";
const ENCONTRO = "encontro-sintetico-g3a";
type Ambiente = Awaited<ReturnType<typeof ambienteHttp>>;

async function post<T>(ambiente: Ambiente, rota: string, entrada: unknown) {
  const response = await ambiente.request(rota, "POST", JSON.stringify(entrada), ambiente.token, "application/json");
  return { status: response.status, data: JSON.parse(response.body) as T };
}

function cadastrarPaciente(ambiente: Ambiente) {
  const sessao = ambiente.sessoes.obter(ambiente.token)!;
  salvarDraft(ambiente.db, { draftId: "seed-paciente-g3a", patientId: PACIENTE,
    sourceId: "source-seed-g3a", rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0,
    criadoEm: sessao.emitidaEm });
  confirmar(ambiente.db, { operationId: "op-seed-g3a", patientId: PACIENTE, tumorLotId: null,
    encounterId: ENCONTRO, reviewDecisionId: "review-seed-g3a", sessao,
    em: sessao.emitidaEm, registros: [{ draftId: "seed-paciente-g3a", expectedRevision: 0, eventId: "event-paciente-g3a",
      tipo: "Paciente", payload: { patientId: PACIENTE, identificadores: [], nome: "Maria Alves de Souza", nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false }, fontes: [], revisao: "CONFIRMADO" }] });
}

async function extrairSemVinculo(ambiente: Ambiente, sufixo: string) {
  const extraido = await post<{ draftId: string }>(ambiente, "/consulta/extrair", {
    recordingId: `recording-sintetico-g3a-${sufixo}`, sourceId: `documento-sintetico-g3a-${sufixo}`,
    sourceType: "medical_note",
    rawTranscript: "Nome do paciente: Maria Alves de Souza\nResumo sintético para revisão.",
  });
  expect(extraido.status).toBe(201);
  const fonte = lerDraft(ambiente.db, extraido.data.draftId)!;
  const excecao = (fonte.payload as { state: { confirmationRequired: Array<{ id: string; kind: string }> } })
    .state.confirmationRequired.find((item) => item.kind === "UNLINKED_PATIENT")!;
  return { fonte, excecao };
}

const contar = (ambiente: Ambiente, sql: string) => Number((ambiente.db.prepare(sql).get() as { n: number }).n);

describe("G3a · vínculo de paciente é atômico", () => {
  it("falha entre a decisão gravada e a atualização do rascunho não deixa gravação parcial; retry conclui", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente);
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null });
      const { fonte, excecao } = await extrairSemVinculo(ambiente, "1");
      const pedido = { exceptionId: excecao.id, acao: "LIGAR_PACIENTE", draftId: fonte.draftId,
        expectedRevision: 0, patientId: PACIENTE, sourceId: "documento-sintetico-g3a-1",
        encounterId: ENCONTRO, tumorLotId: null, idempotencyKey: "g3a-synthetic-link-1" };
      const decisoesAntes = contar(ambiente, "SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'");
      const operacoesAntes = contar(ambiente, "SELECT COUNT(*) AS n FROM operation");
      const rascunhosAntes = contar(ambiente, "SELECT COUNT(*) AS n FROM draft_envelope");

      // Falha forçada: dentro da transação de confirmar, outra escrita avança a revisão do rascunho-fonte.
      aoCommitar(ambiente.db, () => {
        ambiente.db.prepare("UPDATE draft_envelope SET revision=revision+1 WHERE draftId=?").run(fonte.draftId);
      });
      const falha = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/revisar", pedido);
      expect(falha).toMatchObject({ status: 409, data: { codigo: "REVISAO_RASCUNHO_CONFLITANTE" } });
      expect(contar(ambiente, "SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'")).toBe(decisoesAntes);
      expect(contar(ambiente, "SELECT COUNT(*) AS n FROM operation")).toBe(operacoesAntes);
      expect(contar(ambiente, "SELECT COUNT(*) AS n FROM draft_envelope")).toBe(rascunhosAntes);
      expect(lerDraft(ambiente.db, fonte.draftId)).toMatchObject({ revision: 0, patientId: null });

      // Sem a falha, o mesmo pedido conclui uma única vez e o retry é replay.
      aoCommitar(ambiente.db, () => {});
      const ok = await post<{ codigo: string; revision: number }>(ambiente, "/consulta/rascunho/revisar", pedido);
      expect(ok).toMatchObject({ status: 200, data: { codigo: "VINCULO_REVISTO", revision: 1 } });
      const replay = await post<{ codigo: string; replay?: boolean }>(ambiente, "/consulta/rascunho/revisar", pedido);
      expect(replay).toMatchObject({ status: 200, data: { codigo: "VINCULO_REVISTO", replay: true } });
      expect(contar(ambiente, "SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'")).toBe(decisoesAntes + 1);
    } finally { await ambiente.close(); }
  });

  it("recusa do kernel dentro do vínculo continua auditada após o rollback e não grava rascunho de decisão", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente);
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null });
      const { fonte, excecao } = await extrairSemVinculo(ambiente, "2");
      // A operação do vínculo deriva da chave; uma operação divergente pré-existente força OPERATION_HASH_CONFLICT.
      const operationId = `review-link-${createHash("sha256").update("g3a-synthetic-link-2").digest("hex").slice(0, 40)}`;
      const ultimoInstante = (ambiente.db.prepare("SELECT MAX(criadoEm) AS em FROM operation").get() as { em: string }).em;
      ambiente.db.prepare("INSERT INTO operation (operationId,payloadHash,resultRef,criadoEm) VALUES (?,?,?,?)")
        .run(operationId, "f".repeat(64), null, ultimoInstante);
      const conflitosAntes = contar(ambiente,
        "SELECT COUNT(*) AS n FROM audit_event WHERE motivoCodigo='OPERATION_HASH_CONFLICT'");
      const negado = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/revisar", {
        exceptionId: excecao.id, acao: "LIGAR_PACIENTE", draftId: fonte.draftId, expectedRevision: 0,
        patientId: PACIENTE, sourceId: "documento-sintetico-g3a-2", encounterId: ENCONTRO, tumorLotId: null,
        idempotencyKey: "g3a-synthetic-link-2" });
      expect(negado).toMatchObject({ status: 409, data: { codigo: "OPERATION_HASH_CONFLICT" } });
      expect(contar(ambiente, "SELECT COUNT(*) AS n FROM audit_event WHERE motivoCodigo='OPERATION_HASH_CONFLICT'"))
        .toBe(conflitosAntes + 1);
      expect(lerDraft(ambiente.db, fonte.draftId)).toMatchObject({ revision: 0, patientId: null });
      expect(contar(ambiente, "SELECT COUNT(*) AS n FROM draft_envelope WHERE draftId LIKE 'review-link-draft-%'")).toBe(0);
    } finally { await ambiente.close(); }
  });
});
