import { z } from "zod";
import { Id } from "./base.js";

export const ClasseErroAvaliacaoSchema = z.enum([
  "CONTROLE_POSITIVO_SILENCIOSO",
  "VAZAMENTO_ENTRE_PACIENTES",
  "VALOR_NUMERICO_CRITICO_PRE_VALIDADO",
  "QUALIFICADOR_INVERTIDO",
  "CITACAO_NAO_SUSTENTADA",
  "CONFLITO_OCULTADO",
  "OMISSAO_CRITICA",
]);

export const MetricaClasseErroSchema = z.object({
  classeErro: ClasseErroAvaliacaoSchema,
  numeradorErros: z.number().int().nonnegative(),
  denominadorTotal: z.number().int().nonnegative(),
  taxaErro: z.number().min(0).max(1).nullable(),
  incertezaIc95: z.object({
    metodo: z.literal("WILSON_95"),
    inferior: z.number().min(0).max(1).nullable(),
    superior: z.number().min(0).max(1).nullable(),
    semiamplitude: z.number().min(0).max(1).nullable(),
  }).strict(),
}).strict();

export const ViolacaoFatalAvaliacaoSchema = z.object({
  codigo: z.enum([
    "CONTROLE_POSITIVO_SILENCIOSO",
    "VAZAMENTO_ENTRE_PACIENTES",
    "VALOR_NUMERICO_CRITICO_PRE_VALIDADO",
    "TEST_CONGELADO_USADO_PARA_CALIBRACAO",
    "TEST_CONGELADO_HASH_DIVERGENTE",
    "TEST_CONGELADO_AUSENTE",
    "EXTRATOR_NAO_VERIFICADO",
    "STUB_REPORTADO_COMO_AVALIACAO_EXTRATOR",
    "CASO_NAO_SINTETICO",
  ]),
  casoId: Id.nullable(),
  detalhe: z.string().min(1).max(600),
}).strict();

export const RelatorioHarnessAvaliacaoSchema = z.object({
  schema: z.literal("HarnessAvaliacaoRelatorio@1"),
  versaoSuite: z.string().min(1).max(120),
  versaoControlesPositivos: z.string().min(1).max(120),
  finalidadeExecucao: z.enum(["AVALIACAO", "CALIBRACAO", "AJUSTE"]),
  tipoSujeito: z.enum(["STUB", "EXTRATOR"]),
  relatorioValidoParaExtrator: z.boolean(),
  rotuloEscopoSujeito: z.enum([
    "TESTE_DO_HARNESS_POR_STUB",
    "AVALIACAO_DO_EXTRATOR",
    "INVALIDO_BLOQUEADO",
  ]),
  separacaoSplits: z.object({
    totalDev: z.number().int().nonnegative(),
    totalTestCongelado: z.number().int().nonnegative(),
    hashTestCongelado: z.string().regex(/^[0-9a-f]{64}$/),
    testCongeladoIntegro: z.boolean(),
  }).strict(),
  statusGlobal: z.enum(["APROVADO", "REPROVADO", "FALHA_FECHADA"]),
  metricasPorClasse: z.array(MetricaClasseErroSchema),
  violacoesFatais: z.array(ViolacaoFatalAvaliacaoSchema),
}).strict();

export type ClasseErroAvaliacao = z.infer<typeof ClasseErroAvaliacaoSchema>;
export type MetricaClasseErro = z.infer<typeof MetricaClasseErroSchema>;
export type ViolacaoFatalAvaliacao = z.infer<typeof ViolacaoFatalAvaliacaoSchema>;
export type RelatorioHarnessAvaliacao = z.infer<typeof RelatorioHarnessAvaliacaoSchema>;
