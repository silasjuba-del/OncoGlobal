import { z } from "zod";
import { Id, Instante } from "./base.js";

export const ProvenienciaCitacaoBrainSchema = z.object({
  sourceId: Id,
  versao: z.string().min(1).max(120),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  trecho: z.string().min(1).max(4000),
  localizador: z.string().min(1).max(240).nullable(),
}).strict();

export const InclusaoMesaBrainSchema = z.object({
  referenciaId: Id,
  versao: z.string().min(1).max(120),
  motivoInclusao: z.string().min(1).max(500),
  trechoCitado: z.string().min(1).max(4000),
}).strict();

export const ExclusaoReferenciaBrainSchema = z.object({
  referenciaId: Id,
  versao: z.string().min(1).max(120),
  motivoCodigo: z.enum([
    "FORA_DO_ESCOPO_CLINICO",
    "STATUS_NAO_CONSULTAVEL",
    "PROVENIENCIA_INCOMPLETA",
    "SEM_CORRESPONDENCIA_NA_FONTE",
    "DUPLICADA_POR_VERSAO_SUPERIOR",
  ]),
  detalhe: z.string().min(1).max(500),
}).strict();

export const CandidatoAmbiguidadeBrainSchema = z.object({
  valor: z.union([z.string(), z.number()]),
  unidade: z.string().min(1).max(60).nullable(),
  qualificador: z.enum(["AFIRMADO", "NEGADO", "INCERTO", "HISTORICO", "TERCEIRO"]),
  citacao: ProvenienciaCitacaoBrainSchema,
}).strict();

export const AmbiguidadeBrainSchema = z.object({
  campo: z.string().min(1).max(120),
  motivo: z.string().min(1).max(500),
  candidatos: z.array(CandidatoAmbiguidadeBrainSchema).min(2),
  valorEscolhido: z.null(),
  escolhaSilenciosa: z.literal(false),
}).strict();

export const LacunaBrainSchema = z.object({
  campo: z.string().min(1).max(120),
  obrigatoriedade: z.enum(["CRITICA", "RELEVANTE"]),
  motivo: z.string().min(1).max(500),
  valorPreenchido: z.null(),
}).strict();

export const ItemPropostoBrainSchema = z.object({
  itemId: Id,
  campo: z.string().min(1).max(120),
  valorProposto: z.union([z.string(), z.number()]),
  unidade: z.string().min(1).max(60).nullable(),
  qualificador: z.enum(["AFIRMADO", "NEGADO", "INCERTO", "HISTORICO", "TERCEIRO"]),
  criticoNumero: z.boolean(),
  validado: z.literal(false),
  requerConfirmacaoMedica: z.literal(true),
  citacoes: z.array(ProvenienciaCitacaoBrainSchema).min(1),
}).strict();

export const PropostaBrainOsSchema = z.object({
  schema: z.literal("BrainOsProposta@1"),
  propostaId: Id,
  patientId: Id.nullable(),
  encounterId: Id.nullable(),
  geradoEm: Instante,
  possuiCredenciais: z.literal(false),
  possuiEscritaClinica: z.literal(false),
  itensPropostos: z.array(ItemPropostoBrainSchema),
  inclusoesMesa: z.array(InclusaoMesaBrainSchema),
  referenciasExcluidas: z.array(ExclusaoReferenciaBrainSchema),
  ambiguidades: z.array(AmbiguidadeBrainSchema),
  lacunas: z.array(LacunaBrainSchema),
}).strict();

export type ProvenienciaCitacaoBrain = z.infer<typeof ProvenienciaCitacaoBrainSchema>;
export type InclusaoMesaBrain = z.infer<typeof InclusaoMesaBrainSchema>;
export type ExclusaoReferenciaBrain = z.infer<typeof ExclusaoReferenciaBrainSchema>;
export type AmbiguidadeBrain = z.infer<typeof AmbiguidadeBrainSchema>;
export type LacunaBrain = z.infer<typeof LacunaBrainSchema>;
export type ItemPropostoBrain = z.infer<typeof ItemPropostoBrainSchema>;
export type PropostaBrainOs = z.infer<typeof PropostaBrainOsSchema>;
