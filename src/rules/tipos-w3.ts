import type { ClinicalEvent } from "../contracts/operacao.js";
import type { Semaforo } from "../contracts/estados.js";
import type { TreatmentAdministration } from "../contracts/clinico.js";

export type EstadoAchado = Semaforo;

export interface Achado {
  codigo: string;
  estado: EstadoAchado;
  motivo: string;
  regraId: string;
  rulesetVersao: string;
  inputs_used: string[];
  inputs_missing: string[];
}

export interface RulesetBase {
  id: string;
  versao: string;
  ativo: boolean;
}

export interface UnidadeConversao {
  de: string;
  para: string;
  fator: number;
  regraId: string;
  fonte: string;
}

export interface LabThreshold {
  regraId: string;
  ativo: boolean;
  unidade: string;
  min?: number;
  max?: number;
}

export interface LabAnalitoRegra {
  codigo: string;
  aliases?: string[];
  threshold: LabThreshold;
  conversoes: UnidadeConversao[];
}

export interface LabRuleset extends RulesetBase {
  analitos: LabAnalitoRegra[];
}

export interface LabValor {
  codigo: string;
  valor: number;
  unidade: string;
  data?: string;
}

export interface LabValorNormalizado extends LabValor {
  valorOriginal: number;
  unidadeOriginal: string;
  convertidoPorRegraId: string | null;
}

export interface LabAlertResult extends RastreabilidadeW3 {
  rulesetVersao: string;
  achados: Achado[];
  valores_normalizados: LabValorNormalizado[];
}

export interface RadTermo {
  codigo: string;
  termo: string;
  regraId: string;
  templateId?: string;
}

export interface RadRuleset extends RulesetBase {
  termosEmergencia: RadTermo[];
}

export interface RadInput {
  tipoFonte: "TRANSCRIPTION" | "IMAGE_RAW";
  texto: string;
  data: string;
}

export interface RadAlert {
  codigo: string;
  tipo: "RED_RAD_ALERT" | "REVISAO_URGENTE";
  source_text: string;
  data: string;
  needs_physician_review: true;
  confirmado: boolean;
  achado: Achado;
}

export interface RadAlertResult extends RastreabilidadeW3 {
  rulesetVersao: string;
  alerts: RadAlert[];
  achados: Achado[];
}

export interface CanalFlagRegra {
  codigo: string;
  termos: string[];
  regraId: string;
  templateId: string | null;
}

export interface CanalRuleset extends RulesetBase {
  flags: CanalFlagRegra[];
}

export interface CanalMensagemDesidentificada {
  texto: string;
  contatoId: string;
  patientId?: string | null;
  classificadorOk: boolean;
}

export interface CanalFlag {
  codigo: string;
  alvo: "paciente" | "contato";
  templateId: string | null;
  respostaFixa: true;
  achado: Achado;
}

export interface CanalFlagResult extends RastreabilidadeW3 {
  rulesetVersao: string;
  flags: CanalFlag[];
  achados: Achado[];
}

export interface LimiteCumulativo extends RulesetBase {
  droga: string;
  unidade: "mg";
  maximo: number | null;
  regraId: string;
}

export interface AdministracaoCumulativo extends TreatmentAdministration {
  patientId: string;
  episodioId: string;
  unidadeEfetiva?: "mg" | string;
}

export interface CumulativoInput {
  patientId: string;
  episodioId: string;
  droga: string;
  administracoes: readonly AdministracaoCumulativo[];
}

export interface CumulativoResult extends RastreabilidadeW3 {
  rulesetVersao: string;
  patientId: string;
  episodioId: string;
  droga: string;
  total: number | null;
  unidade: "mg" | null;
  achado: Achado;
}

export type OperadorDeclarativo = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface CriterioDeclarativo {
  campo: string;
  operador: OperadorDeclarativo;
  valor: number | string | boolean;
  exigeBasal?: boolean;
}

export interface CtcaeTermo {
  termo: string;
  criteriosPorGrau: Record<string, CriterioDeclarativo[]>;
}

export interface CtcaeRuleset extends RulesetBase {
  ctcae_version: string;
  termos: CtcaeTermo[];
}

export interface CtcaeInput {
  termo: string;
  ctcae_version: string | null;
  medidas: Record<string, number | string | boolean | null>;
  basal?: Record<string, number | string | boolean | null>;
}

export interface CtcaeResult extends RastreabilidadeW3 {
  rulesetVersao: string;
  candidate_grade: number | null;
  achado: Achado;
}

export interface RecistRuleset extends RulesetBase {
  regraId: string;
  thresholds: {
    prPercent?: number;
    pdPercent?: number;
    pdAbsoluteMm?: number;
  };
}

export interface LesaoRecist {
  codigo: string;
  diametroMm: number;
  confirmadaPorMedico: boolean;
}

export interface RecistInput {
  lesoesAtuais: readonly LesaoRecist[];
  baseline: readonly LesaoRecist[];
  nadir: readonly LesaoRecist[];
}

export type RecistCandidate = "CR" | "PR" | "SD" | "PD";

export interface RecistResult extends RastreabilidadeW3 {
  rulesetVersao: string;
  candidate_response: RecistCandidate | null;
  somaAtualMm: number | null;
  somaBaselineMm: number | null;
  somaNadirMm: number | null;
  percentualBaseline: number | null;
  percentualNadir: number | null;
  achado: Achado;
}

export type FormulaDeclarativa =
  | { tipo: "SOMA"; campos: string[] }
  | { tipo: "PESOS"; pesos: Record<string, number> };

export interface ScoreRuleset extends RulesetBase {
  scoreId: string;
  aplicabilidade: string;
  entradasObrigatorias: string[];
  formula: FormulaDeclarativa;
  interpretacao: { min: number; max: number; rotulo: string }[];
}

export interface ScoreInput {
  scoreId: string;
  entradas: Record<string, number | null | undefined>;
}

export interface ScoreResult extends RastreabilidadeW3 {
  rulesetVersao: string;
  scoreId: string;
  valor: number | null;
  interpretacao: string | null;
  achado: Achado;
}

export type EventoIntervaloQt =
  | (TreatmentAdministration & { modalidade?: "QT" | string })
  | (ClinicalEvent & { payload: unknown });

export interface IntervaloQtResult {
  /** Versao da ponte deterministica A4; nao aplica ruleset de prazos. */
  rulesetVersao: string;
  data: string | null;
  adminId: string | null;
  inputs_used: string[];
  inputs_missing: string[];
}

/** INV-14: rastreio tambem disponivel no envelope de cada resultado. */
export interface RastreabilidadeW3 {
  rulesetVersao: string;
  inputs_used: string[];
  inputs_missing: string[];
}

// RT-06b (tech lead W10)
export const eixoCurtoMm = (l: { eixoCurtoMm: number | null }): number | null =>
  l.eixoCurtoMm !== null && Number.isFinite(l.eixoCurtoMm) && l.eixoCurtoMm >= 0 ? l.eixoCurtoMm : null;
