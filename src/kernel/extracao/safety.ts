// FUGU-08 · SafetyValidator — os 7 invariantes anti-alucinação (D-W9-33 §5) como código.
// Nenhuma promoção de INFERRED/UNCERTAIN a confirmado passa sem regra documental nomeada
// ou clique médico persistido. A validação rejeita com motivo; nunca "corrige" em silêncio.
import type { ClinicalFact } from "./tipos.js";
import { componenteM, normalizarDataCivil } from "./normalizacao.js";
import { literalDoEstagio } from "./reconciliacao.js";

export interface ViolacaoInvariante {
  /** Número do invariante na spec §5 (1..7). */
  readonly invariante: number;
  readonly nome: string;
  readonly factId: string;
  readonly motivo: string;
}

export interface ResultadoSafety {
  /** Fatos que passaram por todos os invariantes. */
  readonly facts: readonly ClinicalFact[];
  /** Fatos rejeitados (tentativa de promoção ilegal) — nunca descartados sem motivo. */
  readonly rejeitados: readonly ClinicalFact[];
  readonly violacoes: readonly ViolacaoInvariante[];
}

export interface ContextoSafety {
  /** true quando a reconciliação já marcou cronologia impossível. */
  readonly conflitoTemporalDetectado: boolean;
  /** Valor persistido anterior: `historicalMetastaticDisease` nunca volta a false. */
  readonly historicalMetastaticDiseaseAnterior?: boolean;
}

const NEGATIVO = /\b(?:negativ\w*|negative|not detected|indeterminado|sem expressao)\b/iu;
const NUMERICO = /\b\d+(?:[.,]\d+)?\b|\b(?:quatorze|quinze|dez|vinte|trinta)\b/iu;
const DOMINIOS_COM_NUMERO = new Set(["lab", "cycle", "imaging", "drug"]);

function texto(fact: ClinicalFact): string {
  return `${JSON.stringify(fact.value ?? null)} ${fact.raw ?? ""} ${fact.rawEvidence}`;
}

/** Invariante 1 · ausência ≠ negativo. */
function inv1(fact: ClinicalFact): ViolacaoInvariante | null {
  if (fact.domain !== "biomarker" && fact.domain !== "metastasis") return null;
  const v = typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
  const valor = typeof v.value === "string" ? v.value : String(v.value ?? "");
  if (NEGATIVO.test(valor) || (valor.trim() === "" && v.value === null)) {
    return {
      invariante: 1, nome: "ausencia-nao-e-negativo", factId: fact.id,
      motivo: "biomarcador/achado ausente não vira 'negativo' nem valor vazio positivo",
    };
  }
  return null;
}

/** Invariante 2 · inferência não vira fato. */
function inv2(fact: ClinicalFact): ViolacaoInvariante | null {
  const inferido = fact.evidence === "DERIVED" || fact.evidence === "INFERRED";
  if (inferido && !fact.regra?.trim()) {
    return {
      invariante: 2, nome: "inferencia-exige-regra", factId: fact.id,
      motivo: "DERIVED/INFERRED exige regra nomeada; sem ela o fato é rejeitado",
    };
  }
  if (fact.evidence !== "EXPLICIT" && fact.requiresConfirmation === false && !fact.regra?.trim()) {
    return {
      invariante: 2, nome: "promocao-sem-regra-ou-clique", factId: fact.id,
      motivo: "proposta não confirmada tentou entrar como fato confirmado sem regra ou clique médico",
    };
  }
  return null;
}

/** Invariante 3 · frase original sempre preservada. */
function inv3(fact: ClinicalFact): ViolacaoInvariante | null {
  if (!fact.rawEvidence.trim() || !fact.sourceId.trim()) {
    return {
      invariante: 3, nome: "origem-preservada", factId: fact.id,
      motivo: "fato sem frase original (rawEvidence) ou sem sourceId: não é rastreável",
    };
  }
  return null;
}

/** Invariante 4 · número falado exige confirmação. */
function inv4(fact: ClinicalFact): ViolacaoInvariante | null {
  if (fact.sourceType !== "plaud" || !DOMINIOS_COM_NUMERO.has(fact.domain)) return null;
  if (!NUMERICO.test(texto(fact))) return null;
  if (fact.requiresConfirmation && fact.confidence < 0.7) return null;
  return {
    invariante: 4, nome: "numero-falado-confirma", factId: fact.id,
    motivo: "número vindo de Plaud exige confidence < 0,7 e requiresConfirmation = true",
  };
}

/** Invariante 5 · fármaco foneticamente incerto nunca normaliza em silêncio. */
function inv5(fact: ClinicalFact): ViolacaoInvariante | null {
  if (fact.domain !== "drug" || fact.evidence !== "INFERRED") return null;
  const v = typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
  const completo = typeof v.raw === "string" && v.raw.trim() !== ""
    && typeof v.normalizado === "string" && v.normalizado.trim() !== ""
    && fact.confidence < 1 && fact.requiresConfirmation;
  if (completo) return null;
  return {
    invariante: 5, nome: "farmaco-incerto-com-proveniencia", factId: fact.id,
    motivo: "fármaco incerto exige raw + normalizado + INFERRED + confiança e confirmação",
  };
}

/** Invariante 6 · validação temporal: evento antes do diagnóstico não pode passar sem conflito. */
function inv6(
  fact: ClinicalFact,
  dataDiagnostico: string | null,
  conflitoTemporalDetectado: boolean,
): ViolacaoInvariante | null {
  if (!fact.date || fact.domain === "diagnosis" || !dataDiagnostico) return null;
  const data = normalizarDataCivil(fact.date);
  if (data === null || data >= dataDiagnostico) return null;
  if (conflitoTemporalDetectado) return null;
  return {
    invariante: 6, nome: "validacao-temporal", factId: fact.id,
    motivo: `evento em ${data} é anterior ao diagnóstico (${dataDiagnostico}) e o conflito temporal não foi marcado`,
  };
}

/** Invariante 7 · TNM é histórico imutável; `historicalMetastaticDisease` nunca volta a false. */
function inv7(fact: ClinicalFact, contexto: ContextoSafety): ViolacaoInvariante | null {
  const metastatica = fact.domain === "metastasis"
    || (fact.domain === "stage" && componenteM(literalDoEstagio(fact)) === "1");
  if (!metastatica) return null;
  if (contexto.historicalMetastaticDiseaseAnterior === false) {
    return {
      invariante: 7, nome: "historico-metastatico-imutavel", factId: fact.id,
      motivo: "doença metastática já registrada não pode voltar a false no histórico",
    };
  }
  return null;
}

/** true quando o conjunto de fatos sustenta `historicalMetastaticDisease = true` (monotônico). */
export function historicalMetastaticDisease(fatos: readonly ClinicalFact[]): boolean {
  return fatos.some((f) => f.domain === "metastasis"
    || (f.domain === "stage" && componenteM(literalDoEstagio(f)) === "1"));
}

/** Etapa 6 do pipeline: aplica os 7 invariantes e separa o que foi rejeitado. */
export function validarSegurancaAntiAlucinacao(
  fatos: readonly ClinicalFact[],
  contexto: ContextoSafety,
): ResultadoSafety {
  const dataDiagnostico = fatos
    .filter((f) => f.domain === "diagnosis" && f.date)
    .map((f) => normalizarDataCivil(f.date ?? null))
    .filter((d): d is string => d !== null)
    .sort()[0] ?? null;
  const facts: ClinicalFact[] = [];
  const rejeitados: ClinicalFact[] = [];
  const violacoes: ViolacaoInvariante[] = [];
  for (const fact of fatos) {
    const falhas = [inv1(fact), inv2(fact), inv3(fact), inv4(fact), inv5(fact),
      inv6(fact, dataDiagnostico, contexto.conflitoTemporalDetectado), inv7(fact, contexto)]
      .filter((v): v is ViolacaoInvariante => v !== null);
    if (falhas.length) { rejeitados.push(fact); violacoes.push(...falhas); }
    else facts.push(fact);
  }
  return { facts, rejeitados, violacoes };
}
