import { z } from "zod";
import { Instante } from "../base.js";
import { EstadoConversa } from "../estados.js";
import { CanalFonte, EstadoReciboCanal, EstadoVinculoContatoEntrada } from "./canalEntrada.js";

const Id = z.string().min(1).max(250).refine((v) => v.trim().length > 0 && v === v.trim() && !/[\u0000-\u001f]/.test(v), "identificador inválido");
const HashSha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const FRASE_FINAL_D_W9_75 = "Nada substitui a avaliação presencial do seu médico.";

export const TipoRespostaCanal = z.enum([
  "RESPOSTA_LIVRE_MEDICA",
  "ORIENTACAO_GERAL_CENARIO",
  "ACUSO_RECEBIMENTO_TECNICO",
]);
export type TipoRespostaCanal = z.infer<typeof TipoRespostaCanal>;

export const ContextoRespostaCanal = z.object({
  patientId: Id,
  encounterId: Id,
  tumorLotId: Id.nullable(),
  revisaoContexto: Id,
}).strict();
export type ContextoRespostaCanal = z.infer<typeof ContextoRespostaCanal>;

/** Rascunho exibido ao médico antes da confirmação: mostra destinatário, conteúdo e contexto. */
export const RascunhoRespostaCanal = z.object({
  respostaId: Id,
  versao: z.number().int().positive(),
  mensagemOrigemId: Id,
  accountId: Id,
  canal: CanalFonte,
  contatoId: Id,
  destinatario: Id,
  contexto: ContextoRespostaCanal,
  tipoResposta: TipoRespostaCanal,
  cenarioId: Id.nullable(),
  statusCuradoriaCenario: z.enum(["CONFERIDA_MEDICO", "RASCUNHO"]).nullable(),
  texto: z.string().min(1).max(10_000),
  conteudoSha256: HashSha256,
  exibidoEm: Instante,
  confirmadoPeloMedico: z.boolean(),
  confirmadoPorMedicoId: Id.nullable(),
  confirmadoPorCrm: Id.nullable(),
  confirmadoEm: Instante.nullable(),
}).strict();
export type RascunhoRespostaCanal = z.infer<typeof RascunhoRespostaCanal>;

/**
 * Registro de autorização específica no servidor para saída pelo Action Gateway (S-F2-03).
 * Vincula operação, contato, destinatário, consentimento vigente, contexto e conteúdo aprovado.
 */
export const AutorizacaoRespostaCanalServidor = z.object({
  respostaId: Id,
  versao: z.number().int().positive(),
  mensagemOrigemId: Id,
  accountId: Id,
  canal: CanalFonte,
  verboPermitido: z.enum(["ENVIAR_WHATSAPP", "ENVIAR_EMAIL"]),
  contatoId: Id,
  destinatarioCanonico: Id,
  contexto: ContextoRespostaCanal,
  consentimento: z.object({
    estado: z.literal("TERMO_ACEITO"),
    eventoId: Id.optional(), // Legados são legíveis, mas exigem nova confirmação antes de enviar.
    referenciaTermo: Id,
    versaoTermo: Id,
    registradoEm: Instante,
  }).strict(),
  tipoResposta: TipoRespostaCanal,
  textoAprovado: z.string().min(1).max(10_000),
  conteudoSha256: HashSha256,
  aprovadoPor: z.object({
    medicoId: Id,
    crm: Id,
    em: Instante,
  }).strict(),
  invalidadaPorMudancaDeContexto: z.boolean(),
}).strict();
export type AutorizacaoRespostaCanalServidor = z.infer<typeof AutorizacaoRespostaCanalServidor>;

/** Estado operacional da mensagem/conversa, separando recibo técnico de estado clínico/conversa. */
export const EstadoOperacionalMensagemCanal = z.object({
  mensagemId: Id,
  reciboTecnico: EstadoReciboCanal,
  estadoConversa: EstadoConversa,
  acusoRecebimentoEnviado: z.boolean(),
  conversaEncerradaPorAcuso: z.literal(false),
  atendimentoClinicoComprovadoPorRecibo: z.literal(false),
  condutaClinicaExecutadaPorEnvio: z.literal(false),
}).strict();
export type EstadoOperacionalMensagemCanal = z.infer<typeof EstadoOperacionalMensagemCanal>;

/** Mensagem original acessível a partir do ContactSummary na pré-consulta e no cabeçalho. */
export const MensagemOriginalResumoCanal = z.object({
  mensagemId: Id,
  providerMessageId: Id,
  canal: CanalFonte,
  senderRef: Id,
  providerSentAt: Instante.nullable(),
  ingestedAt: Instante,
  novaDesdeUltimaConsulta: z.boolean(),
  reciboTecnico: EstadoReciboCanal,
  conteudoResumo: z.string().min(1).max(1000),
  midia: z.object({
    providerMediaId: Id,
    mimeType: z.string().min(1).max(120).nullable(),
    processamento: z.enum(["NAO_PROCESSADA", "LIDA_LOCALMENTE"]),
    sha256LocalComprovado: HashSha256.nullable(),
  }).strict().nullable(),
}).strict();
export type MensagemOriginalResumoCanal = z.infer<typeof MensagemOriginalResumoCanal>;

export const ResumoContatoIntegradoPreConsulta = z.object({
  contatoId: Id,
  patientId: Id.nullable(),
  canal: CanalFonte,
  estadoVinculo: EstadoVinculoContatoEntrada,
  quantidadeTotalMensagens: z.number().int().nonnegative(),
  quantidadeNovasDesdeUltimaConsulta: z.number().int().nonnegative(),
  ultimaMensagemEm: Instante.nullable(),
  resumoTexto: z.string().min(1).max(500),
  mensagensOriginaisIds: z.array(Id),
  mensagensOriginais: z.array(MensagemOriginalResumoCanal),
  revisaoEntradaHash: HashSha256,
}).strict();
export type ResumoContatoIntegradoPreConsulta = z.infer<typeof ResumoContatoIntegradoPreConsulta>;
