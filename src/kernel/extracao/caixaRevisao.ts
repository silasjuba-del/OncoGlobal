// FUGU-09 · Caixa de revisão + exceções (D-W9-33 §10; D-W9-34a).
// Só as exceções vão ao médico. A ação dele vira decisão persistida; nada some —
// descartado fica com motivo. Nenhum fato é confirmado por este módulo.
import { ReviewAction } from "../../contracts/w10/extracao.js";
import type { ClinicalFact, ReviewAction as AcaoMedica, ReviewException } from "./tipos.js";

export interface ResumoCaixa {
  /** Fatos que passaram por reconciliação + validação sem exceção. */
  readonly reconciliadosAutomaticamente: number;
  readonly precisamConfirmacao: number;
  /** Formato da spec §10: "✓ N fatos reconciliados automaticamente · ⚠ K precisam confirmação". */
  readonly texto: string;
  readonly lista: readonly string[];
}

export interface CaixaRevisao {
  readonly itens: readonly ReviewException[];
  readonly resumo: ResumoCaixa;
}

export interface EntradaCaixaRevisao {
  readonly fatos: readonly ClinicalFact[];
  readonly conflitos: readonly ReviewException[];
  /** Exceções de fronteira/vínculo já detectadas na segmentação e na identificação. */
  readonly vinculos: readonly ReviewException[];
  /** Campos obrigatórios ausentes (Biomarker Requirement Engine, FUGU-11). */
  readonly faltantes: readonly ReviewException[];
  /** Progressão intervalar suspeita (RADS, FUGU-11): alerta, nunca metástase automática. */
  readonly progressoes: readonly ReviewException[];
}

/** Rótulo curto de um item da caixa (usado no resumo ao médico). */
export function rotuloDoItem(item: ReviewException): string {
  const curto = item.reason.split(":")[0] ?? item.reason;
  return `${item.kind}: ${curto.trim()}`.slice(0, 120);
}

/** Monta a caixa de revisão e o resumo ao médico. Determinístico: mesma entrada, mesma saída. */
export function montarCaixaRevisao(entrada: EntradaCaixaRevisao): CaixaRevisao {
  const itens = [...entrada.vinculos, ...entrada.conflitos, ...entrada.faltantes, ...entrada.progressoes]
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const emExcecao = new Set(itens.flatMap((i) => i.factIds));
  const exigemConfirmacao = entrada.fatos.filter((f) => f.requiresConfirmation).map((f) => f.id);
  const pendentes = new Set([...emExcecao, ...exigemConfirmacao]);
  const reconciliados = entrada.fatos.filter((f) => !pendentes.has(f.id)).length;
  const conflitosSemFato = itens.filter((i) => i.factIds.length === 0).length;
  const precisamConfirmacao = itens.length + exigemConfirmacao.length;
  const lista = [...itens.map(rotuloDoItem), ...entrada.fatos.filter((f) => f.requiresConfirmation)
    .map((f) => `${f.domain}: exige confirmação (${f.rawEvidence.slice(0, 60)})`)]
    .slice(0, 8);
  const texto = `✓ ${reconciliados} fatos reconciliados automaticamente · ⚠ ${precisamConfirmacao} precisam confirmação`;
  return {
    itens,
    resumo: { reconciliadosAutomaticamente: reconciliados, precisamConfirmacao, texto, lista },
  };
}

/** true quando a caixa não tem nenhum item e nenhum fato pede confirmação. */
export function caixaVazia(caixa: CaixaRevisao): boolean {
  return caixa.itens.length === 0 && caixa.resumo.precisamConfirmacao === 0;
}

/** Exceção de vínculo/fronteira para um segmento (D-W9-34a: nunca vincula sozinho). */
export function excecoesDeVinculo(segmento: {
  id: string; sourceId: string; boundaryReviewRequired: boolean;
}): readonly ReviewException[] {
  return [
    ...(segmento.boundaryReviewRequired ? [{
      id: `exc:REVISAR_FRONTEIRA:${segmento.id}`,
      kind: "REVISAR_FRONTEIRA" as const,
      segmentId: segmento.id,
      factIds: [],
      reason: "Fronteira ou continuidade da gravação exige revisão",
      sourceIds: [segmento.sourceId],
    }] : []),
    {
      id: `exc:UNLINKED_PATIENT:${segmento.id}`,
      kind: "UNLINKED_PATIENT" as const,
      segmentId: segmento.id,
      factIds: [],
      reason: "Vínculo com paciente exige confirmação médica",
      sourceIds: [segmento.sourceId],
    },
  ];
}

/** Exceção de número falado (Plaud) que pede confirmação humana. */
export function excecaoDeNumeroFalado(fact: ClinicalFact): ReviewException {
  return {
    id: `exc:SPOKEN_NUMBER:${fact.id}`,
    kind: "SPOKEN_NUMBER",
    segmentId: fact.segmentId,
    factIds: [fact.id],
    reason: "número falado exige confirmação antes de virar valor",
    sourceIds: [fact.sourceId],
  };
}

/** Exceção de fármaco foneticamente incerto. */
export function excecaoDeFarmacoIncerto(fact: ClinicalFact): ReviewException {
  const v = typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
  return {
    id: `exc:UNCERTAIN_DRUG:${fact.id}`,
    kind: "UNCERTAIN_DRUG",
    segmentId: fact.segmentId,
    factIds: [fact.id],
    reason: `fármaco foneticamente incerto: "${String(v.raw ?? "")}" ≈ ${String(v.normalizado ?? "")}`,
    sourceIds: [fact.sourceId],
  };
}

// ── Ação do médico → evento no ledger ────────────────────────────────────────
/**
 * Rascunho do evento de decisão. O ledger exige `reviewDecisionId` no payload
 * (ver `gravarOperacao`); o `tipo` canônico é registrado pelo tech lead (PEDIDOS).
 */
export interface EventoRevisaoLedger {
  readonly tipo: "ReviewDecision";
  readonly payload: Readonly<{
    reviewDecisionId: string;
    exceptionId: string;
    acao: AcaoMedica["acao"];
    medicoId: string;
    em: string;
    patientId?: string;
    motivo?: string;
  }>;
}

/** Converte a ação do médico em evento do ledger. Ação inválida é rejeitada, não gravada. */
export function paraEventoDeRevisao(acao: AcaoMedica, reviewDecisionId: string): EventoRevisaoLedger {
  const validada = ReviewAction.parse(acao);
  if (!reviewDecisionId.trim()) throw new Error("Evento de revisão exige reviewDecisionId");
  if (validada.acao === "DESCARTAR" && !validada.motivo) throw new Error("Descartar exige motivo");
  if (validada.acao === "LIGAR_PACIENTE" && !validada.patientId) throw new Error("Ligar exige patientId");
  return {
    tipo: "ReviewDecision",
    payload: {
      reviewDecisionId,
      exceptionId: validada.exceptionId,
      acao: validada.acao,
      medicoId: validada.medicoId,
      em: validada.em,
      ...(validada.patientId === undefined ? {} : { patientId: validada.patientId }),
      ...(validada.motivo === undefined ? {} : { motivo: validada.motivo }),
    },
  };
}
