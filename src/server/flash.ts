// W12-F4 · Consulta Flash no servidor: dados calculados do ledger e fechamento pelos caminhos existentes.
// IA propõe, código calcula, médico decide e assina. Nenhum efeito externo aqui: só rascunhos no ledger local.
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Id } from "../contracts/base.js";
import type { ClinicalEvent } from "../contracts/operacao.js";
import { lerDraft, salvarDraft } from "../kernel/ledger/drafts.js";
import { sqliteIdempotencia } from "../kernel/ledger/idempotencia.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import type { PlanoFlash } from "../ui/consulta/ConsultaFlash.js";
import type { FlashVisao } from "../ui/api/porta.js";
import { hashConteudoExibido } from "./sessao.js";
import { lerModeloFlashConfigurado, type ModeloFlash } from "../config/flash.js";
export type { ModeloFlash } from "../config/flash.js";

/** Tipos de evento que carregam laudo com frase (data.dataClinica, data.fraseLaudo, data.nome). */
const TIPOS_EXAME_COM_LAUDO = new Set(["Biopsy", "ImagingReport", "ExameLaudo", "LabResult"]);
const TIPO_DOC = {
  evolucao: "FLASH_EVOLUCAO",
  laboratorio: "FLASH_PEDIDO_LABORATORIO",
  imagem: "FLASH_PEDIDO_IMAGEM",
  retorno: "FLASH_RETORNO",
  qt: "FLASH_DECISAO_QT",
  conjunto: "FLASH_CONJUNTO_IMPRESSAO",
} as const;
const DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXAMES = 10;


/** Valor da caixa do modelo padrão. Qualquer formato fora do esperado = sem modelo (nada vem marcado). */
export function lerModeloFlash(valor: unknown): ModeloFlash | null {
  return lerModeloFlashConfigurado(valor);
}

/** Conteúdo do documento: o evento assinado guarda { data: payloadDoDraft, signature }. */
function corpoDoEvento(evento: ClinicalEvent): Record<string, unknown> | null {
  const d = dadosDoEvento(evento);
  if (!d) return null;
  const interno = d.data;
  return interno && typeof interno === "object" && !Array.isArray(interno) && "signature" in d
    ? interno as Record<string, unknown> : d;
}

function situacaoDe(valor: unknown): FlashVisao["exames"][number]["situacao"] {
  return valor === "DENTRO_DO_LIMITE" || valor === "FORA_DO_LIMITE" ? valor : "SEM_REFERENCIA";
}

export function projetarFlash(
  eventos: readonly ClinicalEvent[],
  dataReferencia: string,
  modelo: ModeloFlash | null,
  rascunho: { draftId: string; revision: number; plano?: PlanoFlashEntradaTipo } | null,
): FlashVisao {
  const vigentes = eventosVigentes(eventos);
  const exames = vigentes.flatMap((e) => {
    if (!TIPOS_EXAME_COM_LAUDO.has(e.tipo)) return [];
    const d = dadosDoEvento(e);
    if (!d || typeof d.dataClinica !== "string" || !DATA_CIVIL.test(d.dataClinica) || d.dataClinica > dataReferencia) return [];
    if (typeof d.fraseLaudo !== "string" || d.fraseLaudo.trim().length === 0) return [];
    const nome = typeof d.nome === "string" && d.nome.trim().length > 0 ? d.nome.trim() : e.tipo;
    return [{ data: d.dataClinica, nome, fraseLaudo: d.fraseLaudo.trim(), situacao: situacaoDe(d.situacao), eventId: e.eventId }];
  }).sort((a, b) => b.data.localeCompare(a.data) || a.eventId.localeCompare(b.eventId))
    .slice(0, MAX_EXAMES).map(({ eventId: _id, ...exame }) => exame);

  // Prazo do retorno: do último plano registrado (documento de retorno confirmado/assinado). Ausente = null.
  let retornoDias: number | null = null;
  for (const e of vigentes) {
    if (e.tipo !== "DOCUMENTO") continue;
    const corpo = corpoDoEvento(e);
    if (!corpo || corpo.tipoDocumento !== TIPO_DOC.retorno) continue;
    const dias = corpo.retornoDias;
    retornoDias = typeof dias === "number" && Number.isInteger(dias) && dias >= 1 ? dias : null;
  }

  return {
    exames,
    retornoDias,
    modeloPadraoSalvo: modelo !== null,
    laboratorioPreMarcado: modelo?.laboratorio ?? false,
    imagemPreMarcada: modelo?.imagem ?? false,
    ...(modelo?.solicitacoes ? {modeloSolicitacoes:{laboratorio:[...modelo.solicitacoes.laboratorio],imagem:[...modelo.solicitacoes.imagem]}} : {}),
    ...(rascunho ? { rascunho: { draftId: rascunho.draftId, revision: rascunho.revision,
      ...(rascunho.plano ? { plano: planoParaVisao(rascunho.plano) } : {}) } } : {}),
  };
}

const ApacFlashEntrada = z.object({
  cid: z.string().max(40), sigtap: z.string().max(40), finalidade: z.string().max(80), competencia: z.string().max(20),
  estado: z.enum(["VALIDA", "PENDENTE", "INCOMPATIVEL"]),
  pendencias: z.array(z.string().max(300)).max(50),
  emitir: z.literal(false),
}).strict();

export const PlanoFlashEntrada = z.object({
  acoesMarcadas: z.array(Id).max(50),
  receitasMarcadas: z.array(Id).max(50),
  apac: ApacFlashEntrada,
  retorno: z.object({
    dias: z.number().int().min(1).max(3650).nullable(),
    motivo: z.string().max(300).optional(),
    examesAntesDoRetorno: z.array(z.string().max(200)).max(50),
  }).strict(),
  solicitacoes: z.object({
    laboratorio: z.array(z.string().trim().min(1).max(200)).max(50),
    imagem: z.array(z.string().trim().min(1).max(200)).max(50),
  }).strict().optional(),
  decisaoQt: z.object({
    solicitarCiclo: z.boolean(),
    data: z.string().regex(DATA_CIVIL).refine((valor) => {
      const data = new Date(`${valor}T12:00:00Z`);
      return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
    }, "Data civil inválida").nullable(),
  }).strict().optional(),
  tarefasRetorno: z.object({ retorno: z.boolean(), laboratorio: z.boolean(), imagem: z.boolean() }).strict().optional(),
}).strict();
export type PlanoFlashEntradaTipo = z.infer<typeof PlanoFlashEntrada>;

/** O contrato da visão omite opcionais ausentes, inclusive no objeto retorno. */
function planoParaVisao(plano: PlanoFlashEntradaTipo): PlanoFlash {
  return { acoesMarcadas: plano.acoesMarcadas, receitasMarcadas: plano.receitasMarcadas, apac: plano.apac,
    retorno: { dias: plano.retorno.dias, examesAntesDoRetorno: plano.retorno.examesAntesDoRetorno,
      ...(plano.retorno.motivo !== undefined ? { motivo: plano.retorno.motivo } : {}) },
    ...(plano.tarefasRetorno !== undefined ? { tarefasRetorno: plano.tarefasRetorno } : {}),
    ...(plano.solicitacoes !== undefined ? { solicitacoes: plano.solicitacoes } : {}),
    ...(plano.decisaoQt !== undefined ? { decisaoQt: plano.decisaoQt } : {}),
  };
}

export interface ContextoFlash { patientId: string; encounterId: string; tumorLotId: string | null }
interface Resposta { status: number; body: Record<string, unknown> }

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const chaveContexto = (c: ContextoFlash) => sha(JSON.stringify([c.patientId, c.encounterId, c.tumorLotId]));
const MENSAGEM_APAC = "APAC: rascunho, não emitida";

/** SALVAR RASCUNHO: grava um rascunho (sem documentId, nunca entra no bundle nem é assinado). */
export function salvarRascunhoFlash(db: DatabaseSync, agora: string, input: ContextoFlash & {
  plano: PlanoFlashEntradaTipo; expectedRevision: number | null;
}): Resposta {
  const draftId = `flash-rascunho-${chaveContexto(input).slice(0, 24)}`;
  const atual = lerDraft(db, draftId);
  const revisionAtual = atual ? atual.revision : null;
  if (revisionAtual !== input.expectedRevision)
    return { status: 409, body: { codigo: "REVISAO_RASCUNHO_CONFLITANTE", revisionAtual } };
  const revision = atual ? atual.revision + 1 : 0;
  salvarDraft(db, {
    draftId, patientId: input.patientId, sourceId: "consulta-flash", rawRef: "consulta-flash-local",
    payload: {
      kind: "FLASH_RASCUNHO",
      contexto: { encounterId: input.encounterId, tumorLotId: input.tumorLotId },
      plano: input.plano, status: "RASCUNHO", assinada: false,
    },
    diagnostics: ["REVISAO_MEDICA_OBRIGATORIA"], revision, criadoEm: agora,
  });
  return { status: 201, body: { codigo: "RASCUNHO_SALVO", draftId, revision } };
}

export interface ContextoQtFlash { protocolo: string; ciclo: number; ciclosPrevistos: number | null }

interface DocumentoFlash { documentId: string; titulo: string; tipoDocumento: string; texto: string; extra: Record<string, unknown> }

function montarDocumentos(chave: string, plano: PlanoFlashEntradaTipo, resumoClinico: string | null, contextoQt: ContextoQtFlash | null): DocumentoFlash[] {
  const essencial = plano.solicitacoes !== undefined || plano.decisaoQt !== undefined;
  const itensLab = plano.solicitacoes?.laboratorio ?? (essencial ? [] : plano.retorno.examesAntesDoRetorno);
  const itensImagem = plano.solicitacoes?.imagem ?? [];
  const lab = essencial ? itensLab.length > 0 : plano.tarefasRetorno?.laboratorio === true;
  const img = essencial ? itensImagem.length > 0 : plano.tarefasRetorno?.imagem === true;
  const dias = plano.retorno.dias;
  const prazo = dias === null ? "prazo PENDENTE" : `em ${dias} dias`;
  const apac = plano.apac.pendencias.length > 0
    ? `${MENSAGEM_APAC}; pendências: ${plano.apac.pendencias.join("; ")}` : MENSAGEM_APAC;
  const id = (tipo: string) => `flash-${tipo}-${chave.slice(0, 20)}`;
  const docs: DocumentoFlash[] = [
    { documentId: id("evolucao"), titulo: "Evolução da Consulta Flash", tipoDocumento: TIPO_DOC.evolucao,
      texto: [...(resumoClinico ? [resumoClinico, ""] : []), (essencial ? "Consulta Flash: plano proposto pelo médico para revisão e assinatura." : "Consulta Flash: plano confirmado pelo médico."), `Retorno: ${prazo}.`,
        `Laboratório: ${lab ? "pedido gerado" : "não solicitado"}.`, `Imagem: ${img ? "pedido gerado" : "não solicitada"}.`,
        ...(essencial ? [] : [`${apac}.`])].join("\n"), extra: {} },
  ];
  if (lab) docs.push({ documentId: id("laboratorio"), titulo: "Pedido de laboratório", tipoDocumento: TIPO_DOC.laboratorio,
    texto: ["Pedido de laboratório (Consulta Flash).", `Itens: ${itensLab.length > 0 ? itensLab.join("; ") : "PENDENTE"}.`].join("\n"), extra: essencial ? { itens: itensLab } : {} });
  if (img) docs.push({ documentId: id("imagem"), titulo: "Pedido de imagem", tipoDocumento: TIPO_DOC.imagem,
    texto: `Pedido de imagem (Consulta Flash).\nItens: ${itensImagem.length > 0 ? itensImagem.join("; ") : "PENDENTE"}.`,
    extra: essencial ? { itens: itensImagem } : {} });
  if (plano.decisaoQt?.solicitarCiclo) docs.push({
    documentId: id("qt"), titulo: "Decisão médica de ciclo", tipoDocumento: TIPO_DOC.qt,
    texto: ["Decisão médica: solicitar ciclo de QT.",
      `Protocolo: ${contextoQt!.protocolo}. Ciclo: ${contextoQt!.ciclo}${contextoQt!.ciclosPrevistos === null ? "" : `/${contextoQt!.ciclosPrevistos}`}.`,
      `Data: ${plano.decisaoQt.data}.`,
      ...(resumoClinico ? [resumoClinico] : []),
      "Esta decisão não registra administração nem substitui a prescrição de protocolo e doses."].join("\n"),
    extra: { decisaoQt: plano.decisaoQt, contextoQt, administracaoRegistrada: false },
  });
  docs.push({ documentId: id("retorno"), titulo: "Retorno", tipoDocumento: TIPO_DOC.retorno,
    texto: `Retorno ${prazo}.${plano.retorno.motivo ? `\nMotivo: ${plano.retorno.motivo}` : ""}`,
    extra: { retornoDias: dias, retornoEstado: dias === null ? "PENDENTE" : "DEFINIDO" } });
  if (essencial) {
    // Cópia fixa dos documentos selecionados; o conjunto também exige exibição e assinatura.
    const documentosIncluidos = docs.map(d => ({ documentId: d.documentId, documentVersion: 1, titulo: d.titulo }));
    const textoConjunto = docs.map(d => `${d.titulo}\n${d.texto}`).join("\n\n---\n\n");
    docs.push({ documentId: id("conjunto"), titulo: "Conjunto da Consulta Flash", tipoDocumento: TIPO_DOC.conjunto,
      texto: textoConjunto, extra: { documentosIncluidos } });
  }
  return docs;
}

/**
 * FINALIZAR, passo 1: o plano exibido vira documentos em rascunho (com documentId/versão), prontos para o
 * caminho de sempre: exibir bundle (conteúdo + hash no servidor) e confirmar. Aqui nada é assinado.
 */
export function prepararFinalizacaoFlash(db: DatabaseSync, agora: string, input: ContextoFlash & {
  plano: PlanoFlashEntradaTipo; idempotencyKey: string;
}, resumoClinico: string | null = null, contextoQt: ContextoQtFlash | null = null): Resposta {
  db.exec("SAVEPOINT flash_preparacao");
  try {
    const resultado = prepararDocumentosFlash(db, agora, input, resumoClinico, contextoQt);
    if (resultado.status >= 400) db.exec("ROLLBACK TO flash_preparacao");
    db.exec("RELEASE flash_preparacao");
    return resultado;
  } catch (erro) {
    db.exec("ROLLBACK TO flash_preparacao"); db.exec("RELEASE flash_preparacao");
    throw erro;
  }
}

function prepararDocumentosFlash(db: DatabaseSync, agora: string, input: ContextoFlash & {
  plano: PlanoFlashEntradaTipo; idempotencyKey: string;
}, resumoClinico: string | null, contextoQt: ContextoQtFlash | null): Resposta {
  if (input.plano.acoesMarcadas.length > 0 || input.plano.receitasMarcadas.length > 0)
    return { status: 409, body: { codigo: "ITENS_FLASH_SEM_DOCUMENTO" } };
  if (input.plano.decisaoQt?.solicitarCiclo && !input.plano.decisaoQt.data)
    return { status: 409, body: { codigo: "DATA_CICLO_PENDENTE" } };
  if (input.plano.decisaoQt?.solicitarCiclo && (!contextoQt || !contextoQt.protocolo.trim()
    || !Number.isInteger(contextoQt.ciclo) || contextoQt.ciclo < 1
    || (contextoQt.ciclosPrevistos !== null && (!Number.isInteger(contextoQt.ciclosPrevistos)
      || contextoQt.ciclosPrevistos < contextoQt.ciclo))))
    return { status: 409, body: { codigo: "QT_SEM_CONTEXTO" } };
  const payloadHash = hashConteudoExibido({ plano: input.plano, resumoClinico,
    ...(input.plano.decisaoQt?.solicitarCiclo ? { contextoQt } : {}) });
  const chavePedido = `flash-preparar:${chaveContexto(input)}:${sha(input.idempotencyKey)}`;
  const store = sqliteIdempotencia(db);
  const reserva = store.reserve(chavePedido, payloadHash, agora);
  if (reserva.registro.payloadHash !== payloadHash)
    return { status: 409, body: { codigo: "IDEMPOTENCIA_CONFLITO" } };
  // A identidade do artefato resiste a reload/nova sessão e nova chave após resposta perdida.
  // Somente conteúdo e contexto exatamente iguais compartilham os mesmos documentos.
  const chave = sha(JSON.stringify([chaveContexto(input), payloadHash]));
  const contexto = { encounterId: input.encounterId, tumorLotId: input.tumorLotId };
  const docs = montarDocumentos(chave, input.plano, resumoClinico, contextoQt);
  const draftsDocs = docs.map((d) => ({
    doc: d,
    payload: {
      documentId: d.documentId, documentVersion: 1, titulo: d.titulo, tipoDocumento: d.tipoDocumento,
      contexto, texto: d.texto, origem: "CONSULTA_FLASH", documentHash: sha(`${d.tipoDocumento}\n${d.texto}`), ...d.extra,
    },
  }));
  const essencial = input.plano.solicitacoes !== undefined || input.plano.decisaoQt !== undefined;
  const apacPayload = !essencial && (input.plano.apac.cid.trim() !== "" || input.plano.apac.pendencias.length > 0)
    ? { kind: "FLASH_APAC_RASCUNHO", contexto, apac: { ...input.plano.apac, emitir: false },
      status: "RASCUNHO", assinada: false, emitida: false } : null;
  const apacId = `flash-apac-${chave.slice(0, 20)}`;

  // Valida tudo antes de gravar: nada fica pela metade.
  const jaExistentes = new Map<string, number>();
  for (const { payload } of draftsDocs) {
    const existente = lerDraft(db, payload.documentId);
    if (!existente) continue;
    if (existente.patientId !== input.patientId || hashConteudoExibido(existente.payload) !== hashConteudoExibido(payload))
      return { status: 409, body: { codigo: "IDEMPOTENCIA_CONFLITO" } };
    if (existente.revision > 0) return { status: 409, body: { codigo: "FLASH_JA_FINALIZADA" } };
    jaExistentes.set(payload.documentId, existente.revision);
  }
  for (const { payload } of draftsDocs) {
    if (jaExistentes.has(payload.documentId)) continue;
    salvarDraft(db, { draftId: payload.documentId, patientId: input.patientId, sourceId: "consulta-flash",
      rawRef: "consulta-flash-local", payload, diagnostics: ["REVISAO_MEDICA_OBRIGATORIA"], revision: 0, criadoEm: agora });
  }
  if (apacPayload && !lerDraft(db, apacId))
    salvarDraft(db, { draftId: apacId, patientId: input.patientId, sourceId: "consulta-flash",
      rawRef: "consulta-flash-local", payload: apacPayload,
      diagnostics: ["APAC_NAO_EMITIDA", "REVISAO_MEDICA_OBRIGATORIA"], revision: 0, criadoEm: agora });

  const evolucao = draftsDocs[0]!.payload;
  const conjunto = draftsDocs.find(({ payload }) => payload.tipoDocumento === TIPO_DOC.conjunto)?.payload;
  store.set(chavePedido, { payloadHash,
    resultado: { decisao: "EXECUTADA", motivoCodigo: "FLASH_PREPARADA", recibo: evolucao.documentId } }, agora);
  return { status: 200, body: {
    codigo: "FLASH_PREPARADA",
    registros: draftsDocs.map(({ payload }) => ({ id: payload.documentId, expectedRevision: 0 })),
    documentos: draftsDocs.map(({ payload }) => ({ documentId: payload.documentId, documentVersion: 1,
      titulo: payload.titulo, tipoDocumento: payload.tipoDocumento })),
    alvoImpressao: { tipo: conjunto ? "DOCUMENTO" : "EVOLUCAO", id: conjunto?.documentId ?? evolucao.documentId, versao: 1 },
    apacRascunho: apacPayload !== null,
  } };
}

/** Rascunho da Flash para o contexto (para a visão devolver a revisão corrente). */
export function rascunhoFlashDoContexto(db: DatabaseSync, c: ContextoFlash): { draftId: string; revision: number; plano: PlanoFlashEntradaTipo } | null {
  const draftId = `flash-rascunho-${chaveContexto(c).slice(0, 24)}`;
  const d = lerDraft(db, draftId);
  if (!d || d.patientId !== c.patientId) return null;
  const payload = d.payload as Record<string, unknown>;
  if (payload.kind !== "FLASH_RASCUNHO") return null;
  const contexto = payload.contexto as Record<string, unknown> | undefined;
  if (!contexto || contexto.encounterId !== c.encounterId || contexto.tumorLotId !== c.tumorLotId) return null;
  const plano = PlanoFlashEntrada.safeParse(payload.plano);
  return plano.success ? { draftId, revision: d.revision, plano: plano.data } : null;
}
