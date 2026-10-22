import { fonteRascunhoNaoPromovivel, rascunhoNaoPromovivel } from "../../contracts/rascunhos.js";
import type { DatabaseSync } from "node:sqlite";
import { type Sessao } from "../../contracts/base.js";
import { Apac, ClinicalEvent, type ClinicalEvent as Evento } from "../../contracts/operacao.js";
import { lerDraft, salvarDraft } from "./drafts.js";
import { auditar, gravarOperacao, hashPayload, resultadoExistente, type Gravacao } from "./ledger.js";
import { transacao } from "./db.js";

export { salvarDraft };
export { rascunhoInerte as rascunhoJevNaoPromovivel } from "../../contracts/rascunhos.js";
const emissores = new WeakMap<DatabaseSync, (req:Confirmacao, eventos:readonly Evento[])=>void>();
/** Callback síncrono, na transação da confirmação: nunca transporte ou efeito externo. */
export function aoCommitar(db:DatabaseSync, fn:(req:Confirmacao,eventos:readonly Evento[])=>void):void { emissores.set(db,fn); }

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
  const promoveJev = () => req.registros.some(r => fonteRascunhoNaoPromovivel(lerDraft(db, r.draftId)?.payload)
    || rascunhoNaoPromovivel(r.payload) || rascunhoNaoPromovivel({ kind: r.tipo }));
  const apacCanonicaInvalida = () => req.registros.some(r => {
    const p = lerDraft(db, r.draftId)?.payload;
    if (!p || typeof p !== "object" || !("kind" in p) || p.kind !== "APAC_CONFIRMACAO_CANONICA") return false;
    const apac = Apac.safeParse(r.payload);
    return !apac.success || apac.data.tumorLotId !== req.tumorLotId || apac.data.estado !== "RASCUNHO"
      || apac.data.resultadoExterno !== null || r.tipo !== "APAC" || r.expectedRevision !== 0 || !("apac" in p) || !("contexto" in p)
      || hashPayload(r.payload) !== hashPayload(p.apac)
      || hashPayload(p.contexto) !== hashPayload({ patientId: req.patientId, encounterId: req.encounterId, tumorLotId: req.tumorLotId });
  });
  // Antes inclusive de replay: mudar o tipo/payload do evento não contorna o tipo do draft.
  if (promoveJev()) return { estado: "NEGADA", resultRef: null, motivo: "PROPOSTA_DOCUMENTAL_NAO_PROMOVIVEL" };
  if (apacCanonicaInvalida()) return { estado: "NEGADA", resultRef: null, motivo: "CONFIRMACAO_APAC_DIVERGENTE" };
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
    return transacao(db, () => {
      if (promoveJev()) return { estado: "NEGADA", resultRef: null, motivo: "PROPOSTA_DOCUMENTAL_NAO_PROMOVIVEL" };
      if (apacCanonicaInvalida()) return { estado: "NEGADA", resultRef: null, motivo: "CONFIRMACAO_APAC_DIVERGENTE" };
      const resultado = gravarOperacao(db, op, eventos, () => {
      for (const r of req.registros) {
        const draft = lerDraft(db, r.draftId);
        if (!draft || draft.revision !== r.expectedRevision || draft.patientId !== req.patientId)
          throw new Error("EXPECTED_REVISION_CONFLICT");
      }
      for (const r of req.registros)
        db.prepare("UPDATE draft_envelope SET revision=revision+1 WHERE draftId=?").run(r.draftId);
      });
      if (resultado.estado === "GRAVADA") {
        auditar(db, {ator:{tipo:"SESSAO",id:req.sessao.medicoId},acaoPedida:`CONFIRMAR:${req.operationId}`,
          decisao:"PERMITIDA",motivoCodigo:"REVISAO_MEDICA_CONFIRMADA",politicaVersao:"F2-CONFIRMACAO@1",em:req.em});
        emissores.get(db)?.(req,eventos);
      }
      return resultado;
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
