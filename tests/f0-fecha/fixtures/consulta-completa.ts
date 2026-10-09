import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";

export const AGORA = "2026-10-09T12:00:00-03:00";
export const PACIENTE = "Paciente Teste 92";
export const OUTRO_PACIENTE = "Paciente Teste 93";
export const ENCONTRO = "encontro-teste-92";
export const SENHA = "senha-sintetica-comprida-92";

export type Codigo = { codigo: string };
export type Fato = { id: string; domain: string; sourceId: string; rawEvidence: string;
  value: unknown; date?: string; evidence: string; requiresConfirmation: boolean };
export type Extracao = Codigo & { draftId: string; revision: number; facts: Fato[];
  exceptions: Array<{ id: string; kind: string; segmentId: string | null }> };
export type Comprovante = { documentId: string; documentVersion: number; conteudoHash: string };
export type PreparacaoRevisao = Codigo & { conteudo: { resumo: string; selectedFactIds: string[] };
  comprovanteExibicao: Comprovante; criaEventoClinico: false };
export type Resposta<T> = { status: number; data: T };

export function criarDiretorio(): string {
  return mkdtempSync(join(tmpdir(), "f0-e6b-consulta-"));
}

export async function abrirAmbiente(dir: string) {
  const db = abrirLedger(join(dir, "consulta.sqlite"));
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste-e6b", crm: "CRM-TESTE-E6B",
    senha: SENHA, duracaoMs: 60_000, agora: () => AGORA });
  const gateway = criarGateway({ agora: () => AGORA, auditar: () => {},
    store: memoriaIdempotencia(), executores: {} });
  const server = criarServidorLocal({ db, sessoes, gateway, agora: () => AGORA, log: () => {},
    configRootDir: join(dir, "config") });
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_LOCAL_AUSENTE");
  const token = sessoes.login(SENHA)!.token;
  let chamadasHttp = 0;
  const request = async <T = Record<string, any>>(path: string, body: unknown, authToken = token): Promise<Resposta<T>> => {
    chamadasHttp++;
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() as T };
  };
  const close = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  };
  return { dir, db, sessoes, token, request, close, baseUrl: `http://127.0.0.1:${address.port}`, chamadasHttp: () => chamadasHttp,
    eventos: (patientId = PACIENTE) => listarEventos(db, patientId) };
}

/** Only the initial synthetic patient record is seeded; all workflow events use HTTP routes. */
export function cadastrarPaciente(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, numero: "92" | "93" = "92") {
  const patientId = `Paciente Teste ${numero}`;
  const encounterId = `encontro-teste-${numero}`;
  const suffix = numero;
  const draftId = `cadastro-sintetico-e6b-${suffix}`;
  salvarDraft(ambiente.db, { draftId, patientId, sourceId: `cadastro-fonte-e6b-${suffix}`,
    rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  const result = confirmar(ambiente.db, { operationId: `cadastro-operacao-e6b-${suffix}`,
    patientId, tumorLotId: null, encounterId, reviewDecisionId: `cadastro-decisao-e6b-${suffix}`,
    sessao: ambiente.sessoes.obter(ambiente.token)!, em: AGORA,
    registros: [{ draftId, expectedRevision: 0, eventId: `cadastro-evento-e6b-${suffix}`,
      tipo: "Paciente", payload: { patientId, identificadores: [], nome: patientId, nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false }, fontes: [], revisao: "CONFIRMADO" }],
  });
  if (result.estado !== "GRAVADA") throw new Error(`CADASTRO_SINTETICO_NAO_GRAVADO:${result.estado}`);
  return { patientId, encounterId };
}

export async function carregarConsulta(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, patientId = PACIENTE) {
  const result = await ambiente.request<Record<string, any>>("/consulta/carregar", { patientId });
  if (result.status !== 200) throw new Error(`CONSULTA_NAO_CARREGADA:${result.data.codigo}`);
  return result;
}

export async function extrair(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, input: {
  sourceId: string; sourceType: "pathology" | "medical_note" | "nursing"; text: string;
}): Promise<Extracao> {
  const result = await ambiente.request<Extracao>("/consulta/extrair", {
    recordingId: `gravacao-${input.sourceId}`, sourceId: input.sourceId,
    sourceType: input.sourceType, rawTranscript: input.text,
  });
  if (result.status !== 201) throw new Error(`EXTRACAO_HTTP_${result.status}:${result.data.codigo}`);
  return result.data;
}

/** Uses the explicit exception, action, source, context, and idempotency fields. */
export async function vincular(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, extracao: Extracao,
  sourceId: string, patientId = PACIENTE, encounterId = ENCONTRO) {
  const exception = extracao.exceptions.find((item) => item.kind === "UNLINKED_PATIENT");
  if (!exception) throw new Error(`EXCECAO_DE_VINCULO_AUSENTE:${sourceId}`);
  return ambiente.request<Codigo & { revision: number; linkedPatientId: string }>("/consulta/rascunho/revisar", {
    exceptionId: exception.id, acao: "LIGAR_PACIENTE", draftId: extracao.draftId,
    expectedRevision: extracao.revision, patientId, sourceId, encounterId, tumorLotId: null,
    idempotencyKey: `vinculo-e6b-${sourceId}`,
  });
}

export async function confirmarFatos(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, extracao: Extracao,
  factIds: string[], operationId: string, options: { link?: boolean; token?: string } = {}) {
  let expectedRevision = options.link === false ? extracao.revision + 1 : extracao.revision;
  if (options.link !== false) {
    const result = await vincular(ambiente, extracao, extracao.facts[0]?.sourceId ?? "fonte-e6b");
    if (result.status !== 200) throw new Error(`VINCULO_HTTP_${result.status}:${result.data.codigo}`);
    expectedRevision = result.data.revision;
  }
  const selecao = { draftId: extracao.draftId, expectedRevision, patientId: PACIENTE, factIds, operationId };
  const preview = await ambiente.request<PreparacaoRevisao>("/consulta/rascunho/preparar-revisao", selecao,
    options.token);
  return { selecao, preview, confirmar: (comprovanteExibicao: Comprovante) => ambiente.request<Codigo>(
    "/consulta/rascunho/revisar", { ...selecao, comprovanteExibicao }, options.token) };
}

export async function finalizarFlash(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, operationKey: string) {
  const context = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
  const plano = { acoesMarcadas: [], receitasMarcadas: [],
    apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE",
      pendencias: [], emitir: false },
    retorno: { dias: 30, examesAntesDoRetorno: [] },
    tarefasRetorno: { retorno: true, laboratorio: false, imagem: false } };
  const preparada = await ambiente.request<Codigo & { registros: Array<{ id: string; expectedRevision: number }>;
    documentos: Array<{ documentId: string; documentVersion: number }> }>("/consulta/flash/preparar", {
    ...context, plano, idempotencyKey: operationKey,
  });
  return { context, preparada };
}

export function removerDiretorio(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
