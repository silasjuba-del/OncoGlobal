import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { DataCivil, Id, type Fonte } from "../contracts/base.js";
import { Contato, Triagem } from "../contracts/clinico.js";
import { ActionIntent, ConfirmarBloco, type ConfirmarBloco as Confirmar } from "../contracts/operacao.js";
import { lerDraft, listarDrafts, salvarDraft } from "../kernel/ledger/drafts.js";
import { sqliteIdempotencia } from "../kernel/ledger/idempotencia.js";
import { confirmar } from "../kernel/ledger/writeRouter.js";
import { listarEventos } from "../kernel/ledger/ledger.js";
import { g25EscopoAssinatura } from "../kernel/harness/gates.js";
import type { criarGateway } from "../kernel/gateway/gateway.js";
import { autorizarSaida } from "./autorizacao.js";
import { hashConteudoExibido, type GerenciadorSessao } from "./sessao.js";
import { executarPipelineExtracao, type ExtractionInput } from "../orchestration/pipeline-extracao.js";
import { g07Lateralidade, g08AnatomiaSexo, g09PtDeBiopsia } from "../kernel/harness/gates.js";
import { lerAgenda, lerApacs, lerCanal, lerConsulta, lerLotes, lerMensagensChat, lerPaciente, lerRecist, lerSalao, lerTriagens } from "./leituras.js";
import type { SettingsService } from "../config/settings.js";
import type { carregarCorpusServidor } from "./corpus.js";
import { parserLinha } from "../rules/prescricao/parserLinha.js";
import { classificarDocumento } from "../rules/prescricao/classificarDocumento.js";
import { instanciarProtocolo } from "../rules/prescricao/instanciarProtocolo.js";
import { rotearItemReceita } from "../rules/prescricao/receituarioEspecial.js";
import { lerConfiguracaoServico, NUMERO_CAIXA_RECEITUARIO_ESPECIAL } from "../config/servico.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { projetarEstatisticaLedger } from "../estatistica/index.js";
import { consultarGrafoLocal } from "../app/pesquisa/conhecimento.js";
import { prepararRevisaoExtracao } from "../app/revisaoExtracao.js";
import { ClinicalFact as ClinicalFactContract, EncounterSegment, FactSourceType,
  ReviewAction, ReviewException } from "../contracts/w10/extracao.js";
import { AcaoRevisaoPedido, ClosureVinculoContato } from "../contracts/w10/closure.js";
import { criarOncoassistJev } from "../app/oncoassist.js";
import { detectarEmergencias } from "../rules/radsEmergencias.js";
import { PlanoFlashEntrada, lerModeloFlash, prepararFinalizacaoFlash, salvarRascunhoFlash } from "./flash.js";
import { CHAVE_CAIXA_MODELO_FLASH } from "../config/flash.js";
import { confrontarNomeIdentificador } from "../rules/w8/vinculoDocumento.js";
import { normalizarDataCivil } from "../kernel/extracao/normalizacao.js";
import { farmacosMencionados, reconciliarCampos } from "../kernel/extracao/reconciliacao.js";
import { AvaliacaoInstrumentoRequest, avaliarInstrumentoEstruturado } from "./f0c/instrumentosClinicos.js";

export interface ServidorDeps {
  db: DatabaseSync;
  sessoes: GerenciadorSessao;
  gateway: ReturnType<typeof criarGateway>;
  salaoRuleset?: unknown;
  settings?: SettingsService | null;
  configRootDir?: string;
  corpus?: ReturnType<typeof carregarCorpusServidor> | null;
  oncoassistJev?: ReturnType<typeof criarOncoassistJev>;
  agora: () => string;
  log: (entry: { rota: string; codigo: string; status: number }) => void;
}
type SessaoLeitura = Parameters<NonNullable<ServidorDeps["settings"]>["readBox"]>[1];
/** Mesmas caixas e corpus na leitura da consulta e na preparação dos documentos. */
function opcoesLeituraConsulta(deps: ServidorDeps, sessao: SessaoLeitura) {
  const numeroModelo = deps.corpus?.caixasTodas.find((c) => c.chave === CHAVE_CAIXA_MODELO_FLASH)?.numero ?? null;
  let modeloFlash = null as ReturnType<typeof lerModeloFlash>;
  if (numeroModelo !== null && deps.settings) {
    try { modeloFlash = lerModeloFlash(deps.settings.readBox(numeroModelo, sessao).value); } catch { modeloFlash = null; }
  }
  return { limiarPlaquetas: deps.corpus?.limiarPlaquetas ?? null, modeloFlash,
    templates: deps.corpus?.templatesProtocolo ?? [], salaoRuleset: deps.salaoRuleset,
    interacoes: deps.corpus?.interacoes, catalogo: deps.corpus?.catalogoInteracoes, feveRuleset: deps.corpus?.feveRuleset,
    tetosCumulativos: deps.corpus?.tetosCumulativos ?? [],
    instrumentos: deps.corpus?.instrumentos ?? [], ...(deps.corpus?.condicionais ? { condicionais: deps.corpus.condicionais } : {}) };
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const ExibirBundle = z.object({
  patientId: Id,
  encounterId: Id,
  draftIds: z.array(Id),
  tumorLotId: Id.nullable().optional(),
}).strict();
class JsonInvalido extends Error {}
function contentTypeJson(req: IncomingMessage): boolean {
  const header = req.headers["content-type"];
  return typeof header === "string"
    && /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(header.trim());
}
function send(res: ServerResponse, status: number, object: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(object));
}
async function body(req: IncomingMessage): Promise<unknown> {
  let value = "";
  for await (const chunk of req) {
    value += String(chunk);
    if (value.length > 1_000_000) throw new Error("BODY_TOO_LARGE");
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    // Só a falha do corpo HTTP é 400; JSON interno do ledger continua erro interno.
    if (error instanceof SyntaxError) throw new JsonInvalido();
    throw error;
  }
}

function payloadDocumento(value: unknown): { documentId: string; documentVersion: number; documentHash: string } | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  return typeof d.documentId === "string" && Number.isInteger(d.documentVersion)
    && typeof d.documentHash === "string"
    ? { documentId: d.documentId, documentVersion: d.documentVersion as number, documentHash: d.documentHash }
    : null;
}

function contextoDraft(value: unknown): { encounterId: string; tumorLotId: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outer = value as Record<string, unknown>;
  const inner = outer.contexto && typeof outer.contexto === "object" && !Array.isArray(outer.contexto)
    ? outer.contexto as Record<string, unknown> : outer;
  return typeof inner.encounterId === "string"
    && (typeof inner.tumorLotId === "string" || inner.tumorLotId === null)
    ? { encounterId: inner.encounterId, tumorLotId: inner.tumorLotId } : null;
}

function evidenciaIdentidade(texto: string): { nomeDocumento: string | null; identificador: { tipo: "CPF" | "CNS"; valor: string } | null; trecho: string | null } {
  const nomeMatch = texto.match(/^\s*(?:nome\s+do\s+paciente|paciente|nome)\s*[:\-]\s*([^\r\n]{2,120})/im);
  const idMatch = texto.match(/(?:\bCPF\b\s*[:\-]?\s*([\d.\-/ ]{11,18})|\bCNS\b\s*[:\-]?\s*([\d.\-/ ]{15,24}))/i);
  const rawId = idMatch?.[1] ?? idMatch?.[2] ?? null;
  const identificador = rawId ? { tipo: idMatch?.[1] ? "CPF" as const : "CNS" as const, valor: rawId.trim() } : null;
  const trecho = nomeMatch?.[0]?.trim() ?? (idMatch?.[0]?.trim() ?? null);
  return { nomeDocumento: nomeMatch?.[1]?.trim() ?? null, identificador, trecho };
}

function chaveVinculoLegado(input: { draftId: string; revision: number; patientId: string;
  encounterId: string; tumorLotId: string | null }): string {
  return `review-link-legacy-${sha(JSON.stringify([input.draftId, input.revision, input.patientId,
    input.encounterId, input.tumorLotId])).slice(0, 40)}`;
}

function fatoSustentaDataClinica(fact: z.infer<typeof ClinicalFactContract>, data: string): boolean {
  const literal = /(?:\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b)/gu;
  const textoValor = typeof fact.value === "string" ? fact.value
    : fact.value && typeof fact.value === "object" && !Array.isArray(fact.value)
      ? ["raw", "normalizado", "marker"].map((key) => (fact.value as Record<string, unknown>)[key])
        .filter((value): value is string => typeof value === "string").join(" ") : "";
  const normalizar = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR").trim();
  const farmacos = farmacosMencionados(textoValor).map(normalizar);
  const clauses = fact.rawEvidence.split(/[;,]|\s+e\s+(?=(?:Hb|hemoglobina|creatinina|PSA|CEA|plaquetas)\b)/iu);
  return clauses.some((clause) => {
    const dates = [...clause.matchAll(literal)].map((match) => normalizarDataCivil(match[0]));
    if (!dates.includes(data)) return false;
    if (fact.domain === "plan" || fact.domain === "drug" || fact.domain === "regimen") {
      const normalizedClause = normalizar(clause);
      return farmacos.length > 0 && farmacos.some((term) => normalizedClause.includes(term));
    }
    if (fact.domain === "cycle") return /\bciclo\s*\d+/iu.test(clause);
    return true;
  });
}

/** W4-03 · a tela recebe conteúdo/hash calculado no servidor, nunca uma declaração do cliente. */
function exibirBundle(deps: ServidorDeps, token: string,
  input: z.infer<typeof ExibirBundle>): { status: number; body: unknown } {
  if (new Set(input.draftIds).size !== input.draftIds.length)
    return { status: 400, body: { codigo: "DRAFT_DUPLICADO" } };
  const documentos: { draftId: string; documentId: string; documentVersion: number;
    conteudo: unknown; conteudoHash: string }[] = [];
  const chaves = new Set<string>();
  for (const draftId of input.draftIds) {
    const draft = lerDraft(deps.db, draftId);
    if (!draft || draft.patientId !== input.patientId)
      return { status: 409, body: { codigo: "DRAFT_NAO_ENCONTRADO" } };
    const contexto = contextoDraft(draft.payload);
    if (!contexto) return { status: 409, body: { codigo: "DRAFT_CONTEXTO_AUSENTE" } };
    if (contexto.encounterId !== input.encounterId)
      return { status: 409, body: { codigo: "DRAFT_ENCONTRO_DIVERGENTE" } };
    if (contexto.tumorLotId !== (input.tumorLotId ?? null))
      return { status: 409, body: { codigo: "DRAFT_LOTE_DIVERGENTE" } };
    // Generic facts also need a server-issued reference and exact displayed content.
    const doc = payloadDocumento(draft.payload) ?? { documentId: draft.draftId, documentVersion: draft.revision + 1 };
    const chave = JSON.stringify([doc.documentId, doc.documentVersion]);
    if (chaves.has(chave)) return { status: 409, body: { codigo: "DOCUMENTO_DUPLICADO" } };
    chaves.add(chave);
    documentos.push({
      draftId, documentId: doc.documentId, documentVersion: doc.documentVersion,
      conteudo: draft.payload, conteudoHash: hashConteudoExibido(draft.payload),
    });
  }
  deps.sessoes.registrarBundleExibido(token,
    { patientId: input.patientId, encounterId: input.encounterId, tumorLotId: input.tumorLotId ?? null },
    documentos.map(({ draftId, documentId, documentVersion, conteudoHash }) =>
      ({ draftId, documentId, documentVersion, conteudoHash })));
  return { status: 200, body: { patientId: input.patientId, encounterId: input.encounterId, documentos } };
}

/** ConfirmarBloco is strict; all clinical contents are fetched from local drafts, not HTTP input. */
function confirmarBloco(deps: ServidorDeps, token: string, input: Confirmar): { status: number; body: unknown } {
  const sessao = deps.sessoes.obter(token)!;
  const contexto = { patientId: input.patientId, encounterId: input.encounterId, tumorLotId: input.tumorLotId };
  const exibidosNoServidor = deps.sessoes.bundleExibido(token, contexto);
  if (!exibidosNoServidor) return { status: 409, body: { codigo: "BUNDLE_NAO_EXIBIDO" } };
  if (g25EscopoAssinatura(input.documentosExibidos, exibidosNoServidor).decisao !== "PASSA")
    return { status: 409, body: { codigo: "ESCOPO_ASSINATURA_INVALIDO" } };
  if (new Set(input.registros.map((r) => r.id)).size !== input.registros.length)
    return { status: 409, body: { codigo: "DRAFT_DUPLICADO" } };
  const drafts = input.registros.map((r) => lerDraft(deps.db, r.id));
  if (drafts.some((draft) => !draft || draft.patientId !== input.patientId))
    return { status: 409, body: { codigo: "DRAFT_NAO_ENCONTRADO" } };
  if (drafts.some((draft) => {
    const contexto = contextoDraft(draft?.payload);
    return !contexto || contexto.encounterId !== input.encounterId || contexto.tumorLotId !== input.tumorLotId;
  })) return { status: 409, body: { codigo: "DRAFT_FORA_DO_ESCOPO" } };
  if (drafts.some((draft) => {
    const kind = draft?.payload && typeof draft.payload === "object" && "kind" in draft.payload
      ? draft.payload.kind : null;
    return kind === "EXTRACAO_RASCUNHO" || kind === "PRESCRICAO_RASCUNHO" || kind === "EVOLUCAO_RASCUNHO"
      || kind === "FLASH_RASCUNHO" || kind === "FLASH_APAC_RASCUNHO";
  })) return { status: 409, body: { codigo: "DRAFT_AINDA_RASCUNHO" } };
  const consulta = deps.sessoes.consultaSelecionada(token);
  if (consulta && (consulta.patientId !== contexto.patientId || consulta.encounterId !== contexto.encounterId
    || (consulta.tumorLotId ?? null) !== contexto.tumorLotId))
    return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } };
  const escolhidos = input.documentosExibidos;
  const docs = drafts.map((d) => payloadDocumento(d!.payload));
  const refs = docs.map((doc, i) => doc ?? { documentId: drafts[i]!.draftId,
    documentVersion: input.registros[i]!.expectedRevision + 1 });
  if (refs.length !== escolhidos.length || new Set(refs.map((r) => JSON.stringify([r.documentId, r.documentVersion]))).size !== refs.length
    || refs.some((ref) => !escolhidos.some((d) => d.documentId === ref.documentId && d.documentVersion === ref.documentVersion)))
    return { status: 409, body: { codigo: "DOCUMENTO_NAO_SELECIONADO" } };
  // A13: só assina o conteúdo EXATO exibido. Hash ausente ou diferente ⇒ 409 (o draft mudou depois da tela).
  const hashes = drafts.map((d) => hashConteudoExibido(d!.payload));
  const alterado = refs.some((doc, i) => !exibidosNoServidor.some((x) => x.documentId === doc.documentId
      && x.documentVersion === doc.documentVersion && x.conteudoHash === hashes[i]
      && x.draftId === drafts[i]!.draftId));
  if (alterado) return { status: 409, body: { codigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" } };
  const em = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?")
    .get(input.idempotencyKey)?.criadoEm as string | undefined ?? deps.agora();
  const reviewDecisionId = sha(JSON.stringify({ input, medicoId: sessao.medicoId }));
  const registros = input.registros.map((r, i) => {
    const doc = docs[i];
    const selected = doc && escolhidos.some((e) =>
      e.documentId === doc.documentId && e.documentVersion === doc.documentVersion);
    const draft = drafts[i]!;
    return { draftId: r.id, expectedRevision: r.expectedRevision,
      eventId: sha(`${input.idempotencyKey}:${r.id}:${i}`), tipo: doc ? "DOCUMENTO" : "FATO",
      payload: selected ? { data: draft.payload,
        signature: { documentId: doc.documentId, documentVersion: doc.documentVersion,
          documentHash: hashes[i]!, declaredHash: doc.documentHash, reviewDecisionId, serverActorId: sessao.medicoId } }
        : draft.payload,
      fontes: [], revisao: selected ? "ASSINADO" as const : "CONFIRMADO" as const };
  });
  const result = confirmar(deps.db, { operationId: input.idempotencyKey,
    patientId: input.patientId, tumorLotId: input.tumorLotId, encounterId: input.encounterId,
    reviewDecisionId, sessao, em, registros });
  return { status: result.estado === "NEGADA" ? 409 : 200,
    body: { codigo: result.estado, resultRef: result.resultRef } };
}

export async function rotear(deps: ServidorDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rota = req.url === "/login" ? "login"
    : req.url === "/consulta/bundle" ? "bundle"
      : req.url === "/consulta/confirmar" ? "confirmar"
        : req.url === "/consulta/extrair" ? "extrair"
          : req.url === "/consulta/prescricao/rascunho" ? "rascunhoPrescricao"
          : req.url === "/consulta/rascunho" ? "rascunho"
            : req.url === "/consulta/rascunho/revisar" ? "revisarRascunho"
            : req.url === "/consulta/rascunho/preparar-revisao" ? "prepararRevisao"
            : req.url === "/consulta/rascunho/reconciliar" ? "reconciliarRascunhos"
            : req.url === "/consulta/contexto/selecionar" ? "selecionarContexto"
            : req.url === "/consulta/oncoassist/status" ? "oncoassistStatus"
            : req.url === "/consulta/oncoassist/classificar-fonte" ? "oncoassistClassificar"
            : req.url === "/consulta/oncoassist/fontes" ? "oncoassistFontes"
              : req.url === "/consulta/flash/rascunho" ? "rascunhoFlash"
              : req.url === "/consulta/flash/preparar" ? "prepararFlash"
              : req.url === "/consulta/instrumento/avaliar" ? "avaliarInstrumento"
              : req.url === "/consulta/carregar" ? "carregarConsulta"
                : req.url === "/consulta/agenda" ? "agenda"
                  : req.url === "/consulta/salao" ? "salao"
                    : req.url === "/consulta/canal" ? "canal"
                      : req.url === "/consulta/apac" ? "apac"
                        : req.url === "/consulta/chat" ? "chat"
                          : req.url === "/consulta/recist" ? "recist"
      : req.url === "/consulta/estatistica" ? "estatistica"
                            : req.url === "/conhecimento/consultar" ? "consultarConhecimento"
                          : req.url === "/config/perfil" ? "lerPerfil"
                            : req.url === "/config/perfil/salvar" ? "salvarPerfil"
                              : req.url === "/config/caixa/ler" ? "lerCaixa"
                                : req.url === "/config/caixa/alterar" ? "alterarCaixa"
            : req.url === "/config/historico" ? "historicoConfig"
                          : req.url === "/acao" ? "acao"
                            : req.url === "/consulta/salao/triagem" ? "salvarTriagemSalao"
                              : req.url === "/consulta/salao/liberar" ? "liberarSalao"
                                : req.url === "/consulta/canal/vincular" ? "vincularCanal" : "desconhecida";
  const reply = (status: number, codigo: string, result: unknown = { codigo }) => {
    deps.log({ rota, codigo, status }); send(res, status, result);
  };
  if (req.method !== "POST" || rota === "desconhecida") return reply(404, "ROTA_NAO_ENCONTRADA");
  try {
    if (rota === "login") {
      const parsed = z.object({ senha: z.string() }).strict().safeParse(await body(req));
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const login = deps.sessoes.login(parsed.data.senha);
      return login ? reply(200, "LOGIN_OK", { token: login.token, expiraEm: login.sessao.expiraEm })
        : reply(401, "LOGIN_NEGADO");
    }
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    const sessao = deps.sessoes.obter(token);
    if (!sessao) return reply(401, "SESSAO_INVALIDA");
    // A rota de efeito externo não aceita JSON sob um tipo de mídia diferente.
    // O gate de autenticação continua anterior a esta checagem.
    if (rota === "acao" && !contentTypeJson(req)) return reply(415, "CONTENT_TYPE_INVALIDO");
    const raw = await body(req);
    if (rota === "selecionarContexto") {
      const parsed = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      deps.sessoes.selecionarConsulta(token, null);
      if (!lerPaciente(deps.db, parsed.data.patientId)) return reply(404, "PACIENTE_NAO_ENCONTRADO");
      if (parsed.data.tumorLotId !== null
        && !lerLotes(deps.db, parsed.data.patientId).some((lote) => lote.tumorLotId === parsed.data.tumorLotId))
        return reply(409, "TUMOR_LOT_FORA_DO_PACIENTE");
      const hoje = dataCivilDoServico(deps.agora(), "-03:00");
      const dataCivilHoje = hoje.estado === "OK" ? hoje.dataCivil : null;
      const agendaAtiva = dataCivilHoje !== null
        && (deps.db.prepare("SELECT patientId,encounterId,payload FROM clinical_event WHERE tipo='AgendaEntry'").all() as Array<Record<string, unknown>>)
          .some((row) => {
            try {
              const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
              const value = outer.data && typeof outer.data === "object" ? outer.data as Record<string, unknown> : outer;
              return row.patientId === parsed.data.patientId && value.patientId === parsed.data.patientId
                && value.encounterId === parsed.data.encounterId && value.data === dataCivilHoje;
            } catch { return false; }
          });
      const permitido = lerTriagens(deps.db).some((item) => item.patientId === parsed.data.patientId
        && item.encounterId === parsed.data.encounterId)
        || !!deps.db.prepare("SELECT 1 AS ok FROM clinical_event WHERE patientId=? AND encounterId=? LIMIT 1")
          .get(parsed.data.patientId, parsed.data.encounterId) || agendaAtiva;
      if (!permitido) return reply(409, "ENCONTRO_FORA_DO_ESCOPO");
      deps.sessoes.selecionarConsulta(token, parsed.data);
      return reply(200, "CONTEXTO_SELECIONADO", { codigo: "CONTEXTO_SELECIONADO" });
    }
    if (rota === "salvarTriagemSalao") {
      const parsed = z.object({ triagem: Triagem, expectedRevision: z.number().int().nonnegative().nullable() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto || contexto.patientId !== parsed.data.triagem.patientId
        || contexto.encounterId !== parsed.data.triagem.encounterId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      if (!lerPaciente(deps.db, contexto.patientId)) return reply(404, "PACIENTE_NAO_ENCONTRADO");
      const draftId = `salao-triagem-${sha(JSON.stringify([contexto.patientId, contexto.encounterId])).slice(0, 36)}`;
      const existente = lerDraft(deps.db, draftId);
      const rawTriagem = parsed.data.triagem;
      const valores = { pas: rawTriagem.pas.valor, fc: rawTriagem.fc.valor, spo2: rawTriagem.spo2.valor,
        tempDecimos: rawTriagem.tempDecimos.valor, hbDgDl: rawTriagem.hbDgDl.valor, anc: rawTriagem.anc.valor,
        plq: rawTriagem.plq.valor, coletaHemograma: rawTriagem.coletaHemograma.valor,
        ecog: rawTriagem.ecog.valor, grauCtcae: rawTriagem.grauCtcae.valor,
        tontura: rawTriagem.tontura, vertigemHistoricoAnterior: rawTriagem.vertigemHistoricoAnterior ?? null,
        vertigemInicioNovo: rawTriagem.vertigemInicioNovo ?? null, recurso: rawTriagem.recurso, idadeAnos: rawTriagem.idadeAnos };
      const contentHash = hashConteudoExibido(valores);
      const mesmoConteudo = !!existente
        && (existente.payload as { contentHash?: string } | null)?.contentHash === contentHash;
      const retryDaMesmaGravacao = mesmoConteudo && (parsed.data.expectedRevision === null
        ? existente!.revision === 0 : existente!.revision === parsed.data.expectedRevision + 1);
      if (retryDaMesmaGravacao)
        return reply(200, "REPLAY", { ...lerSalao(deps.db, deps.agora(), deps.salaoRuleset), codigo: "REPLAY" });
      if ((existente?.revision ?? null) !== parsed.data.expectedRevision)
        return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
      const em = existente ? existente.criadoEm : deps.agora();
      const dataCaptura = dataCivilDoServico(em, "-03:00");
      const fonte: Fonte = { sourceId: `triagem-${sha(draftId).slice(0, 24)}`, classe: "MANUAL",
        localizador: "triagem presencial", dataClinica: dataCaptura.estado === "OK" ? dataCaptura.dataCivil : null,
        dataCaptura: deps.agora(),
        versao: "salao-triagem-v1", contentHash };
      const dado = <T>(valor: T | null, label: string) => valor === null
        ? { valor: null, estado: "PENDENTE" as const, campo: "AUSENTE" as const,
          motivo: `${label} ausente na triagem`, fontes: [], revisao: "RAW" as const }
        : { valor, estado: "PENDENTE" as const, campo: "PRESENTE" as const,
          motivo: `${label} informado em triagem; aguarda revisão`, fontes: [fonte], revisao: "REVISAR" as const };
      const triagem = { ...rawTriagem, chegadaEm: existente ? rawTriagem.chegadaEm : deps.agora(),
        pas: dado(rawTriagem.pas.valor, "pressão sistólica"), fc: dado(rawTriagem.fc.valor, "frequência cardíaca"),
        spo2: dado(rawTriagem.spo2.valor, "saturação"), tempDecimos: dado(rawTriagem.tempDecimos.valor, "temperatura"),
        hbDgDl: dado(rawTriagem.hbDgDl.valor, "hemoglobina"), anc: dado(rawTriagem.anc.valor, "neutrófilos"),
        plq: dado(rawTriagem.plq.valor, "plaquetas"), coletaHemograma: dado(rawTriagem.coletaHemograma.valor, "coleta do hemograma"),
        ecog: dado(rawTriagem.ecog.valor, "ECOG"), grauCtcae: dado(rawTriagem.grauCtcae.valor, "grau CTCAE") };
      const saved = salvarDraft(deps.db, { draftId, patientId: contexto.patientId, sourceId: fonte.sourceId,
        rawRef: `triagem-local:${contexto.encounterId}`, payload: { kind: "SALAO_TRIAGEM_RASCUNHO",
          contexto: { patientId: contexto.patientId, encounterId: contexto.encounterId, tumorLotId: null },
          status: "RASCUNHO", triagem, source: fonte, contentHash }, diagnostics: ["AGUARDA_DECISAO_MEDICA"],
        revision: (existente?.revision ?? -1) + 1, criadoEm: deps.agora() });
      return reply(200, "RASCUNHO_SALVO", { ...lerSalao(deps.db, deps.agora(), deps.salaoRuleset),
        codigo: "RASCUNHO_SALVO", rascunho: { draftId: saved.draftId, revision: saved.revision,
          criaEventoClinico: false } });
    }
    if (rota === "liberarSalao") {
      const parsed = z.object({ patientId: Id, encounterId: Id, expectedRevision: z.number().int().nonnegative(),
        motivo: z.string().trim().min(1).max(1000), idempotencyKey: z.string().min(8).max(120) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto || contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const draftId = `salao-triagem-${sha(JSON.stringify([contexto.patientId, contexto.encounterId])).slice(0, 36)}`;
      const draft = lerDraft(deps.db, draftId);
      if (!draft || draft.patientId !== contexto.patientId) return reply(409, "TRIAGEM_RASCUNHO_AUSENTE");
      const operationId = `salao-release-${parsed.data.idempotencyKey}`;
      const existing = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId) as { criadoEm?: string } | undefined;
      const priorDecision = (deps.db.prepare("SELECT payload FROM clinical_event WHERE tipo='ReviewDecision' AND patientId=? AND encounterId=?")
        .all(contexto.patientId, contexto.encounterId) as Array<{ payload: unknown }>).flatMap((row) => {
          try {
            const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
            const value = outer.data && typeof outer.data === "object" ? outer.data as Record<string, unknown> : outer;
            return value.campo === "liberacaoComCorteSalao" && value.triagemDraftId === draftId
              && typeof value.triagemRevision === "number" ? [value] : [];
          } catch { return []; }
        }).find((value) => typeof value.triagemRevision === "number"
          && value.triagemRevision + 1 === draft.revision);
      if (priorDecision) {
        if (priorDecision.motivo === parsed.data.motivo)
          return reply(200, "REPLAY", { ...lerSalao(deps.db, deps.agora(), deps.salaoRuleset), codigo: "REPLAY" });
        if (existing) return reply(409, "OPERATION_HASH_CONFLICT");
        return reply(409, "LIBERACAO_JA_REGISTRADA", { codigo: "LIBERACAO_JA_REGISTRADA", motivoPreservado: true });
      }
      if (draft.revision !== parsed.data.expectedRevision
        && !(existing && draft.revision === parsed.data.expectedRevision + 1))
        return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
      const projected = lerSalao(deps.db, deps.agora(), deps.salaoRuleset);
      const card = projected.cartoes.find((item) => item.entrada.patientId === contexto.patientId);
      if (!card?.temCorte) return reply(409, "CORTE_AUSENTE");
      const em = existing?.criadoEm ?? deps.agora();
      const payload = { campo: "liberacaoComCorteSalao", patientId: contexto.patientId,
        encounterId: contexto.encounterId, triagemDraftId: draft.draftId,
        triagemRevision: parsed.data.expectedRevision,
        triagemHash: (draft.payload as { contentHash?: string })?.contentHash ?? hashConteudoExibido(draft.payload),
        motivo: parsed.data.motivo };
      const result = confirmar(deps.db, { operationId, patientId: contexto.patientId,
        tumorLotId: null, encounterId: contexto.encounterId,
        reviewDecisionId: operationId, sessao, em, registros: [{ draftId: draft.draftId,
          expectedRevision: parsed.data.expectedRevision, eventId: `salao-release-event-${sha(operationId).slice(0, 32)}`,
          tipo: "ReviewDecision", payload, fontes: [], revisao: "CONFIRMADO" }] });
      if (result.estado === "NEGADA") return reply(409, result.motivo ?? "LIBERACAO_NEGADA");
      return reply(200, result.estado, { ...lerSalao(deps.db, deps.agora(), deps.salaoRuleset), codigo: result.estado });
    }
    if (rota === "vincularCanal") {
      const parsed = z.object({ contatoId: Id, patientId: Id, idempotencyKey: z.string().min(8).max(120) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto || contexto.patientId !== parsed.data.patientId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      if (!lerPaciente(deps.db, parsed.data.patientId)) return reply(404, "PACIENTE_NAO_ENCONTRADO");
      const caixa = lerCanal(deps.db);
      const mensagens = caixa.mensagens.filter((item) => item.contatoId === parsed.data.contatoId);
      if (!mensagens.length) return reply(409, "MENSAGEM_CONTATO_NAO_ENCONTRADA");
      if (mensagens.some((item) => item.patientId && item.patientId !== parsed.data.patientId))
        return reply(409, "CONFLITO_VINCULO_CONTATO");
      const contatoRows = deps.db.prepare("SELECT eventId,payload FROM clinical_event WHERE tipo='Contato'")
        .all() as Array<{ eventId: string; payload: unknown }>;
      const contatos = contatoRows.flatMap((row) => {
        try {
          const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
          const value = Contato.safeParse(outer.data ?? outer);
          return value.success && value.data.contatoId === parsed.data.contatoId
            ? [{ eventId: row.eventId, value: value.data }] : [];
        } catch { return []; }
      });
      if (!contatos.length) return reply(404, "CONTATO_NAO_ENCONTRADO");
      if (contatos.some((item) => item.value.revogadoEm !== null)) return reply(409, "CONTATO_REVOGADO");
      if (contatos.length !== 1) return reply(409, "CONTATO_DIVERGENTE");
      const contatoOriginal = contatos[0]!;
      if (contatoOriginal.value.patientId !== null && contatoOriginal.value.patientId !== parsed.data.patientId)
        return reply(409, "CONFLITO_VINCULO_CONTATO");
      const decisions = (deps.db.prepare("SELECT eventId,patientId,encounterId,tumorLotId,payload FROM clinical_event WHERE tipo='ReviewDecision'")
        .all() as Array<Record<string, unknown>>).flatMap((row) => {
        try {
          const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
          const value = outer.data && typeof outer.data === "object" ? outer.data as Record<string, unknown> : outer;
          return value.kind === "VinculoContato" && value.contatoId === parsed.data.contatoId
            && value.sourceEventId === contatoOriginal.eventId && typeof value.patientId === "string"
            ? [{ patientId: value.patientId, encounterId: row.encounterId, tumorLotId: row.tumorLotId ?? null }] : [];
        } catch { return []; }
      });
      const priorTargets = [...new Set(decisions.map((item) => item.patientId))];
      if (priorTargets.length > 1 || (priorTargets.length === 1 && priorTargets[0] !== parsed.data.patientId))
        return reply(409, "CONFLITO_VINCULO_CONTATO", { codigo: "CONFLITO_VINCULO_CONTATO",
          candidatos: priorTargets, preservado: true });
      if (decisions.some((item) => item.patientId === parsed.data.patientId
        && item.encounterId === contexto.encounterId && item.tumorLotId === (contexto.tumorLotId ?? null)))
        return reply(200, "REPLAY", { ...caixa, codigo: "REPLAY" });
      const operationId = `canal-link-${parsed.data.idempotencyKey}`;
      const existing = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId) as { criadoEm?: string } | undefined;
      const em = existing?.criadoEm ?? deps.agora();
      const eventRows = deps.db.prepare("SELECT * FROM clinical_event WHERE tipo='CanalMessage'")
        .all() as Array<Record<string, unknown>>;
      const fontes = eventRows.flatMap((row) => {
        try {
          const outer = JSON.parse(String(row.payload)) as Record<string, unknown>;
          const value = (outer.data && typeof outer.data === "object" ? outer.data : outer) as Record<string, unknown>;
          if (value.contatoId !== parsed.data.contatoId || typeof value.mensagemId !== "string") return [];
          const text = typeof value.texto === "string" ? value.texto : "";
          return [{ sourceId: value.mensagemId, classe: "CHAT_TEXT" as const, localizador: null,
            dataClinica: null, dataCaptura: em, versao: "canal-link-v1", contentHash: hashConteudoExibido(text) }];
        } catch { return []; }
      });
      fontes.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
      if (!fontes.length) return reply(409, "MENSAGEM_FORA_DO_ESCOPO");
      const payload = ClosureVinculoContato.parse({ kind: "VinculoContato", contatoId: parsed.data.contatoId,
        sourceEventId: contatoOriginal.eventId, patientId: parsed.data.patientId, encounterId: contexto.encounterId,
        tumorLotId: contexto.tumorLotId ?? null });
      const draftId = `canal-link-draft-${sha(operationId).slice(0, 32)}`;
      const current = lerDraft(deps.db, draftId);
      if (current && (current.patientId !== parsed.data.patientId || JSON.stringify(current.payload) !== JSON.stringify(payload)))
        return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
      if (!current) salvarDraft(deps.db, { draftId, patientId: parsed.data.patientId,
        sourceId: fontes[0]!.sourceId, rawRef: `canal-link:${parsed.data.contatoId}`, payload,
        diagnostics: ["VINCULO_EXPLICITO_PENDENTE"], revision: 0, criadoEm: em });
      const result = confirmar(deps.db, { operationId, patientId: parsed.data.patientId,
        tumorLotId: contexto.tumorLotId ?? null, encounterId: contexto.encounterId,
        reviewDecisionId: operationId, sessao, em, registros: [{ draftId, expectedRevision: 0,
          eventId: `canal-link-event-${sha(operationId).slice(0, 32)}`, tipo: "ReviewDecision", payload,
          fontes, revisao: "CONFIRMADO" }] });
      if (result.estado === "NEGADA") return reply(409, result.motivo ?? "VINCULO_CANAL_NEGADO");
      return reply(200, result.estado, { ...lerCanal(deps.db), codigo: result.estado });
    }
    if (rota === "oncoassistStatus") {
      if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
      const service = deps.oncoassistJev ?? criarOncoassistJev();
      return reply(200, "ONCOASSIST_STATUS", service.status());
    }
    if (rota === "reconciliarRascunhos") {
      const parsed = z.object({ draftIds: z.array(Id).min(2).max(12) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      if (new Set(parsed.data.draftIds).size !== parsed.data.draftIds.length)
        return reply(400, "DRAFT_DUPLICADO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");

      type FonteValidada = { draftId: string; sourceId: string; recordingId: string; segmentId: string;
        dataClinica: string; source: ExtractionInput; factIds: string[] };
      const fontesValidadas: FonteValidada[] = [];
      const confirmacoes: ReturnType<typeof ReviewAction.parse>[] = [];
      const eventosPersistidos = listarEventos(deps.db, contexto.patientId);
      for (const draftId of parsed.data.draftIds) {
        const draft = lerDraft(deps.db, draftId);
        if (!draft || draft.patientId !== contexto.patientId)
          return reply(409, "FONTE_FORA_DO_ESCOPO", { codigo: "FONTE_FORA_DO_ESCOPO", draftId });
        const payload = draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
          ? draft.payload as Record<string, unknown> : null;
        const input = payload?.input && typeof payload.input === "object" && !Array.isArray(payload.input)
          ? payload.input as Record<string, unknown> : null;
        const link = payload?.patientLinkReview && typeof payload.patientLinkReview === "object"
          ? payload.patientLinkReview as Record<string, unknown> : null;
        if (payload?.kind !== "EXTRACAO_RASCUNHO" || !input || !link
          || typeof input.recordingId !== "string" || typeof input.sourceId !== "string"
          || typeof input.sourceType !== "string" || typeof input.rawTranscript !== "string"
          || typeof link.segmentId !== "string" || typeof link.exceptionId !== "string"
          || typeof link.reviewDecisionId !== "string" || typeof link.sourceHash !== "string")
          return reply(409, "VINCULO_OU_FONTE_PENDENTE", { codigo: "VINCULO_OU_FONTE_PENDENTE", draftId });
        if (link.patientId !== contexto.patientId || link.encounterId !== contexto.encounterId
          || (link.tumorLotId ?? null) !== (contexto.tumorLotId ?? null)
          || input.sourceId !== draft.sourceId)
          return reply(409, "CONTEXTO_CONSULTA_ALTERADO", { codigo: "CONTEXTO_CONSULTA_ALTERADO", draftId });
        const sourceType = FactSourceType.safeParse(input.sourceType);
        const state = payload.state && typeof payload.state === "object" && !Array.isArray(payload.state)
          ? payload.state as Record<string, unknown> : null;
        if (!sourceType.success || !state || !Array.isArray(state.segments) || !Array.isArray(state.facts)
          || !Array.isArray(state.confirmationRequired))
          return reply(409, "FONTE_PENDENTE", { codigo: "FONTE_PENDENTE", draftId });
        const segments = state.segments.map((value) => EncounterSegment.safeParse(value));
        const facts = state.facts.map((value) => ClinicalFactContract.safeParse(value));
        const exceptions = state.confirmationRequired.map((value) => ReviewException.safeParse(value));
        if (segments.some((item) => !item.success) || facts.some((item) => !item.success)
          || exceptions.some((item) => !item.success))
          return reply(409, "FONTE_PENDENTE", { codigo: "FONTE_PENDENTE", draftId });
        const segment = segments.find((item) => item.success && item.data.id === link.segmentId)?.data;
        if (!segment || segment.sourceId !== input.sourceId || segment.recordingId !== input.recordingId
          || segment.sourceType !== sourceType.data)
          return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA", { codigo: "SEGMENTO_VINCULADO_NAO_CONSTA", draftId });
        const exception = exceptions.find((item) => item.success && item.data.id === link.exceptionId)?.data;
        if (!exception || exception.kind !== "UNLINKED_PATIENT" || exception.segmentId !== segment.id
          || !exception.sourceIds.includes(input.sourceId))
          return reply(409, "EXCECAO_VINCULO_NAO_ENCONTRADA", { codigo: "EXCECAO_VINCULO_NAO_ENCONTRADA", draftId });

        const sourcePayload = { ...payload };
        delete sourcePayload.patientLinkReview;
        const sourceHash = hashConteudoExibido(sourcePayload);
        if (sourceHash !== link.sourceHash) return reply(409, "FONTE_ALTERADA", { codigo: "FONTE_ALTERADA", draftId });
        const linkReview = eventosPersistidos.filter((event) => event.tipo === "ReviewDecision"
          && event.operationId === link.reviewDecisionId && event.patientId === contexto.patientId
          && event.encounterId === contexto.encounterId && event.tumorLotId === (contexto.tumorLotId ?? null));
        if (linkReview.length !== 1) return reply(409, "DECISAO_VINCULO_NAO_PERSISTIDA", { codigo: "DECISAO_VINCULO_NAO_PERSISTIDA", draftId });
        const event = linkReview[0]!;
        const envelope = event.payload && typeof event.payload === "object"
          ? event.payload as Record<string, unknown> : null;
        const decision = envelope?.data && typeof envelope.data === "object"
          ? envelope.data as Record<string, unknown> : null;
        const actor = event.criadoPor;
        const ref = decision?.source && typeof decision.source === "object"
          ? decision.source as Record<string, unknown> : null;
        const action = ReviewAction.safeParse({ exceptionId: decision?.exceptionId,
          acao: decision?.acao, medicoId: actor.id, em: event.criadoEm, patientId: decision?.patientId });
        if (actor.tipo !== "SESSAO" || actor.id !== sessao.medicoId || !action.success
          || action.data.acao !== "LIGAR_PACIENTE" || action.data.patientId !== contexto.patientId
          || decision?.campo !== "patientLink" || decision.segmentId !== segment.id
          || decision.exceptionId !== link.exceptionId || ref?.draftId !== draft.draftId
          || ref.sourceId !== input.sourceId || ref.revision !== draft.revision - 1
          || ref.contentHash !== link.sourceHash)
          return reply(409, "DECISAO_VINCULO_NAO_PERSISTIDA", { codigo: "DECISAO_VINCULO_NAO_PERSISTIDA", draftId });

        const factsForSegment = facts.flatMap((item) => item.success && item.data.segmentId === segment.id ? [item.data] : []);
        const dominiosTratamento = new Set(["plan", "drug", "regimen", "cycle"]);
        const fatosDeTratamento = factsForSegment.filter((fact) => dominiosTratamento.has(fact.domain));
        // A laboratory date can anchor that result, but it cannot timestamp an
        // undated plan or prescription for cross-source treatment comparison.
        if (fatosDeTratamento.length && fatosDeTratamento.some((fact) => fact.date === undefined))
          return reply(409, "DATA_CLINICA_PENDENTE", { codigo: "DATA_CLINICA_PENDENTE", draftId });
        const dateFacts = (fatosDeTratamento.length ? fatosDeTratamento : factsForSegment)
          .filter((fact) => fact.date !== undefined);
        const clinicalDates = dateFacts.map((fact) => {
          if (!fact.date) return null;
          const normalized = normalizarDataCivil(fact.date);
          if (!normalized || !fatoSustentaDataClinica(fact, normalized)) return null;
          return normalized;
        });
        const validDates = [...new Set(clinicalDates.filter((value): value is string => value !== null))];
        if (!dateFacts.length || validDates.length !== 1 || clinicalDates.some((value) => value === null))
          return reply(409, "DATA_CLINICA_PENDENTE", { codigo: "DATA_CLINICA_PENDENTE", draftId });
        const page = Number.isInteger(input.page) ? input.page as number : undefined;
        fontesValidadas.push({ draftId, sourceId: input.sourceId, recordingId: input.recordingId,
          segmentId: segment.id, dataClinica: validDates[0]!, factIds: factsForSegment.map((fact) => fact.id),
          source: { recordingId: input.recordingId, sourceId: input.sourceId, sourceType: sourceType.data,
            rawTranscript: input.rawTranscript, contexto: { encounterId: contexto.encounterId, dataClinica: validDates[0]! },
            ...(page === undefined ? {} : { page }) } });
        confirmacoes.push(action.data);
      }
      if (new Set(fontesValidadas.map((item) => item.recordingId)).size !== fontesValidadas.length)
        return reply(409, "RECORDING_ID_COLLISION", { codigo: "RECORDING_ID_COLLISION", draftIds: parsed.data.draftIds });
      const datasClinicas = [...new Set(fontesValidadas.map((item) => item.dataClinica))];
      if (datasClinicas.length !== 1)
        return reply(409, "DATAS_CLINICAS_DIVERGENTES", { codigo: "DATAS_CLINICAS_DIVERGENTES", draftIds: parsed.data.draftIds });
      const [principal, ...adicionais] = fontesValidadas.map((item) => item.source);
      if (!principal) return reply(409, "FONTES_INSUFICIENTES");
      let resultado: ReturnType<typeof executarPipelineExtracao>;
      try {
        const inputPipeline: ExtractionInput = { ...principal, additionalSources: adicionais, confirmacoes };
        resultado = executarPipelineExtracao(inputPipeline);
      } catch (error) {
        const codigo = error instanceof Error && /recordingId distintos/i.test(error.message)
          ? "RECORDING_ID_COLLISION" : "RECONCILIACAO_PENDENTE";
        return reply(409, codigo, { codigo, draftIds: parsed.data.draftIds });
      }
      const targetSegments = new Set(fontesValidadas.map((item) => item.segmentId));
      if (fontesValidadas.some((item) => !resultado.segments.some((segment) => segment.id === item.segmentId)))
        return reply(409, "SEGMENTO_VINCULADO_NAO_REPRODUZIDO", { codigo: "SEGMENTO_VINCULADO_NAO_REPRODUZIDO" });
      const targetFacts = resultado.facts.filter((fact) => targetSegments.has(fact.segmentId));
      const targetFactIds = new Set(targetFacts.map((fact) => fact.id));
      const conflitoEscopoSeguro = (item: { factIds: readonly string[]; segmentId: string | null }) =>
        (item.segmentId === null ? item.factIds.length > 0 : targetSegments.has(item.segmentId))
        && item.factIds.every((id) => targetFactIds.has(id));
      const repeticoes = resultado.deduplicacao.repeticoes.filter((item) =>
        [...item.fatoPrincipalIds, ...item.fatoRepetidoIds].every((id) => targetFactIds.has(id)));
      const versoesDiscordantes = resultado.deduplicacao.versoesDiscordantes.filter((item) =>
        item.factIds.every((id) => targetFactIds.has(id)));
      // Só neste ponto todos os segmentos foram vinculados por decisões persistidas
      // ao mesmo paciente/encontro/data. O pipeline puro mantém fontes isoladas;
      // esta borda autorizada pode confrontá-las sem confirmar nenhum fato.
      const campos: ReturnType<typeof reconciliarCampos> = Object.fromEntries(Object.entries(reconciliarCampos(targetFacts)).map(([chave, campo]) =>
        [chave, campo.conflict ? { ...campo, resolvedFactId: null } : campo]));
      const conflitosCampos = Object.entries(campos).filter(([, campo]) => campo.conflict)
        .map(([chave, campo]) => ({
          id: `exc:CONFLICT:multifonte:${sha(JSON.stringify([contexto, chave,
            campo.candidates.map((fato) => fato.id).sort()])).slice(0, 32)}`,
          kind: "CONFLICT" as const, segmentId: null,
          factIds: campo.candidates.map((fato) => fato.id),
          sourceIds: [...new Set(campo.candidates.map((fato) => fato.sourceId))],
          reason: `${chave}: fontes vinculadas divergem; decisão médica pendente, nenhum candidato eleito`,
        }));
      return reply(200, "RECONCILIACAO_PROPOSTA", {
        codigo: "RECONCILIACAO_PROPOSTA", decisaoClinicaTomada: false,
        contexto: { patientId: contexto.patientId, encounterId: contexto.encounterId,
          tumorLotId: contexto.tumorLotId ?? null, dataClinica: datasClinicas[0] },
        fontes: fontesValidadas.map(({ draftId, sourceId, recordingId, segmentId, dataClinica }) =>
          ({ draftId, sourceId, recordingId, segmentId, dataClinica })),
        segmentos: resultado.segments.filter((segment) => targetSegments.has(segment.id)),
        fatos: targetFacts, campos,
        conflitos: [...resultado.conflitos.filter(conflitoEscopoSeguro), ...conflitosCampos],
        excecoes: [...resultado.confirmationRequired.filter(conflitoEscopoSeguro), ...conflitosCampos],
        deduplicacao: { repeticoes, versoesDiscordantes,
          fatoRepetidoIds: resultado.deduplicacao.fatoRepetidoIds.filter((id) => targetFactIds.has(id)) },
        timelines: resultado.timelines.filter((timeline) => timeline.patientId === contexto.patientId),
      });
    }
    if (rota === "oncoassistClassificar" || rota === "oncoassistFontes") {
      const parsed = z.object({ draftId: Id.optional(), patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict()
        .refine((value) => rota === "oncoassistClassificar" ? !!value.draftId : value.draftId === undefined)
        .safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
        || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const escopoFonte = (value: unknown) => z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
        patientLinkReview: z.object({ patientId: z.literal(contexto.patientId),
          encounterId: z.literal(contexto.encounterId), tumorLotId: z.literal(contexto.tumorLotId ?? null),
          segmentId: Id }) })
        .safeParse(value).success;
      if (rota === "oncoassistFontes") {
        const fontes = listarDrafts(deps.db, contexto.patientId).filter((draft) => escopoFonte(draft.payload))
          .map((draft, index) => ({ draftId: draft.draftId, rotulo: `Fonte local ${index + 1}`, criadoEm: draft.criadoEm }));
        const fontesSemVinculo = listarDrafts(deps.db).flatMap((draft, index) => {
          if (draft.patientId !== null || !draft.payload || typeof draft.payload !== "object") return [];
          const value = draft.payload as Record<string, unknown>;
          const input = value.input && typeof value.input === "object" ? value.input as Record<string, unknown> : null;
          if (value.kind !== "EXTRACAO_RASCUNHO" || !input || typeof input.sourceId !== "string"
            || typeof input.rawTranscript !== "string") return [];
          const state = value.state && typeof value.state === "object" ? value.state as Record<string, unknown> : null;
          const exceptions = Array.isArray(state?.confirmationRequired) ? state.confirmationRequired : [];
          const exceptionId = exceptions.find((item) => item && typeof item === "object"
            && (item as Record<string, unknown>).kind === "UNLINKED_PATIENT"
            && Array.isArray((item as Record<string, unknown>).sourceIds)
            && ((item as Record<string, unknown>).sourceIds as unknown[]).includes(input.sourceId));
          const segmentId = exceptionId && typeof exceptionId === "object"
            && typeof (exceptionId as Record<string, unknown>).segmentId === "string"
              ? (exceptionId as Record<string, unknown>).segmentId as string : null;
          const segments = Array.isArray(state?.segments) ? state.segments : [];
          const segment = segmentId ? segments.find((candidate) => candidate && typeof candidate === "object"
            && (candidate as Record<string, unknown>).id === segmentId
            && (candidate as Record<string, unknown>).sourceId === input.sourceId) as Record<string, unknown> | undefined : undefined;
          return [{ draftId: draft.draftId, sourceId: input.sourceId, rotulo: `Trecho sem vínculo ${index + 1}`,
            exceptionId: exceptionId && typeof exceptionId === "object"
              && typeof (exceptionId as Record<string, unknown>).id === "string"
                ? (exceptionId as Record<string, unknown>).id as string : null,
            segmentId, criadoEm: draft.criadoEm, revision: draft.revision,
            textoOriginal: typeof segment?.rawTranscript === "string" ? segment.rawTranscript : "" }];
        });
        return reply(200, "ONCOASSIST_FONTES", { fontes, fontesSemVinculo });
      }
      const draft = lerDraft(deps.db, parsed.data.draftId!);
      if (!draft || draft.patientId !== contexto.patientId) return reply(409, "DRAFT_FORA_DO_ESCOPO");
      if (!escopoFonte(draft.payload)) return reply(409, "DRAFT_FORA_DO_ESCOPO");
      const payload = z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
        input: z.object({ sourceId: z.string().min(1), rawTranscript: z.string().min(1) }),
        patientLinkReview: z.object({ patientId: Id, segmentId: Id }) }).safeParse(draft.payload);
      if (!payload.success || payload.data.patientLinkReview.patientId !== contexto.patientId)
        return reply(409, "VINCULO_PACIENTE_NAO_CONFIRMADO");
      const draftPayload = draft.payload as Record<string, unknown>;
      const draftState = draftPayload.state && typeof draftPayload.state === "object"
        ? draftPayload.state as Record<string, unknown> : null;
      const sourceSegment = Array.isArray(draftState?.segments) ? draftState.segments.find((item) => item
        && typeof item === "object" && (item as Record<string, unknown>).id === payload.data.patientLinkReview.segmentId
        && typeof (item as Record<string, unknown>).rawTranscript === "string") as Record<string, unknown> | undefined : undefined;
      if (!sourceSegment) return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
      const paciente = lerPaciente(deps.db, contexto.patientId);
      if (!paciente) return reply(409, "PACIENTE_DESTINO_NAO_ENCONTRADO");
      const controller = new AbortController();
      const desconectado = () => controller.abort();
      res.once("close", desconectado);
      try {
        const service = deps.oncoassistJev ?? criarOncoassistJev();
        const result = await service.avaliar({ fonte: { id: payload.data.input.sourceId,
          texto: sourceSegment.rawTranscript as string } }, { dicionario: {
          nomes: [paciente.nome], identificadores: [paciente.patientId, sessao.medicoId, sessao.crm,
            ...paciente.identificadores.map((item) => item.valor), ...(paciente.nascimento ? [paciente.nascimento] : [])],
        } }, controller.signal);
        if (!deps.sessoes.obter(token)) return reply(401, "SESSAO_INVALIDA");
        const atual = deps.sessoes.consultaSelecionada(token);
        const draftAtual = lerDraft(deps.db, draft.draftId);
        if (!atual || atual.patientId !== contexto.patientId || atual.encounterId !== contexto.encounterId
          || (atual.tumorLotId ?? null) !== (contexto.tumorLotId ?? null))
          return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
        if (!draftAtual || draftAtual.patientId !== draft.patientId || draftAtual.revision !== draft.revision
          || hashConteudoExibido(draftAtual.payload) !== hashConteudoExibido(draft.payload))
          return reply(409, "FONTE_ALTERADA");
        return reply(200, "ONCOASSIST_RESULTADO", result);
      } finally { res.off("close", desconectado); }
    }
    if (rota === "consultarConhecimento") {
      const parsed = z.object({ query: z.string().min(1).max(240), tipos: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(), proveniencia: z.object({ modulo: z.string().optional(), aula: z.string().optional() })
          .strict().optional(), topK: z.number().int().positive().max(100).optional() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "CONSULTA_INVALIDA");
      const proveniencia = parsed.data.proveniencia === undefined ? undefined : {
        ...(parsed.data.proveniencia.modulo === undefined ? {} : { modulo: parsed.data.proveniencia.modulo }),
        ...(parsed.data.proveniencia.aula === undefined ? {} : { aula: parsed.data.proveniencia.aula }),
      };
      const consulta = { query: parsed.data.query,
        ...(parsed.data.tipos === undefined ? {} : { tipos: parsed.data.tipos }),
        ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
        ...(proveniencia === undefined ? {} : { proveniencia }),
        ...(parsed.data.topK === undefined ? {} : { topK: parsed.data.topK }) };
      const result = await consultarGrafoLocal(consulta);
      return reply(result.status === "OK" ? 200 : 409,
        result.status === "OK" ? "REFERENCIAS_CARREGADAS" : result.codigo, result);
    }
    if (rota === "recist") {
      const parsed = z.object({ patientId: Id }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerRecist(deps.db, parsed.data.patientId);
      return reply(result.estado === "PENDENTE" ? 404 : 200,
        "codigo" in result ? result.codigo : "RECIST_PROPOSTO", result);
    }
    if (rota === "estatistica") {
      const parsed = z.object({ periodoClinico: z.object({ inicio: DataCivil, fim: DataCivil }).strict()
        .refine((value) => value.inicio <= value.fim).optional() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      return reply(200, "ESTATISTICA_DERIVADA", projetarEstatisticaLedger(deps.db,
        parsed.data.periodoClinico ? { periodoClinico: parsed.data.periodoClinico } : undefined));
    }
    if (rota === "avaliarInstrumento") {
      const parsed=z.object({patientId:Id,encounterId:Id,tumorLotId:Id.nullable(),pedido:AvaliacaoInstrumentoRequest}).strict().safeParse(raw);
      if(!parsed.success)return reply(400,"PAYLOAD_INVALIDO");
      const atual=deps.sessoes.consultaSelecionada(token);
      if(!atual || atual.patientId!==parsed.data.patientId || atual.encounterId!==parsed.data.encounterId
        || (atual.tumorLotId ?? null)!==parsed.data.tumorLotId)return reply(409,"CONTEXTO_CONSULTA_ALTERADO");
      const regras=deps.corpus?.instrumentos.filter(r=>r.id===parsed.data.pedido.instrumento) ?? [];
      const resultado=avaliarInstrumentoEstruturado(parsed.data.pedido,regras.length===1 ? regras[0]! : null);
      return reply(200,"INSTRUMENTO_CALCULADO",{resultado,gravado:false,assinado:false});
    }
    if (rota === "rascunhoPrescricao") {
      const parsed = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable(),
        templateId: z.string().min(1).optional(), expression: z.string().min(1).max(5000).optional() })
        .strict().refine((x) => Number(!!x.templateId) + Number(!!x.expression) === 1).safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
        || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const hoje = dataCivilDoServico(deps.agora(), "-03:00");
      if (parsed.data.templateId) {
        const template = deps.corpus?.templatesProtocolo.find((t) => t.templateId === parsed.data.templateId);
        if (!template) return reply(404, "TEMPLATE_NAO_ENCONTRADO");
        const consultaCorporal=lerConsulta(deps.db,contexto.patientId,deps.agora(),sessao,contexto.tumorLotId);
        const dadosCorporais="codigo" in consultaCorporal
          ? { pesoKg:null,alturaCm:null,bsaM2:null,clcr:null,medidoEm:null }
          : consultaCorporal.avaliacaoClinica.dadosCorporais;
        const instanciacao = hoje.estado === "OK"
          ? instanciarProtocolo(template, dadosCorporais)
          : { ok: false as const, recusa: { codigo: "DADOS_CORPORAIS_PENDENTES", motivo: hoje.codigo } };
        const itens = instanciacao.ok ? instanciacao.itens.map((item) => item.item) : [];
        const seguranca = { resultado: "NOT_EVALUABLE" as const,
          motivos: [{ codigo: "REQUISITOS_DE_SEGURANCA_NAO_DISPONIVEIS",
            texto: "requisitos de segurança e medidas de paciente ainda não foram validados para esta ficha",
            fonte: template.fonte }] };
        const saved = salvarDraft(deps.db, { draftId: randomUUID(), patientId: contexto.patientId,
          sourceId: "selecao-local-de-prescricao", rawRef: "proposta-prescricao-local",
          payload: { kind: "PRESCRICAO_RASCUNHO", contexto, template, instanciacao, seguranca,
            status: "RASCUNHO", assinada: false },
          diagnostics: [template.status === "RASCUNHO" ? "TEMPLATE_NAO_CONFERIDO" : "REVISAO_MEDICA_OBRIGATORIA",
            "SEGURANCA_NAO_AVALIAVEL"],
          revision: 0, criadoEm: deps.agora() });
        return reply(201, "PRESCRICAO_RASCUNHO_SALVA", { draftId: saved.draftId,
          instanciacao, classificacao: template.itens.map((item) => classificarDocumento(item.drug, deps.corpus?.regulatorio ?? null)),
          seguranca, assina: false, exporta: false });
      }
      const quickLine = parserLinha(parsed.data.expression!);
      const classificacao = classificarDocumento(quickLine.parsed.drug ?? "", deps.corpus?.regulatorio ?? null);
      let configuracaoReceituario=lerConfiguracaoServico(null);
      try { configuracaoReceituario=lerConfiguracaoServico(deps.settings?.readBox(NUMERO_CAIXA_RECEITUARIO_ESPECIAL,sessao).value); }
      catch { /* Recurso do serviço não comprovado: permanece falso. */ }
      const receituario=rotearItemReceita({id:"linha-manual",medicamento:quickLine.parsed.drug ?? ""},
        configuracaoReceituario,deps.corpus?.controlados ?? []);
      const seguranca = { resultado: "NOT_EVALUABLE" as const,
        motivos: [{ codigo: "SEM_ITEM_E_REQUISITO_TIPADO",
          texto: "linha em rascunho sem item validado e sem requisitos de segurança declarados",
          fonte: "prescricao local: fonte/manual" }] };
      const saved = salvarDraft(deps.db, { draftId: randomUUID(), patientId: contexto.patientId,
        sourceId: "linha-manual-de-prescricao", rawRef: "proposta-prescricao-local",
        payload: { kind: "PRESCRICAO_RASCUNHO", contexto, quickLine, classificacao, seguranca,receituario,
          status: "RASCUNHO", assinada: false },
        diagnostics: [...quickLine.pendencias, ...(classificacao.estado === "PENDENTE" ? ["CLASSIFICACAO_DOCUMENTAL_PENDENTE"] : []),
          "SEGURANCA_NAO_AVALIAVEL", "REVISAO_MEDICA_OBRIGATORIA"], revision: 0, criadoEm: deps.agora() });
      return reply(201, "PRESCRICAO_RASCUNHO_SALVA", { draftId: saved.draftId, quickLine,
        classificacao, seguranca, receituario, assina: false, exporta: false });
    }
    if (["lerPerfil", "salvarPerfil", "lerCaixa", "alterarCaixa", "historicoConfig"].includes(rota)) {
      if (!deps.settings) return reply(503, "CONFIGURACAO_INDISPONIVEL");
      if (rota === "lerPerfil") {
        if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
        return reply(200, "PERFIL_CARREGADO", deps.settings.readProfile(sessao));
      }
      if (rota === "salvarPerfil") {
        const parsed = z.object({ operationId: z.string().min(8), expectedRevision: z.number().int().nonnegative(),
          perfil: z.unknown(), motivo: z.string().max(1000).nullable().optional() }).strict().safeParse(raw);
        if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
        const result = deps.settings.saveProfile({ ...parsed.data, motivo: parsed.data.motivo ?? null }, sessao);
        return reply(result.estado === "CONFLITO" || result.estado === "NEGADA" ? 409 : 200, result.estado, result);
      }
      if (rota === "lerCaixa") {
        const parsed = z.object({ numero: z.number().int().positive() }).strict().safeParse(raw);
        if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
        const catalog = deps.corpus?.caixasTodas.find((box) => box.numero === parsed.data.numero);
        if (!catalog) return reply(404, "CAIXA_DESCONHECIDA");
        if (catalog.chave.startsWith("apac.")) return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
        if (!catalog.chave.startsWith("config.")) return reply(409, "CAIXA_FORA_DA_CONFIGURACAO_GLOBAL");
        return reply(200, "CAIXA_CARREGADA", deps.settings.readBox(parsed.data.numero, sessao));
      }
      if (rota === "alterarCaixa") {
        const parsed = z.object({ numero: z.number().int().positive(), valorNovo: z.unknown(),
          expectedRevision: z.number().int().nonnegative(), operationId: z.string().min(8),
          motivo: z.string().max(1000).nullable().optional() }).strict().safeParse(raw);
        if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
        const catalog = deps.corpus?.caixasTodas.find((box) => box.numero === parsed.data.numero);
        if (!catalog) return reply(404, "CAIXA_DESCONHECIDA");
        if (catalog.chave.startsWith("apac.")) return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
        if (!catalog.chave.startsWith("config.")) return reply(409, "CAIXA_FORA_DA_CONFIGURACAO_GLOBAL");
        const result = deps.settings.changeBox({ ...parsed.data, motivo: parsed.data.motivo ?? null,
          autorizacaoMedica: true }, sessao);
        return reply(result.estado === "CONFLITO" || result.estado === "NEGADA" ? 409 : 200, result.estado, result);
      }
      if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
      return reply(200, "HISTORICO_CARREGADO", { itens: deps.settings.readHistory(sessao) });
    }
    if (rota === "carregarConsulta") {
      const parsed = z.object({ patientId: Id, tumorLotId: Id.nullable().optional() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao, parsed.data.tumorLotId,
        opcoesLeituraConsulta(deps, sessao));
      if (!("codigo" in result)) deps.sessoes.selecionarConsulta(token, {
        patientId: result.patientId, encounterId: result.encounterId, tumorLotId: result.tumorLotId,
      });
      else deps.sessoes.selecionarConsulta(token, null);
      return reply("codigo" in result ? 404 : 200, "codigo" in result ? result.codigo : "CONSULTA_CARREGADA", result);
    }
    if (rota === "rascunhoFlash" || rota === "prepararFlash") {
      const base = { patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), plano: PlanoFlashEntrada };
      const parsed = rota === "rascunhoFlash"
        ? z.object({ ...base, expectedRevision: z.number().int().nonnegative().nullable() }).strict().safeParse(raw)
        : z.object({ ...base, idempotencyKey: z.string().min(8) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
        || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const consultaRevisada = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao, parsed.data.tumorLotId,
        opcoesLeituraConsulta(deps, sessao));
      if ("codigo" in consultaRevisada) return reply(409, consultaRevisada.codigo);
      const resumoClinico = consultaRevisada.resumoConfirmadoParaDocumento;
      const result = "expectedRevision" in parsed.data
        ? salvarRascunhoFlash(deps.db, deps.agora(), parsed.data)
        : prepararFinalizacaoFlash(deps.db, deps.agora(), parsed.data, resumoClinico,
          consultaRevisada.cabecalho.episodio && consultaRevisada.cabecalho.ciclo
            ? { protocolo: consultaRevisada.cabecalho.episodio.esquemaId,
              ciclo: consultaRevisada.cabecalho.ciclo.numero,
              ciclosPrevistos: consultaRevisada.flash.ciclosPrevistos ?? null } : null);
      return reply(result.status, String(result.body.codigo), result.body);
    }
    if (rota === "agenda") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerAgenda(deps.db, deps.agora());
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_AGENDA_AUSENTE" : "AGENDA_CARREGADA", result);
    }
    if (rota === "salao") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerSalao(deps.db, deps.agora(), deps.salaoRuleset);
      if ("estado" in result && result.estado === "PENDENTE")
        return reply(503, result.codigo, result);
      return reply(200, "SALAO_CARREGADO", result);
    }
    if (rota === "canal") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerCanal(deps.db);
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_CANAL_AUSENTE" : "CANAL_CARREGADO", result);
    }
    if (rota === "apac") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const cnes = deps.settings?.readProfile(sessao).perfil.instituicao.cnes ?? "";
      const result = lerApacs(deps.db, deps.agora(), { caixas: deps.corpus?.caixasTodas ?? [],
        sigtap: deps.corpus?.sigtap ?? {}, cnesConfigurado: cnes });
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_APAC_AUSENTE" : "APAC_CARREGADA", result);
    }
    if (rota === "chat") {
      const parsed = z.object({ setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CHAT_NAO_SELECIONADO", { setor: parsed.data.setor, mensagens: [] });
      const mensagens = lerMensagensChat(deps.db, parsed.data.setor, contexto);
      return reply(200, "CHAT_CARREGADO", { ...contexto, setor: parsed.data.setor, mensagens, prescricao: null });
    }
    if (rota === "bundle") {
      const parsed = ExibirBundle.safeParse(raw);
      if (parsed.success) {
        const result = exibirBundle(deps, token, parsed.data);
        return reply(result.status, (result.body as { codigo?: string }).codigo ?? "BUNDLE_EXIBIDO", result.body);
      }
      const pedido = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict().safeParse(raw);
      if (!pedido.success) return reply(400, "PAYLOAD_INVALIDO");
      const draftIds = listarDrafts(deps.db, pedido.data.patientId).filter((draft) => {
        const kind = draft.payload && typeof draft.payload === "object" && "kind" in draft.payload
          ? draft.payload.kind : null;
        const contexto = contextoDraft(draft.payload);
        return kind !== "EXTRACAO_RASCUNHO" && kind !== "PRESCRICAO_RASCUNHO"
          && kind !== "FLASH_RASCUNHO" && kind !== "FLASH_APAC_RASCUNHO"
          && contexto?.encounterId === pedido.data.encounterId
          && contexto.tumorLotId === pedido.data.tumorLotId && payloadDocumento(draft.payload) !== null;
      }).map((draft) => draft.draftId);
      const result = exibirBundle(deps, token, { ...pedido.data, draftIds });
      return reply(result.status, (result.body as { codigo?: string }).codigo ?? "BUNDLE_EXIBIDO", result.body);
    }
    if (rota === "confirmar") {
      const parsed = ConfirmarBloco.safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = confirmarBloco(deps, token, parsed.data);
      return reply(result.status, (result.body as { codigo: string }).codigo, result.body);
    }
    if (rota === "extrair") {
      const inputSchema = z.object({
        recordingId: z.string().min(1), sourceId: z.string().min(1),
        sourceType: z.enum(["pathology", "imaging_report", "prescription", "medical_note", "nursing", "plaud", "administration"]),
        page: z.number().int().nonnegative().optional(), rawTranscript: z.string().min(1).max(200_000),
      }).strict();
      const parsed = inputSchema.safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const input = { recordingId: parsed.data.recordingId, sourceId: parsed.data.sourceId,
        sourceType: parsed.data.sourceType, rawTranscript: parsed.data.rawTranscript,
        ...(parsed.data.page === undefined ? {} : { page: parsed.data.page }) };
      const state = executarPipelineExtracao(input);
      // Advisory chains use the approved local corpus and preserve original source.
      // They never create a clinical fact or confirm an emergency automatically.
      const rads = parsed.data.sourceType === "imaging_report" && deps.corpus?.rads
        ? detectarEmergencias(parsed.data.rawTranscript, deps.corpus.rads) : null;
      const alertasRads = rads?.alertas.map((alerta) => ({ ...alerta, sourceId: parsed.data.sourceId })) ?? [];
      // Gates are advisory at draft time: absent anatomy/laterality/specimen stays
      // pending and never prevents local persistence or consultation.
      const stages = state.facts.filter((f) => f.domain === "stage" && typeof f.value === "string");
      const alerts = [
        g07Lateralidade({}),
        g08AnatomiaSexo({}),
        ...stages.map((f) => {
          const prefix = String(f.value).match(/(?:^|\s)(yp|p|c)t/i)?.[1] ?? "";
          return g09PtDeBiopsia({ prefixo: prefix, tnmExplicito: true,
            specimen: parsed.data.sourceType === "pathology" ? "DESCONHECIDO" : undefined });
        }),
      ];
      const saved = salvarDraft(deps.db, {
        draftId: randomUUID(), patientId: null, sourceId: parsed.data.sourceId,
        rawRef: `importacao-local:${parsed.data.recordingId}`,
        payload: { kind: "EXTRACAO_RASCUNHO", input: parsed.data, state, alerts, alertasRads },
        diagnostics: ["VINCULO_MEDICO_PENDENTE", ...state.confirmationRequired.map((e) => e.kind),
          ...alerts.filter((a) => a.decisao !== "PASSA").map((a) => `${a.gate}_${a.decisao}`)],
        revision: 0, criadoEm: deps.agora(),
      });
      return reply(201, "RASCUNHO_SALVO", { draftId: saved.draftId, revision: saved.revision,
        linkedPatientId: null, facts: state.facts, exceptions: state.confirmationRequired,
        timeline: null, alerts, alertasRads, requiresMedicalReview: true });
    }
    if (rota === "rascunho") {
      const parsed = z.object({ draftId: z.string().min(1) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const draft = lerDraft(deps.db, parsed.data.draftId);
      if (!draft) return reply(404, "RASCUNHO_NAO_ENCONTRADO");
      const payload = draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
        ? draft.payload as Record<string, unknown> : null;
      if (payload?.kind === "EXTRACAO_RASCUNHO" && draft.patientId !== null) {
        const link = payload.patientLinkReview && typeof payload.patientLinkReview === "object"
          ? payload.patientLinkReview as Record<string, unknown> : null;
        const consulta = deps.sessoes.consultaSelecionada(token);
        const state = payload.state && typeof payload.state === "object" ? payload.state as Record<string, unknown> : null;
        const input = payload.input && typeof payload.input === "object" ? payload.input as Record<string, unknown> : null;
        const segments = Array.isArray(state?.segments) ? state.segments : [];
        const segment = segments.find((item) => item && typeof item === "object"
          && (item as Record<string, unknown>).id === link?.segmentId) as Record<string, unknown> | undefined;
        const facts = Array.isArray(state?.facts) ? state.facts : [];
        if (!consulta || consulta.patientId !== draft.patientId || !link
          || link.patientId !== consulta.patientId || link.encounterId !== consulta.encounterId
          || (link.tumorLotId ?? null) !== (consulta.tumorLotId ?? null)
          || !segment || typeof segment.rawTranscript !== "string" || !input)
          return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
        const scopedFacts = facts.filter((fact) => fact && typeof fact === "object"
          && (fact as Record<string, unknown>).segmentId === link.segmentId);
        const scopedExceptions = (value: unknown) => Array.isArray(value) ? value.filter((item) => item
          && typeof item === "object" && (item as Record<string, unknown>).segmentId === link.segmentId) : [];
        const visibleDraft = { ...draft, payload: {
          kind: "EXTRACAO_RASCUNHO", input: { recordingId: input.recordingId, sourceId: input.sourceId,
            sourceType: input.sourceType, ...(input.page === undefined ? {} : { page: input.page }),
            rawTranscript: segment.rawTranscript },
          state: { segments: [segment], facts: scopedFacts,
            confirmationRequired: scopedExceptions(state?.confirmationRequired) },
          alertasRads: [], patientLinkReview: link,
        } };
        return reply(200, "RASCUNHO_CARREGADO", { draft: visibleDraft });
      }
      return reply(200, "RASCUNHO_CARREGADO", { draft });
    }
    if (rota === "revisarRascunho" || rota === "prepararRevisao") {
      const parsed = z.object({ draftId: z.string().min(1), expectedRevision: z.number().int().nonnegative(),
        patientId: Id, factIds: z.array(Id).min(1).optional(), operationId: z.string().min(8).optional(),
        exceptionId: Id.optional(), acao: z.enum(["CONFIRMAR", "CORRIGIR", "DESCARTAR", "LIGAR_PACIENTE"]).optional(),
        sourceId: Id.optional(), encounterId: Id.optional(), tumorLotId: Id.nullable().optional(),
        idempotencyKey: z.string().min(8).optional(),
        comprovanteExibicao: z.object({ documentId: Id, documentVersion: z.number().int().positive(),
          conteudoHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict().optional() })
        .strict().refine((value) => value.factIds === undefined || value.operationId !== undefined).safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const legadoVinculo = z.object({ draftId: Id, expectedRevision: z.number().int().nonnegative(), patientId: Id })
        .strict().safeParse(raw);
      const isLegacyLink = rota === "revisarRascunho" && legadoVinculo.success;
      if (rota === "prepararRevisao" && (!parsed.data.factIds || parsed.data.comprovanteExibicao))
        return reply(400, "PAYLOAD_INVALIDO");
      let draft = lerDraft(deps.db, parsed.data.draftId);
      if (!draft) return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
      if (draft.revision !== parsed.data.expectedRevision) {
        const payload = draft.payload && typeof draft.payload === "object" ? draft.payload as Record<string, unknown> : null;
        const link = payload?.patientLinkReview && typeof payload.patientLinkReview === "object"
          ? payload.patientLinkReview as Record<string, unknown> : null;
        let selected = deps.sessoes.consultaSelecionada(token);
        let replayIdentityOnly = false;
        if (!selected && isLegacyLink && draft.patientId === parsed.data.patientId) {
          const resolved = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao);
          if (!("codigo" in resolved)) {
            selected = { patientId: parsed.data.patientId, encounterId: resolved.encounterId, tumorLotId: null };
            replayIdentityOnly = true;
          }
        }
        const replayKey = parsed.data.idempotencyKey ?? (isLegacyLink && selected
          ? chaveVinculoLegado({ draftId: draft.draftId, revision: parsed.data.expectedRevision,
            patientId: parsed.data.patientId, encounterId: selected.encounterId,
            tumorLotId: replayIdentityOnly ? null : selected.tumorLotId ?? null }) : null);
        const replayId = replayKey ? `review-link-${sha(replayKey).slice(0, 40)}` : null;
        const replayExists = replayId ? deps.db.prepare("SELECT 1 AS ok FROM operation WHERE operationId=?").get(replayId) : null;
        if (!parsed.data.factIds && draft.patientId === parsed.data.patientId && selected?.patientId === parsed.data.patientId
          && link?.patientId === parsed.data.patientId && link?.reviewDecisionId === replayId
          && link?.sourceId === (parsed.data.sourceId ?? draft.sourceId) && link?.encounterId === selected.encounterId
          && link?.exceptionId === (parsed.data.exceptionId ?? link?.exceptionId)
          && link?.identityOnly === replayIdentityOnly
          && (link?.tumorLotId ?? null) === (selected.tumorLotId ?? null) && replayExists)
          return reply(200, "REPLAY", { codigo: "VINCULO_REVISTO", draftId: draft.draftId,
            revision: draft.revision, linkedPatientId: draft.patientId, fatosConfirmados: 0,
            criaEventoClinico: false, replay: true });
        return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
      }
      const draftKind = draft.payload && typeof draft.payload === "object" && "kind" in draft.payload
        ? draft.payload.kind : null;
      if (draftKind !== "EXTRACAO_RASCUNHO")
        return reply(409, "TIPO_RASCUNHO_NAO_PODE_SER_VINCULADO");
      if (!lerPaciente(deps.db, parsed.data.patientId)) return reply(404, "PACIENTE_DESTINO_NAO_ENCONTRADO");
      const payloadOriginal = draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
        ? draft.payload as Record<string, unknown> : null;
      const linkReview = payloadOriginal?.patientLinkReview && typeof payloadOriginal.patientLinkReview === "object"
        ? payloadOriginal.patientLinkReview as Record<string, unknown> : null;
      if (draft.patientId !== null && draft.patientId !== parsed.data.patientId)
        return reply(409, "RASCUNHO_VINCULADO_A_OUTRO_PACIENTE");
      if (draft.patientId === null) {
        if (parsed.data.factIds) return reply(409, "VINCULO_PACIENTE_NAO_CONFIRMADO");
        let consultaVinculo = deps.sessoes.consultaSelecionada(token);
        let identityOnly = false;
        if (!consultaVinculo) {
          if (!isLegacyLink) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
          const resolvida = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao);
          if ("codigo" in resolvida) return reply(409, "ESCOPO_IDENTIDADE_NAO_DISPONIVEL");
          consultaVinculo = { patientId: parsed.data.patientId, encounterId: resolvida.encounterId, tumorLotId: null };
          identityOnly = true;
        }
        if (consultaVinculo.patientId !== parsed.data.patientId)
          return reply(409, "PACIENTE_FORA_DA_CONSULTA_SELECIONADA");
        if (!payloadOriginal || !payloadOriginal.input || typeof payloadOriginal.input !== "object")
          return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
        const extractionInput = payloadOriginal.input as Record<string, unknown>;
        if (typeof extractionInput.rawTranscript !== "string" || typeof extractionInput.sourceId !== "string")
          return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
        const exceptions = payloadOriginal.state && typeof payloadOriginal.state === "object"
          ? (payloadOriginal.state as Record<string, unknown>).confirmationRequired : null;
        const unlinkedExceptions = Array.isArray(exceptions) ? exceptions.filter((item) => item && typeof item === "object"
          && (item as Record<string, unknown>).kind === "UNLINKED_PATIENT"
          && Array.isArray((item as Record<string, unknown>).sourceIds)
          && ((item as Record<string, unknown>).sourceIds as unknown[]).includes(extractionInput.sourceId)) : [];
        if (isLegacyLink && unlinkedExceptions.length !== 1)
          return reply(409, "EXCECAO_VINCULO_AMBIGUA", { codigo: "EXCECAO_VINCULO_AMBIGUA" });
        const unlinkedException = isLegacyLink ? unlinkedExceptions[0]
          : unlinkedExceptions.find((item) => (item as Record<string, unknown>).id === parsed.data.exceptionId);
        const exceptionId = unlinkedException && typeof (unlinkedException as Record<string, unknown>).id === "string"
          ? (unlinkedException as Record<string, unknown>).id as string : null;
        const segmentId = unlinkedException && typeof (unlinkedException as Record<string, unknown>).segmentId === "string"
          ? (unlinkedException as Record<string, unknown>).segmentId as string : null;
        if (!exceptionId || !segmentId) return reply(409, "EXCECAO_VINCULO_NAO_ENCONTRADA");
        const idempotencyKey = isLegacyLink ? chaveVinculoLegado({ draftId: draft.draftId,
          revision: draft.revision, patientId: parsed.data.patientId, encounterId: consultaVinculo.encounterId,
          tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null }) : parsed.data.idempotencyKey;
        const action = AcaoRevisaoPedido.safeParse({ exceptionId: isLegacyLink ? exceptionId : parsed.data.exceptionId,
          acao: parsed.data.acao ?? (isLegacyLink ? "LIGAR_PACIENTE" : undefined),
          patientId: parsed.data.patientId, sourceId: isLegacyLink ? extractionInput.sourceId : parsed.data.sourceId,
          draftId: parsed.data.draftId, expectedRevision: parsed.data.expectedRevision,
          encounterId: isLegacyLink ? consultaVinculo.encounterId : parsed.data.encounterId,
          tumorLotId: isLegacyLink ? (identityOnly ? null : consultaVinculo.tumorLotId ?? null) : parsed.data.tumorLotId,
          idempotencyKey });
        if (!action.success || action.data.acao !== "LIGAR_PACIENTE"
          || action.data.sourceId !== draft.sourceId || action.data.sourceId !== extractionInput.sourceId
          || action.data.encounterId !== consultaVinculo.encounterId
          || action.data.tumorLotId !== (identityOnly ? null : consultaVinculo.tumorLotId ?? null))
          return reply(400, "ACAO_REVISAO_INVALIDA");
        const sourceState = payloadOriginal.state && typeof payloadOriginal.state === "object"
          ? payloadOriginal.state as Record<string, unknown> : null;
        const sourceSegments = Array.isArray(sourceState?.segments) ? sourceState.segments : [];
        const segment = sourceSegments.find((item) => item && typeof item === "object"
          && (item as Record<string, unknown>).id === segmentId
          && (item as Record<string, unknown>).sourceId === extractionInput.sourceId) as Record<string, unknown> | undefined;
        if (!segment || typeof segment.rawTranscript !== "string")
          return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
        const identidade = evidenciaIdentidade(segment.rawTranscript);
        const confronto = confrontarNomeIdentificador({ nomeDocumento: identidade.nomeDocumento,
          identificador: identidade.identificador, cadastroNome: lerPaciente(deps.db, parsed.data.patientId)!.nome,
          cadastroIdentificadores: lerPaciente(deps.db, parsed.data.patientId)!.identificadores });
        if (!confronto.liga) return reply(409, "CONFLITO_IDENTIDADE_DOCUMENTAL", {
          codigo: "CONFLITO_IDENTIDADE_DOCUMENTAL", motivo: confronto.motivo,
          sourceId: extractionInput.sourceId, trecho: identidade.trecho, exigeDecisaoMedica: true,
        });
        const sourceHash = hashConteudoExibido(draft.payload);
        const operationId = `review-link-${sha(action.data.idempotencyKey).slice(0, 40)}`;
        const existingOperation = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId) as { criadoEm?: string } | undefined;
        const em = existingOperation?.criadoEm ?? deps.agora();
        const reviewAction = ReviewAction.parse({ exceptionId: action.data.exceptionId, acao: action.data.acao,
          medicoId: sessao.medicoId, em, patientId: action.data.patientId });
        const reviewDraftId = `review-link-draft-${sha(operationId).slice(0, 32)}`;
        const reviewPayload = { kind: "PATIENT_LINK_REVIEW", action: reviewAction.acao,
          context: { patientId: parsed.data.patientId, encounterId: consultaVinculo.encounterId,
            tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null },
          exceptionId: action.data.exceptionId, segmentId, identityOnly,
          sourceRef: { draftId: draft.draftId, revision: draft.revision, sourceId: extractionInput.sourceId,
            contentHash: sourceHash, excerpt: identidade.trecho }, targetPatientId: parsed.data.patientId };
        const reviewDraft = lerDraft(deps.db, reviewDraftId);
        if (reviewDraft && (reviewDraft.patientId !== parsed.data.patientId
          || JSON.stringify(reviewDraft.payload) !== JSON.stringify(reviewPayload)))
          return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
        if (!reviewDraft) salvarDraft(deps.db, { draftId: reviewDraftId, patientId: parsed.data.patientId,
          sourceId: extractionInput.sourceId, rawRef: `review-link:${draft.draftId}`, payload: reviewPayload,
          diagnostics: ["DECISAO_DE_VINCULO_MEDICO"], revision: 0, criadoEm: em });
        const fonte = { sourceId: extractionInput.sourceId, classe: "DOCUMENT" as const,
          localizador: identidade.trecho, dataClinica: null, dataCaptura: em,
          versao: `draft-r${draft.revision}`, contentHash: sourceHash };
        const resultadoVinculo = confirmar(deps.db, { operationId, patientId: parsed.data.patientId,
          tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null, encounterId: consultaVinculo.encounterId,
          reviewDecisionId: operationId, sessao, em, registros: [{ draftId: reviewDraftId, expectedRevision: 0,
            eventId: `review-link-event-${sha(operationId).slice(0, 32)}`, tipo: "ReviewDecision",
          payload: { campo: "patientLink", exceptionId: reviewAction.exceptionId, acao: reviewAction.acao,
              medicoId: reviewAction.medicoId, em: reviewAction.em, patientId: parsed.data.patientId, segmentId, identityOnly,
              source: reviewPayload.sourceRef, trechoFonte: identidade.trecho }, fontes: [fonte], revisao: "CONFIRMADO" }] });
        if (resultadoVinculo.estado === "NEGADA") return reply(409, resultadoVinculo.motivo ?? "VINCULO_NEGADO");
        const atual = lerDraft(deps.db, draft.draftId);
        if (!atual || atual.revision !== parsed.data.expectedRevision || atual.patientId !== null)
          return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
        const reviewed = salvarDraft(deps.db, { ...atual, patientId: parsed.data.patientId,
          revision: draft.revision + 1,
          payload: { ...payloadOriginal, patientLinkReview: { patientId: parsed.data.patientId,
            encounterId: consultaVinculo.encounterId, tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null,
            medicoId: sessao.medicoId, em, reviewDecisionId: operationId,
            exceptionId: action.data.exceptionId, segmentId, identityOnly,
            sourceId: extractionInput.sourceId, sourceHash } },
          diagnostics: [...draft.diagnostics, "VINCULO_PACIENTE_CONFIRMADO_POR_MEDICO"] });
        if (reviewed.diagnostics.includes("EXPECTED_REVISION_CONFLICT"))
          return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
        draft = reviewed;
      } else if (linkReview?.patientId !== parsed.data.patientId) {
        return reply(409, "VINCULO_PACIENTE_NAO_CONFIRMADO");
      } else {
        const consultaAtual = deps.sessoes.consultaSelecionada(token);
        if (consultaAtual && consultaAtual.patientId !== parsed.data.patientId)
          return reply(409, "PACIENTE_FORA_DA_CONSULTA_SELECIONADA");
        if (consultaAtual && (linkReview?.encounterId !== consultaAtual.encounterId
          || (linkReview?.tumorLotId ?? null) !== (consultaAtual.tumorLotId ?? null)))
          return reply(409, "DRAFT_FORA_DO_ESCOPO");
      }
      if (!parsed.data.factIds) return reply(200, "VINCULO_REVISTO", {
        codigo: "VINCULO_REVISTO", draftId: draft.draftId, revision: draft.revision,
        linkedPatientId: draft.patientId, fatosConfirmados: 0, criaEventoClinico: false,
      });

      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (contexto.patientId !== parsed.data.patientId) return reply(409, "PACIENTE_FORA_DA_CONSULTA_SELECIONADA");
      if (linkReview?.encounterId !== undefined && (linkReview.encounterId !== contexto.encounterId
        || (linkReview.tumorLotId ?? null) !== (contexto.tumorLotId ?? null)))
        return reply(409, "DRAFT_FORA_DO_ESCOPO");
      if (!payloadOriginal || typeof payloadOriginal.input !== "object" || payloadOriginal.input === null
        || typeof payloadOriginal.state !== "object" || payloadOriginal.state === null)
        return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
      const extractionInput = payloadOriginal.input as Record<string, unknown>;
      const extractionState = payloadOriginal.state as Record<string, unknown>;
      if (typeof extractionInput.sourceId !== "string" || typeof extractionInput.sourceType !== "string"
        || typeof extractionInput.rawTranscript !== "string" || !Array.isArray(extractionState.facts)
        || !Array.isArray(extractionState.confirmationRequired))
        return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
      const linkedSegmentId = typeof linkReview?.segmentId === "string" ? linkReview.segmentId : null;
      if (!linkedSegmentId || typeof linkReview?.reviewDecisionId !== "string"
        || typeof linkReview.exceptionId !== "string") return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
      const linkedSegment = Array.isArray(extractionState.segments)
        ? extractionState.segments.map((value) => EncounterSegment.safeParse(value))
          .find((item) => item.success && item.data.id === linkedSegmentId)?.data ?? null
        : null;
      if (!linkedSegment || linkedSegment.sourceId !== extractionInput.sourceId)
        return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
      const linkEventRow = deps.db.prepare(`SELECT * FROM clinical_event WHERE operationId=? AND tipo='ReviewDecision'`)
        .get(linkReview.reviewDecisionId) as Record<string, unknown> | undefined;
      let linkEvent: Record<string, unknown> | null = null;
      try {
        if (linkEventRow) linkEvent = { ...linkEventRow,
          payload: JSON.parse(String(linkEventRow.payload)),
          fontes: JSON.parse(String(linkEventRow.fontes)),
          criadoPor: JSON.parse(String(linkEventRow.criadoPor)) };
      } catch { return reply(409, "DECISAO_VINCULO_INVALIDA"); }
      const decisionEnvelope = linkEvent?.payload && typeof linkEvent.payload === "object"
        ? linkEvent.payload as Record<string, unknown> : null;
      const decision = decisionEnvelope?.data && typeof decisionEnvelope.data === "object"
        ? decisionEnvelope.data as Record<string, unknown> : null;
      const decisionActor = linkEvent?.criadoPor && typeof linkEvent.criadoPor === "object"
        ? linkEvent.criadoPor as Record<string, unknown> : null;
      const sourceRef = decision?.source && typeof decision.source === "object"
        ? decision.source as Record<string, unknown> : null;
      if (!linkEvent || linkEvent.patientId !== parsed.data.patientId || linkEvent.encounterId !== contexto.encounterId
        || (linkEvent.tumorLotId ?? null) !== (contexto.tumorLotId ?? null)
        || decisionActor?.tipo !== "SESSAO" || decisionActor.id !== sessao.medicoId
        || decision?.campo !== "patientLink" || decision.exceptionId !== linkReview.exceptionId
        || decision.patientId !== parsed.data.patientId || decision.segmentId !== linkedSegmentId
        || sourceRef?.draftId !== draft.draftId || sourceRef.sourceId !== extractionInput.sourceId
        || sourceRef.revision !== draft.revision - 1 || sourceRef.contentHash !== linkReview.sourceHash)
        return reply(409, "DECISAO_VINCULO_INVALIDA");
      const factsRaw = extractionState.facts as unknown[];
      const factsForLinkedSegment = factsRaw.flatMap((value) => {
        const parsedFact = ClinicalFactContract.safeParse(value);
        return parsedFact.success && parsedFact.data.segmentId === linkedSegmentId ? [parsedFact.data] : [];
      });
      for (const factId of parsed.data.factIds) {
        const fact = factsRaw.find((item) => item && typeof item === "object"
          && (item as Record<string, unknown>).id === factId) as Record<string, unknown> | undefined;
        if (!fact) continue; // preparing review returns the canonical missing-fact error.
        if (fact.segmentId !== linkedSegmentId) return reply(409, "FATO_FORA_DO_SEGMENTO_VINCULADO");
      }
      const operationId = parsed.data.operationId!;
      const operacaoExistente = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId);
      const summaryId = `evolucao-extracao-${sha(operationId).slice(0, 32)}`;
      const summaryDraft = lerDraft(deps.db, summaryId);
      const em = typeof operacaoExistente?.criadoEm === "string" ? operacaoExistente.criadoEm
        : summaryDraft?.criadoEm ?? deps.agora();
      let revisao: ReturnType<typeof prepararRevisaoExtracao>;
      try {
        revisao = prepararRevisaoExtracao({ draftId: draft.draftId, sourceId: extractionInput.sourceId,
          rawTranscript: linkedSegment.rawTranscript, sourceType: extractionInput.sourceType,
          facts: factsForLinkedSegment,
          exceptions: extractionState.confirmationRequired.filter((value) => value && typeof value === "object"
            && (value as Record<string, unknown>).segmentId === linkedSegmentId),
          patientId: parsed.data.patientId, encounterId: contexto.encounterId,
          tumorLotId: contexto.tumorLotId ?? null, factIds: parsed.data.factIds, operationId,
          medicoId: sessao.medicoId, em,
          origem: { draftId: draft.draftId, revision: draft.revision, conteudoHash: hashConteudoExibido(draft.payload) } });
      } catch (error) {
        const code = error instanceof Error ? error.message : "EXTRACAO_RASCUNHO_INVALIDO";
        return reply(409, ["FACT_IDS_INVALIDOS", "PROVENIENCIA_DIVERGENTE", "FATO_NAO_ENCONTRADO"].includes(code)
          ? code : "EXTRACAO_RASCUNHO_INVALIDO");
      }
      if (operacaoExistente && !summaryDraft)
        return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
      if (summaryDraft && (summaryDraft.patientId !== parsed.data.patientId
        || JSON.stringify(summaryDraft.payload) !== JSON.stringify(revisao.payload)))
        return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
      const documento = { documentId: revisao.draftId, documentVersion: 1,
        conteudoHash: hashConteudoExibido(revisao.payload) };
      const escopo = { ...contexto, tumorLotId: contexto.tumorLotId ?? null };
      if (rota === "prepararRevisao") {
        if (!summaryDraft) salvarDraft(deps.db, { draftId: revisao.draftId, patientId: parsed.data.patientId,
          sourceId: revisao.sourceId, rawRef: `revisao-local:${draft.draftId}`, payload: revisao.payload,
          diagnostics: ["EVOLUCAO_RASCUNHO", "REVISAO_MEDICA_PENDENTE"], revision: 0, criadoEm: em });
        deps.sessoes.registrarBundleExibido(token, escopo, [documento]);
        return reply(200, "REVISAO_PREPARADA", { codigo: "REVISAO_PREPARADA",
          conteudo: revisao.payload, comprovanteExibicao: documento, criaEventoClinico: false });
      }
      const exibidos = deps.sessoes.bundleExibido(token, escopo);
      const comprovante = parsed.data.comprovanteExibicao;
      if (!summaryDraft || !exibidos || !comprovante) return reply(409, "BUNDLE_NAO_EXIBIDO");
      if (g25EscopoAssinatura([comprovante], exibidos).decisao !== "PASSA"
        || comprovante.documentId !== documento.documentId || comprovante.documentVersion !== documento.documentVersion)
        return reply(409, "ESCOPO_ASSINATURA_INVALIDO");
      if (comprovante.conteudoHash !== documento.conteudoHash || !exibidos.some((item) =>
        item.documentId === documento.documentId && item.documentVersion === documento.documentVersion
        && item.conteudoHash === documento.conteudoHash)) return reply(409, "CONTEUDO_ALTERADO_APOS_EXIBICAO");
      const result = confirmar(deps.db, { operationId, patientId: parsed.data.patientId,
        tumorLotId: contexto.tumorLotId ?? null, encounterId: contexto.encounterId,
        reviewDecisionId: operationId, sessao, em,
        registros: revisao.registros.map((registro) => ({ draftId: revisao.draftId, expectedRevision: 0,
          eventId: registro.eventId, tipo: registro.tipo, payload: registro.payload, fontes: [...registro.fontes],
          revisao: "CONFIRMADO" as const })) });
      if (result.estado === "NEGADA") return reply(409, result.motivo ?? "REVISAO_NEGADA");
      const persisted = lerDraft(deps.db, revisao.draftId);
      return reply(200, result.estado === "REPLAY" ? "REVISAO_REPLAY" : "FATOS_REVISTOS", {
        codigo: result.estado, draftId: revisao.draftId, revision: persisted?.revision ?? 1,
        linkedPatientId: parsed.data.patientId, encounterId: contexto.encounterId,
        factIds: parsed.data.factIds, resultRef: result.resultRef, evolucaoRascunho: revisao.payload.resumo,
        revisaoMedica: { medicoId: sessao.medicoId, em },
      });
    }
    const parsed = ActionIntent.safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const autorizacao = autorizarSaida(deps.db, parsed.data);
    if (!autorizacao.ok) return reply(409, autorizacao.codigo);
    // Uma rota /acao nunca usa a idempotencia volátil do caller: o ledger local
    // conserva a reserva OUTCOME_UNKNOWN antes do executor, inclusive após reiniciar.
    const result = await deps.gateway.withStore(sqliteIdempotencia(deps.db)).executar(parsed.data, sessao);
    return reply(result.decisao === "NEGADA" ? 409 : 200, result.motivoCodigo, result);
  } catch (error) {
    if (error instanceof JsonInvalido) return reply(400, "JSON_INVALIDO");
    if (error instanceof Error && error.message === "CONTEXTO_PACIENTE_OBRIGATORIO")
      return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
    // Never log request bodies, identifiers, thrown error text or stack.
    return reply(500, "ERRO_INTERNO");
  }
}
