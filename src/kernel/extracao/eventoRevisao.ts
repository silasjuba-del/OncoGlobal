// FUGU-09 (interface) · Ação do médico → operação no ledger, pela interface existente.
// Não edita o ledger: monta `Operation` + `ClinicalEvent` válidos para `gravarOperacao`.
// O ledger exige `payload.reviewDecisionId` (REVIEW_DECISION_REQUIRED) e `criadoPor.tipo = SESSAO`.
import { createHash } from "node:crypto";
import type { Fonte } from "../../contracts/base.js";
import { ClinicalEvent, Operation } from "../../contracts/operacao.js";
import { ReviewAction } from "../../contracts/w10/extracao.js";

/** Tipo do evento de decisão de revisão. Registro canônico no contrato do ledger: PEDIDOS. */
export const TIPO_EVENTO_REVISAO = "ReviewDecision";

export interface ContextoEventoRevisao {
  readonly operationId: string;
  readonly eventId: string;
  readonly patientId: string;
  readonly tumorLotId: string | null;
  readonly encounterId: string;
  /** Proveniência do artefato revisado; vazio é aceito pelo contrato, mas nunca inventado aqui. */
  readonly fontes?: readonly Fonte[];
  readonly supersedesEventId?: string | null;
}

export interface OperacaoDeRevisao {
  readonly tipo: typeof TIPO_EVENTO_REVISAO;
  readonly operation: { operationId: string; payloadHash: string; resultRef: string | null; criadoEm: string };
  readonly eventos: readonly ReturnType<typeof ClinicalEvent.parse>[];
}

/** sha256 do JSON dos eventos — mesma materialidade que `hashPayload` do ledger. */
function hashPayload(eventos: unknown): string {
  return createHash("sha256").update(JSON.stringify(eventos)).digest("hex");
}

/**
 * Constrói a operação atômica da decisão médica. A autoridade vem da `ReviewAction`
 * (CONFIRMAR/CORRIGIR/DESCARTAR/LIGAR_PACIENTE) e do CRM da sessão, nunca do payload.
 */
export function montarOperacaoDeRevisao(
  acao: ReviewAction,
  contexto: ContextoEventoRevisao,
): OperacaoDeRevisao {
  const validada = ReviewAction.parse(acao);
  for (const campo of ["operationId", "eventId", "patientId", "encounterId"] as const) {
    if (!contexto[campo].trim()) throw new Error(`Evento de revisão exige ${campo}`);
  }
  if (!validada.medicoId.trim()) throw new Error("Evento de revisão exige médico na sessão");
  if (validada.acao === "DESCARTAR" && !validada.motivo) throw new Error("Descartar exige motivo");
  if (validada.acao === "LIGAR_PACIENTE" && !validada.patientId) throw new Error("Ligar exige patientId");

  const evento = ClinicalEvent.parse({
    eventId: contexto.eventId,
    operationId: contexto.operationId,
    eventIndex: 0,
    patientId: contexto.patientId,
    tumorLotId: contexto.tumorLotId,
    encounterId: contexto.encounterId,
    tipo: TIPO_EVENTO_REVISAO,
    payload: {
      reviewDecisionId: validada.exceptionId,
      data: {
        exceptionId: validada.exceptionId,
        acao: validada.acao,
        medicoId: validada.medicoId,
        ...(validada.patientId === undefined ? {} : { patientId: validada.patientId }),
        ...(validada.valorCorrigido === undefined ? {} : { valorCorrigido: validada.valorCorrigido }),
        ...(validada.motivo === undefined ? {} : { motivo: validada.motivo }),
      },
    },
    fontes: [...(contexto.fontes ?? [])],
    // Só o humano com CRM na sessão confirma; nunca nasce RAW nem assinado por agente.
    revisao: "CONFIRMADO",
    criadoEm: validada.em,
    criadoPor: { tipo: "SESSAO", id: validada.medicoId },
    supersedesEventId: contexto.supersedesEventId ?? null,
  });
  const eventos = [evento];
  const operation = Operation.parse({
    operationId: contexto.operationId,
    payloadHash: hashPayload(eventos),
    resultRef: evento.eventId,
    criadoEm: validada.em,
  });
  return { tipo: TIPO_EVENTO_REVISAO, operation, eventos };
}