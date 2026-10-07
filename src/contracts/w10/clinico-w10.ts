// W10 · Triagem extra, caixas numeradas/glossário, antiglosa e timeline longitudinal.
// D-W9-17/19/37/38 · RAIZ CANÔNICA §4 (MEMORY_OS).
import { z } from "zod";
import { DataCivil, Id, Instante } from "../base.js";

/** Sinais que a C-08 não tem (D-W9-37). null = PENDENTE, nunca 0. Inteiros nas bordas (K-10). */
export const TriagemExtraW10 = z.object({
  pad: z.number().int().nullable(), // mmHg
  crCentesimos: z.number().int().nullable(), // 150 = 1,50 mg/dL
}).strict();
export type TriagemExtraW10 = z.infer<typeof TriagemExtraW10>;

/** D-W9-17 · toda caixa editável tem número estável e entrada no glossário. */
export const CaixaNumerada = z.object({
  numero: z.number().int().positive(),
  chave: z.string().min(1), // ex.: "configuracoes.cnes"
  nome: z.string().min(1),
  significado: z.string().min(1),
  ondeAparece: z.array(z.string().min(1)).min(1),
  tipo: z.enum(["TEXTO", "NUMERO", "DATA", "BOOLEANO", "LISTA", "REGRA_CLINICA"]),
  editavelPor: z.enum(["MEDICO", "SISTEMA"]),
}).strict();
export type CaixaNumerada = z.infer<typeof CaixaNumerada>;

/** Alteração de caixa = evento versionado; regra clínica alterada vale como DECISAO_MEDICA. */
export const AlteracaoCaixa = z.object({
  numero: z.number().int().positive(),
  valorAnterior: z.unknown(),
  valorNovo: z.unknown(),
  por: Id,
  em: Instante,
  motivo: z.string().min(1).nullable(),
}).strict();
export type AlteracaoCaixa = z.infer<typeof AlteracaoCaixa>;

/** D-W9-19 · antiglosa: código checa antes do faturamento; alerta o médico, bloqueia só a exportação. */
export const AchadoAntiglosa = z.object({
  regraId: z.string().min(1),
  caixaNumero: z.number().int().positive().nullable(),
  severidade: z.enum(["ALERTA", "BLOQUEIA_EXPORTACAO"]),
  motivo: z.string().min(1),
  fonte: z.string().min(1), // SIGTAP competência, portaria, decisão
}).strict();
export type AchadoAntiglosa = z.infer<typeof AchadoAntiglosa>;

export const VereditoAntiglosa = z.object({
  apacId: Id,
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  achados: z.array(AchadoAntiglosa),
  exportavel: z.boolean(), // false se houver qualquer BLOQUEIA_EXPORTACAO
}).strict().superRefine((v, ctx) => {
  const bloqueia = v.achados.some((a) => a.severidade === "BLOQUEIA_EXPORTACAO");
  if (bloqueia && v.exportavel) ctx.addIssue({ code: "custom", message: "achado bloqueante impede exportação" });
});
export type VereditoAntiglosa = z.infer<typeof VereditoAntiglosa>;

/** TNM é histórico imutável: cada avaliação é uma entrada (A3, D-W9-07). */
export const StageEntry = z.object({
  tipo: z.enum(["CLINICO", "PATOLOGICO", "POS_TRATAMENTO"]),
  valor: z.string().min(1), // literal da fonte, com prefixo (cT2 cN1 cM0, ypT2N1a…)
  sistema: z.string().min(1), // "AJCC 8", "AJCC 9", "FIGO 2018"…
  data: DataCivil.nullable(),
  sourceId: Id,
}).strict();
export type StageEntry = z.infer<typeof StageEntry>;

export const StatusTratamento = z.enum(["PROPOSTO", "PRESCRITO", "ADMINISTRADO", "SUSPENSO_ADIADO", "CONCLUIDO"]);
export type StatusTratamento = z.infer<typeof StatusTratamento>;

export const TreatmentEntry = z.object({
  regimen: z.string().min(1),
  templateId: Id.nullable(),
  intent: z.string().nullable(), // intenção clínica ≠ finalidade APAC (D-W9-12)
  line: z.number().int().positive().nullable(),
  cycle: z.number().int().positive().nullable(),
  status: StatusTratamento,
  em: DataCivil.nullable(),
  sourceIds: z.array(Id),
}).strict();
export type TreatmentEntry = z.infer<typeof TreatmentEntry>;

/** RECIST longitudinal (RAIZ §4): cálculo por código; categoria nasce PROPOSTA. */
export const RecistAvaliacao = z.object({
  data: DataCivil,
  somaMm: z.number().min(0),
  baselineMm: z.number().min(0),
  nadirMm: z.number().min(0),
  deltaBaselinePct: z.number(),
  deltaNadirPct: z.number(),
  deltaNadirMm: z.number(),
  novasLesoes: z.boolean().nullable(),
  categoria: z.enum(["RC", "RP", "DE", "PD"]).nullable(),
  revisao: z.enum(["PROPOSTO", "CONFIRMADO"]),
}).strict();
export type RecistAvaliacao = z.infer<typeof RecistAvaliacao>;

/** Projeção longitudinal do paciente (Anexo A do pipeline). */
export const PatientTimeline = z.object({
  patientId: Id,
  stageHistory: z.array(StageEntry),
  historicalMetastaticDisease: z.boolean(), // uma vez true, nunca volta a false
  treatments: z.array(TreatmentEntry),
  recist: z.array(RecistAvaliacao),
  missingRequiredData: z.array(z.string().min(1)),
  unresolvedConflicts: z.array(Id), // ids de ReviewException
}).strict().superRefine((t, ctx) => {
  // RT-10b: M1 registrado em qualquer avaliação ⇒ doença metastática histórica (nunca false).
  if (t.stageHistory.some((e) => /M1/i.test(e.valor)) && !t.historicalMetastaticDisease)
    ctx.addIssue({ code: "custom", message: "stageHistory com M1 exige historicalMetastaticDisease = true" });
});
export type PatientTimeline = z.infer<typeof PatientTimeline>;

/** RT-10b · monotonicidade entre versões da projeção: true nunca volta a false. Chamar no ponto de gravação. */
export function validarMonotonicidade(anterior: PatientTimeline, novo: PatientTimeline): boolean {
  return !(anterior.historicalMetastaticDisease && !novo.historicalMetastaticDisease);
}

/** Finalidades APAC de RADIOTERAPIA (Portaria SAES/MS 470/2021, Anexo II; D-W9-12). QT segue em `FinalidadeApac` (estados.ts).
 * O médico escolhe; nunca é deduzida da intenção clínica. */
export const FinalidadeApacRt = z.enum(["RADICAL", "ADJUVANTE", "ANTIALGICA", "PALIATIVA", "PREVIA", "ANTI_HEMORRAGICA"]);
export type FinalidadeApacRt = z.infer<typeof FinalidadeApacRt>;
