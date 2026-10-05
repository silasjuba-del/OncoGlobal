import type { DatabaseSync } from "node:sqlite";
import { type Sessao } from "../../contracts/base.js";
import { ClinicalEvent, type ClinicalEvent as Evento } from "../../contracts/operacao.js";
import { lerDraft, salvarDraft } from "./drafts.js";
import { auditar, gravarOperacao, hashPayload, resultadoExistente, type Gravacao } from "./ledger.js";

export { salvarDraft };

export interface RegistroConfirmacao {
  draftId: string;
  expectedRevision: number;
  eventId: string;
  tipo: string;
  payload: unknown;
  fontes: Evento["fontes"];
  revisao: "CONFIRMADO" | "ASSINADO";
  supersedesEventId?: string | null;
}

export interface Confirmacao {
  operationId: string;
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  reviewDecisionId: string;
  sessao: Sessao;
  registros: readonly RegistroConfirmacao[];
  em: string;
}

export function confirmar(db: DatabaseSync, req: Confirmacao): Gravacao {
  if (!req.reviewDecisionId || !req.sessao.medicoId || !req.registros.length)
    throw new Error("REVIEW_DECISION_REQUIRED");
  const eventos = req.registros.map((r, i) => ClinicalEvent.parse({
    eventId: r.eventId, operationId: req.operationId, eventIndex: i,
    patientId: req.patientId, tumorLotId: req.tumorLotId, encounterId: req.encounterId,
    tipo: r.tipo, payload: { reviewDecisionId: req.reviewDecisionId, data: r.payload },
    fontes: r.fontes, revisao: r.revisao, criadoEm: req.em,
    criadoPor: { tipo: "SESSAO", id: req.sessao.medicoId },
    supersedesEventId: r.supersedesEventId ?? null,
  }));
  const op = { operationId: req.operationId, payloadHash: hashPayload(eventos),
    resultRef: eventos[0]?.eventId ?? null, criadoEm: req.em };
  const replay = resultadoExistente(db, op);
  if (replay) return replay;
  try {
    return gravarOperacao(db, op, eventos, () => {
      for (const r of req.registros) {
        const draft = lerDraft(db, r.draftId);
        if (!draft || draft.revision !== r.expectedRevision || draft.patientId !== req.patientId)
          throw new Error("EXPECTED_REVISION_CONFLICT");
      }
      for (const r of req.registros)
        db.prepare("UPDATE draft_envelope SET revision=revision+1 WHERE draftId=?").run(r.draftId);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EXPECTED_REVISION_CONFLICT") {
      auditar(db, { ator: { tipo: "SESSAO", id: req.sessao.medicoId },
        acaoPedida: "CONFIRMAR", decisao: "NEGADA", motivoCodigo: "EXPECTED_REVISION_CONFLICT",
        politicaVersao: "W2-01", em: req.em });
      return { estado: "NEGADA", resultRef: null, motivo: "EXPECTED_REVISION_CONFLICT" };
    }
    throw error;
  }
}
