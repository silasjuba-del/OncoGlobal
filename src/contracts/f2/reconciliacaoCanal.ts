import { z } from "zod";
import { Instante } from "../base.js";
import { CanalFonte } from "./canalEntrada.js";

const Id = z.string().min(1).max(250).refine((v) => v.trim().length > 0 && v === v.trim() && !/[\u0000-\u001f]/.test(v), "identificador inválido");

export const CategoriaContatoCanal = z.enum([
  "SINTOMA_INTERCORRENCIA",
  "DUVIDA_ORIENTACAO",
  "ENVIO_EXAME_DOCUMENTO",
  "ADMINISTRATIVO_RETORNO",
  "INDEFINIDO",
]);
export type CategoriaContatoCanal = z.infer<typeof CategoriaContatoCanal>;

export const AutorRelatoCanal = z.enum(["PACIENTE", "FAMILIAR", "CUIDADOR", "DESCONHECIDO"]);
export type AutorRelatoCanal = z.infer<typeof AutorRelatoCanal>;

export const PolaridadeMencaoCanal = z.enum(["AFIRMADO", "NEGADO", "HIPOTESE_DUVIDA"]);
export type PolaridadeMencaoCanal = z.infer<typeof PolaridadeMencaoCanal>;

export const TemporalidadeRelatoCanal = z.enum(["ATUAL", "PASSADO", "FUTURO_DUVIDA", "NAO_INFORMADO"]);
export type TemporalidadeRelatoCanal = z.infer<typeof TemporalidadeRelatoCanal>;

export const MencaoClinicaCanal = z.object({
  termo: z.string().min(1).max(160),
  polaridade: PolaridadeMencaoCanal,
  temporalidade: TemporalidadeRelatoCanal,
  trechoOriginal: z.string().min(1).max(1000),
  temperaturaDecimos: z.number().int().min(350).max(430).nullable(),
}).strict();
export type MencaoClinicaCanal = z.infer<typeof MencaoClinicaCanal>;

/** Proposta vinda de LLM (quando usada): só aceita campos estritos sobre texto já desidentificado. */
export const PropostaClassificacaoLlmBrutaSchema = z.object({
  categoria: CategoriaContatoCanal,
  autorRelato: AutorRelatoCanal,
  momentoClinicoRelatado: z.object({
    temporalidade: TemporalidadeRelatoCanal,
    trechoTemporal: z.string().min(1).max(250).nullable(),
  }).strict(),
  mencoes: z.array(MencaoClinicaCanal).max(50),
}).strict();
export type PropostaClassificacaoLlmBruta = z.infer<typeof PropostaClassificacaoLlmBrutaSchema>;

export const PropostaClassificacaoCanal = z.object({
  schema: z.literal("PropostaClassificacaoCanal@1"),
  modoClassificacao: z.enum(["DETERMINISTICO_LOCAL", "LLM_DESIDENTIFICADO_VALIDADO"]),
  categoria: CategoriaContatoCanal,
  autorRelato: AutorRelatoCanal,
  origemCanal: CanalFonte,
  instanteMensagem: z.object({
    providerSentAt: Instante.nullable(),
    ingestedAt: Instante,
  }).strict(),
  momentoClinicoRelatado: z.object({
    temporalidade: TemporalidadeRelatoCanal,
    trechoTemporal: z.string().min(1).max(250).nullable(),
  }).strict(),
  mencoes: z.array(MencaoClinicaCanal).max(50),
  textoDesidentificadoEnviadoLlm: z.string().max(250_000).nullable(),
  phiEgressPassou: z.boolean(),
}).strict();
export type PropostaClassificacaoCanal = z.infer<typeof PropostaClassificacaoCanal>;

export const AlarmeConferidoAtivo = z.object({
  regraId: Id,
  codigo: Id,
  termo: z.string().min(1).max(160),
  alvo: z.enum(["PACIENTE", "CONTATO_NAO_VINCULADO"]),
  orientacaoGeral: z.string().min(1).max(2000).nullable(),
  exigeAvaliacaoPresencial: z.literal(true),
  rulesetVersao: Id,
}).strict();
export type AlarmeConferidoAtivo = z.infer<typeof AlarmeConferidoAtivo>;

export const AvaliacaoAlarmeCanal = z.object({
  estadoRegras: z.enum(["CONFERIDA_ATIVA", "PENDENTE_CURADORIA_MEDICA", "RULESET_INDISPONIVEL"]),
  rulesetVersao: z.string().min(1).max(120),
  alarmesAtivos: z.array(AlarmeConferidoAtivo).max(50),
  candidatosRascunhoNaoAtivados: z.array(Id).max(50),
  negadosOuPassadoOuDuvidaNaoDisparam: z.array(z.string().min(1).max(160)).max(50),
}).strict().superRefine((av, ctx) => {
  if (av.estadoRegras !== "CONFERIDA_ATIVA" && av.alarmesAtivos.length > 0) {
    ctx.addIssue({ code: "custom", path: ["alarmesAtivos"], message: "regras em RASCUNHO ou indisponíveis nunca ativam alarmes" });
  }
});
export type AvaliacaoAlarmeCanal = z.infer<typeof AvaliacaoAlarmeCanal>;

export const ConflitoRelatoCanal = z.object({
  termo: z.string().min(1).max(160),
  motivo: z.string().min(1).max(500),
  mensagensEnvolvidasIds: z.array(Id).min(1).max(20),
  trechos: z.array(z.string().min(1).max(1000)).min(2).max(20),
}).strict();
export type ConflitoRelatoCanal = z.infer<typeof ConflitoRelatoCanal>;

export const VinculoReconciliadoCanal = z.object({
  estado: z.enum(["VINCULADO", "FILA_REVISAO", "AMBIGUO", "REVOGADO"]),
  patientId: Id.nullable(),
  candidatosPatientId: z.array(Id).max(100),
  motivo: z.string().min(1).max(500),
}).strict().superRefine((v, ctx) => {
  if (v.estado === "VINCULADO" && !v.patientId) {
    ctx.addIssue({ code: "custom", path: ["patientId"], message: "VINCULADO exige patientId único" });
  }
  if (v.estado !== "VINCULADO" && v.patientId !== null) {
    ctx.addIssue({ code: "custom", path: ["patientId"], message: "contato não vinculado/ambíguo/revogado não pode ter patientId" });
  }
});
export type VinculoReconciliadoCanal = z.infer<typeof VinculoReconciliadoCanal>;

/**
 * Saída consolidada da S-F2-02: relato do paciente/contato preservado e separado de fato clínico confirmado.
 * Nunca transforma classificação em diagnóstico, prescrição ou assinatura.
 */
export const ReconciliacaoClinicaCanal = z.object({
  schema: z.literal("ReconciliacaoClinicaCanal@1"),
  mensagemId: Id,
  accountId: Id,
  senderRef: Id,
  vinculo: VinculoReconciliadoCanal,
  classificacao: PropostaClassificacaoCanal,
  alarmes: AvaliacaoAlarmeCanal,
  conflitosRelato: z.array(ConflitoRelatoCanal).max(50),
  naturezaEvidencia: z.literal("RELATO_CANAL_NAO_CONFIRMADO"),
  revisao: z.literal("REVISAR"),
  diagnostico: z.literal(false),
  prescricao: z.literal(false),
  assinatura: z.literal(false),
  avaliadoEm: Instante,
}).strict();
export type ReconciliacaoClinicaCanal = z.infer<typeof ReconciliacaoClinicaCanal>;
