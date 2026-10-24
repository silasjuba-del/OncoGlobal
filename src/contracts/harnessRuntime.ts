import { z } from "zod";
import { Id } from "./base.js";

export const ModalidadeFonteOriginalSchema = z.enum(["DOCUMENTO", "TEXTO", "AUDIO"]);

export const FonteOriginalPreservadaSchema = z.object({
  sourceId: Id,
  versao: z.string().min(1).max(120),
  modalidade: ModalidadeFonteOriginalSchema,
  conteudoOriginal: z.string().nullable(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  localizadores: z.array(z.object({ localizador: z.string().min(1).max(240), trecho: z.string().min(1) }).strict()).optional(),
  trechoAudioConferidoHumano: z.boolean().optional(),
  identidadeEsperadaPaciente: z.object({
    patientId: Id,
    nome: z.string().min(1).max(200),
    identificadores: z.array(z.object({
      tipo: z.enum(["CPF", "CNS"]),
      valor: z.string().min(1).max(40),
    }).strict()),
  }).strict().optional(),
}).strict();

export const ManifestacaoHarnessRuntimeSchema = z.object({
  tipo: z.enum([
    "CONFLITO",
    "AMBIGUIDADE",
    "OMISSAO_CRITICA",
    "FALHA_IDENTIDADE",
    "CITACAO_NAO_SUSTENTADA",
    "QUALIFICADOR_DIVERGENTE",
    "NORMALIZACAO_DIVERGENTE",
    "VALOR_CRITICO_PRE_VALIDADO",
  ]),
  campo: z.string().min(1).max(120),
  sourceId: Id.nullable(),
  detalhe: z.string().min(1).max(600),
  trechoOriginal: z.string().max(4000).nullable(),
}).strict();

export const ItemVerificadoHarnessSchema = z.object({
  itemId: Id,
  campo: z.string().min(1).max(120),
  valorSubmetido: z.union([z.string(), z.number()]),
  citacaoSustentadaNaFonte: z.boolean(),
  qualificadorSubmetido: z.enum(["AFIRMADO", "NEGADO", "INCERTO", "HISTORICO", "TERCEIRO"]),
  qualificadorDeterministico: z.enum(["AFIRMADO", "NEGADO", "INCERTO", "HISTORICO", "TERCEIRO"]).nullable(),
  qualificadorConfere: z.boolean(),
  verificacaoDeterministicaIndependenteOk: z.boolean(),
  criticoNumero: z.boolean(),
  modalidadeAudio: z.boolean(),
  validado: z.literal(false),
  destacadoParaEscutaRevisaoHumana: z.boolean(),
}).strict();

export const VereditoHarnessRuntimeSchema = z.object({
  schema: z.literal("HarnessRuntimeVeredito@1"),
  propostaId: Id,
  tratadaComoFonteDeVerdade: z.literal(false),
  corrigidoSilenciosamente: z.literal(false),
  decisaoClinicaTomada: z.literal(false),
  cobertura: z.enum(["VERIFICADA", "COBERTURA_NAO_VERIFICADA", "PARCIALMENTE_VERIFICADA"]),
  fontesNaoVerificaveis: z.array(z.object({
    sourceId: Id,
    motivo: z.string().min(1).max(400),
  }).strict()),
  acuraciaAudioDeclarada: z.boolean(),
  status: z.enum(["APTO_PARA_REVISAO_HUMANA", "REQUER_RESOLUCAO_MEDICA", "BLOQUEADO_FALHA_CRITICA"]),
  itensVerificados: z.array(ItemVerificadoHarnessSchema),
  manifestacoes: z.array(ManifestacaoHarnessRuntimeSchema),
}).strict();

export type FonteOriginalPreservada = z.infer<typeof FonteOriginalPreservadaSchema>;
export type ManifestacaoHarnessRuntime = z.infer<typeof ManifestacaoHarnessRuntimeSchema>;
export type ItemVerificadoHarness = z.infer<typeof ItemVerificadoHarnessSchema>;
export type VereditoHarnessRuntime = z.infer<typeof VereditoHarnessRuntimeSchema>;
