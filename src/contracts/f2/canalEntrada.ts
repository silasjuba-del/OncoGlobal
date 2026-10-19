import { z } from "zod";
import { Instante } from "../base.js";
import { EstadoConversa } from "../estados.js";

const Id = z.string().min(1).max(250).refine((value) => value.trim().length > 0 && value === value.trim() && !/[\u0000-\u001f]/.test(value), "identificador inválido");
const HashSha256 = z.string().regex(/^[a-f0-9]{64}$/);
const TextoMensagem = z.string().min(1).max(250_000)
  .refine((texto) => new TextEncoder().encode(texto).byteLength <= 250_000, "texto excede 250 kB UTF-8");
export const CanalFonte = z.enum(["WHATSAPP_SERVICO", "EMAIL"]);
export type CanalFonte = z.infer<typeof CanalFonte>;

/** Transporte e D8 são eixos diferentes; recibos técnicos nunca avançam EstadoConversa. */
export const EstadoReciboCanal = z.enum(["RECEBIDA", "PROCESSADA", "ENVIADA", "ENTREGUE", "FALHOU"]);
export type EstadoReciboCanal = z.infer<typeof EstadoReciboCanal>;
/** Recibos possíveis no fluxo de entrada; não representa capacidade de envio. */
export const EstadoReciboEntradaCanal = z.enum(["RECEBIDA", "PROCESSADA", "FALHOU"]);
export type EstadoReciboEntradaCanal = z.infer<typeof EstadoReciboEntradaCanal>;

export const EstadoAvaliacaoCanal = z.enum(["PENDENTE", "AVALIADO"]);
export type EstadoAvaliacaoCanal = z.infer<typeof EstadoAvaliacaoCanal>;

export const ResultadoIdempotenciaCanal = z.enum(["NOVA", "REPLAY", "CONFLITO", "FALHA_DE_PERSISTENCIA"]);
export type ResultadoIdempotenciaCanal = z.infer<typeof ResultadoIdempotenciaCanal>;

/** GET de verificação inicial do webhook WhatsApp (separado do POST de mensagens). */
export const DesafioWebhookWhatsApp = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1).max(250),
  "hub.challenge": z.string().min(1).max(250).refine((v) => !/[\u0000-\u001f<>]/.test(v), "challenge inválido"),
}).strict();
export type DesafioWebhookWhatsApp = z.infer<typeof DesafioWebhookWhatsApp>;

/** DTO bruto do provedor. Conta, método de autenticação, patientId e decisões não vêm no body. */
export const CanalWebhookBruto = z.discriminatedUnion("tipoConteudo", [
  z.object({
    tipoConteudo: z.literal("TEXT"), providerMessageId: Id, senderRef: Id,
    providerSentAt: Instante.nullable(), texto: TextoMensagem,
  }).strict(),
  z.object({
    tipoConteudo: z.literal("MEDIA_UNPROCESSED"), providerMessageId: Id, senderRef: Id,
    providerSentAt: Instante.nullable(), media: z.object({ providerMediaId: Id,
      mimeType: z.string().min(1).max(120).nullable(), sizeBytes: z.number().int().nonnegative().max(25_000_000).nullable(),
      sha256: HashSha256.nullable() }).strict(),
  }).strict(),
]);
export type CanalWebhookBruto = z.infer<typeof CanalWebhookBruto>;

/** Evento individual dentro de um envelope de webhook: distingue mensagem, recibo técnico e outros eventos. */
export const StatusReciboTecnico = z.enum(["ENVIADA", "ENTREGUE", "LIDA", "FALHOU"]);
export type StatusReciboTecnico = z.infer<typeof StatusReciboTecnico>;

export const CanalEventoEnvelopeBruto = z.discriminatedUnion("categoriaEvento", [
  z.object({
    categoriaEvento: z.literal("MENSAGEM"),
    mensagem: CanalWebhookBruto,
  }).strict(),
  z.object({
    categoriaEvento: z.literal("RECIBO_TECNICO"),
    providerMessageId: Id,
    statusRecibo: StatusReciboTecnico,
    ocorreuEm: Instante,
    recipientRef: Id.nullable(),
  }).strict(),
  z.object({
    categoriaEvento: z.literal("OUTRO_EVENTO"),
    eventoId: Id,
    tipoEvento: z.string().min(1).max(120),
    ocorreuEm: Instante.nullable(),
  }).strict(),
]);
export type CanalEventoEnvelopeBruto = z.infer<typeof CanalEventoEnvelopeBruto>;

export const CanalEnvelopeWebhookBruto = z.object({
  envelopeId: Id,
  enviadoEm: Instante.nullable(),
  accountRef: Id.optional(),
  eventos: z.array(CanalEventoEnvelopeBruto).min(1).max(50),
}).strict();
export type CanalEnvelopeWebhookBruto = z.infer<typeof CanalEnvelopeWebhookBruto>;

/** Checkpoint IMAP por conta + mailbox + UIDVALIDITY + UID (nunca timestamp, sequência ou Message-ID isolado). */
export const EstadoReconciliacaoImap = z.enum(["INTEGRO", "RECONCILIACAO_UIDVALIDITY_NECESSARIA"]);
export type EstadoReconciliacaoImap = z.infer<typeof EstadoReconciliacaoImap>;

export const CheckpointImapCanal = z.object({
  accountId: Id,
  mailbox: Id,
  uidValidity: z.number().int().positive(),
  lastUid: z.number().int().nonnegative(),
  estadoReconciliacao: EstadoReconciliacaoImap,
  atualizadoEm: Instante,
}).strict();
export type CheckpointImapCanal = z.infer<typeof CheckpointImapCanal>;

/**
 * Carimbo interno emitido pelo adaptador somente depois de autenticar a conta e validar a assinatura.
 * Zod valida o formato, não verifica HMAC; o segredo/verificador não pertence ao payload nem ao contrato.
 */
export const ProvaAutenticacaoCanal = z.discriminatedUnion("metodo", [
  z.object({ metodo: z.literal("WEBHOOK_HMAC_SHA256"), verificada: z.literal(true), keyId: Id,
    payloadSha256: HashSha256, verificadoEm: Instante }).strict(),
  z.object({ metodo: z.literal("IMAP_CONTA_LOCAL"), verificada: z.literal(true), mailboxId: Id,
    snapshotSha256: HashSha256, verificadoEm: Instante }).strict(),
]);
export type ProvaAutenticacaoCanal = z.infer<typeof ProvaAutenticacaoCanal>;

/** Identidade confiável da conta vem da configuração autenticada no servidor, nunca do DTO bruto. */
export const CanalContaAutenticada = z.object({
  accountId: Id,
  canal: CanalFonte,
  autenticacao: ProvaAutenticacaoCanal,
}).strict().superRefine((conta, ctx) => {
  if (conta.canal === "WHATSAPP_SERVICO" && conta.autenticacao.metodo !== "WEBHOOK_HMAC_SHA256")
    ctx.addIssue({ code: "custom", path: ["autenticacao", "metodo"], message: "WhatsApp exige HMAC verificado" });
  if (conta.canal === "EMAIL" && conta.autenticacao.metodo !== "IMAP_CONTA_LOCAL")
    ctx.addIssue({ code: "custom", path: ["autenticacao", "metodo"], message: "e-mail exige conta IMAP local" });
});
export type CanalContaAutenticada = z.infer<typeof CanalContaAutenticada>;

/** União emitida pelo adaptador após verificar prova e carregar accountId da configuração local. */
export const CanalEntradaAutenticada = z.object({
  conta: CanalContaAutenticada,
  mensagem: CanalWebhookBruto,
  ingestedAt: Instante,
}).strict();
export type CanalEntradaAutenticada = z.infer<typeof CanalEntradaAutenticada>;

export const EstadoVinculoContatoEntrada = z.enum(["CONTATO_EXATO", "PENDENTE", "CONFLITO", "REVOGADO"]);
export type EstadoVinculoContatoEntrada = z.infer<typeof EstadoVinculoContatoEntrada>;

export const VinculoContatoEntrada = z.discriminatedUnion("estado", [
  z.object({ estado: z.literal("CONTATO_EXATO"), contatoId: Id, sourceEventId: Id }).strict(),
  z.object({ estado: z.literal("PENDENTE"), contatoId: z.null(), candidatosContatoId: z.array(Id).max(100) }).strict(),
  z.object({ estado: z.literal("CONFLITO"), contatoId: z.null(), candidatosContatoId: z.array(Id).min(2).max(100) }).strict(),
  z.object({ estado: z.literal("REVOGADO"), contatoId: Id, sourceEventId: Id }).strict(),
]);
export type VinculoContatoEntrada = z.infer<typeof VinculoContatoEntrada>;

const CanalConteudoPersistido = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("TEXT"), texto: TextoMensagem, contentSha256: HashSha256 }).strict(),
  z.object({ tipo: z.literal("MEDIA_UNPROCESSED"), processamento: z.literal("NAO_PROCESSADA"),
    providerMediaId: Id, mimeType: z.string().min(1).max(120).nullable(), sizeBytes: z.number().int().nonnegative().max(25_000_000).nullable(),
    contentSha256: HashSha256.nullable() }).strict(),
]);

/** Entrada já autenticada, pronta para persistir localmente antes de devolver ACK. */
export const CanalMensagemEntrada = z.object({
  schema: z.literal("CanalMensagemEntrada@1"), accountId: Id, canal: CanalFonte,
  providerMessageId: Id, senderRef: Id, providerSentAt: Instante.nullable(), ingestedAt: Instante,
  payloadSha256: HashSha256, autenticacao: ProvaAutenticacaoCanal,
  vinculoContato: VinculoContatoEntrada, conteudo: CanalConteudoPersistido,
}).strict().superRefine((mensagem, ctx) => {
  if (mensagem.canal === "WHATSAPP_SERVICO" && mensagem.autenticacao.metodo !== "WEBHOOK_HMAC_SHA256")
    ctx.addIssue({ code: "custom", path: ["autenticacao", "metodo"], message: "WhatsApp exige HMAC verificado" });
  if (mensagem.canal === "EMAIL" && mensagem.autenticacao.metodo !== "IMAP_CONTA_LOCAL")
    ctx.addIssue({ code: "custom", path: ["autenticacao", "metodo"], message: "e-mail exige conta IMAP local" });
});
export type CanalMensagemEntrada = z.infer<typeof CanalMensagemEntrada>;

/** Chave de dedupe é composta; providerMessageId não é global entre contas. */
export const ChaveIdempotenciaCanal = z.object({ accountId: Id, providerMessageId: Id }).strict();
export type ChaveIdempotenciaCanal = z.infer<typeof ChaveIdempotenciaCanal>;

/** ACK admissível apenas após persistência; conflito de replay não aceita o conteúdo divergente. */
export const AckCanalPersistido = z.discriminatedUnion("resultado", [
  z.object({ resultado: z.literal("RECEBIDA"), persistida: z.literal(true), reciboId: Id,
    chave: ChaveIdempotenciaCanal, payloadSha256: HashSha256 }).strict(),
  z.object({ resultado: z.literal("REPLAY"), persistida: z.literal(true), reciboId: Id,
    chave: ChaveIdempotenciaCanal, payloadSha256: HashSha256 }).strict(),
  z.object({ resultado: z.literal("CONFLITO_REPLAY"), persistida: z.literal(false), reciboId: Id,
    chave: ChaveIdempotenciaCanal, payloadSha256Recebido: HashSha256, payloadSha256Persistido: HashSha256 }).strict(),
]).superRefine((ack, ctx) => {
  if (ack.resultado === "CONFLITO_REPLAY" && ack.payloadSha256Recebido === ack.payloadSha256Persistido)
    ctx.addIssue({ code: "custom", path: ["payloadSha256Recebido"], message: "CONFLITO_REPLAY exige hashes divergentes" });
});
export type AckCanalPersistido = z.infer<typeof AckCanalPersistido>;

/** Consentimento explícito do canal (A10). Recebimento nunca gera TERMO_ACEITO automaticamente. */
export const EstadoConsentimentoCanal = z.enum(["NAO_AVALIADO", "TERMO_ACEITO", "REVOGADO"]);
export type EstadoConsentimentoCanal = z.infer<typeof EstadoConsentimentoCanal>;

export const FinalidadeConsentimentoCanal = z.enum(["COMUNICACAO_CLINICA", "ORIENTACAO_GERAL", "AVISO_RETORNO"]);
export type FinalidadeConsentimentoCanal = z.infer<typeof FinalidadeConsentimentoCanal>;

export const OrigemConsentimentoCanal = z.enum([
  "PRESENCIAL_CONSULTORIO",
  "TERMO_ASSINADO_LOCAL",
  "REVOGACAO_PACIENTE",
  "REVOGACAO_MEDICO",
]);
export type OrigemConsentimentoCanal = z.infer<typeof OrigemConsentimentoCanal>;

export const ConsentimentoCanal = z.object({
  contatoId: Id,
  patientId: Id.nullable(),
  estado: EstadoConsentimentoCanal,
  referenciaTermo: Id.nullable(),
  versaoTermo: Id.nullable(),
  registradoEm: Instante.nullable(),
  revogadoEm: Instante.nullable(),
  finalidade: z.array(FinalidadeConsentimentoCanal).max(3),
  origem: OrigemConsentimentoCanal.nullable(),
  ator: z.object({ tipo: z.literal("SESSAO"), id: Id }).strict().nullable(),
}).strict().superRefine((c, ctx) => {
  if (c.estado === "NAO_AVALIADO") {
    if (c.referenciaTermo !== null || c.versaoTermo !== null || c.registradoEm !== null
      || c.revogadoEm !== null || c.finalidade.length > 0 || c.origem !== null || c.ator !== null) {
      ctx.addIssue({ code: "custom", message: "NAO_AVALIADO não pode conter evidência de aceite" });
    }
  }
  if (c.estado === "TERMO_ACEITO") {
    if (!c.referenciaTermo || !c.versaoTermo || !c.registradoEm || c.revogadoEm !== null
      || c.finalidade.length === 0 || !c.origem || !c.ator
      || (c.origem !== "PRESENCIAL_CONSULTORIO" && c.origem !== "TERMO_ASSINADO_LOCAL")) {
      ctx.addIssue({ code: "custom", message: "TERMO_ACEITO exige referência, versão, data, finalidade, origem de aceite e ator de sessão" });
    }
  }
  if (c.estado === "REVOGADO") {
    if (!c.revogadoEm || !c.origem || !c.ator
      || (c.origem !== "REVOGACAO_PACIENTE" && c.origem !== "REVOGACAO_MEDICO")) {
      ctx.addIssue({ code: "custom", message: "REVOGADO exige data de revogação, origem de revogação e ator" });
    }
  }
});
export type ConsentimentoCanal = z.infer<typeof ConsentimentoCanal>;

/** Registro de janela sem cobertura local (contingência; nunca inventa mensagens perdidas). */
export const JanelaIndisponibilidadeCanal = z.object({
  janelaId: Id,
  accountId: Id,
  inicioEm: Instante,
  fimEm: Instante.nullable(),
  motivo: z.string().min(1).max(500),
  registradoEm: Instante,
  mensagensPerdidasInventadas: z.literal(0),
}).strict().superRefine((j, ctx) => {
  if (j.fimEm !== null && Date.parse(j.fimEm) < Date.parse(j.inicioEm)) {
    ctx.addIssue({ code: "custom", path: ["fimEm"], message: "fimEm anterior a inicioEm" });
  }
});
export type JanelaIndisponibilidadeCanal = z.infer<typeof JanelaIndisponibilidadeCanal>;

/** Estado de conversa legado preservado, fora do ciclo de recibos de transporte. */
export const EstadoConversaCanal = EstadoConversa;
