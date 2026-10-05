import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { AuditEvent, ClinicalEvent, Operation, type ClinicalEvent as Evento } from "../../contracts/operacao.js";
import { transacao } from "./db.js";

export type Operacao = typeof Operation._output;
export type Gravacao = { estado: "GRAVADA" | "REPLAY" | "NEGADA"; resultRef: string | null; motivo?: string };

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function auditar(db: DatabaseSync, evento: typeof AuditEvent._output): void {
  const e = AuditEvent.parse(evento);
  db.prepare(`INSERT INTO audit_event (ator,acaoPedida,decisao,motivoCodigo,politicaVersao,em)
    VALUES (?,?,?,?,?,?)`).run(JSON.stringify(e.ator), e.acaoPedida, e.decisao, e.motivoCodigo, e.politicaVersao, e.em);
}

function auditarNegacao(db: DatabaseSync, motivoCodigo: string, op: Operacao): void {
  auditar(db, {
    ator: { tipo: "SISTEMA", id: "write-router" }, acaoPedida: "GRAVAR_OPERACAO",
    decisao: "NEGADA", motivoCodigo, politicaVersao: "W2-01", em: op.criadoEm,
  });
}

export function resultadoExistente(db: DatabaseSync, op: Operacao): Gravacao | null {
  const old = db.prepare("SELECT payloadHash, resultRef FROM operation WHERE operationId=?").get(op.operationId);
  if (!old) return null;
  if (old.payloadHash === op.payloadHash) return { estado: "REPLAY", resultRef: old.resultRef as string | null };
  auditarNegacao(db, "OPERATION_HASH_CONFLICT", op);
  return { estado: "NEGADA", resultRef: null, motivo: "OPERATION_HASH_CONFLICT" };
}

/**
 * One operation, N immutable events. The callback (when supplied by WriteRouter)
 * validates draft revisions inside the same writer transaction.
 */
export function gravarOperacao(
  db: DatabaseSync, operation: Operacao, eventos: readonly Evento[],
  antesDeGravar?: () => void,
): Gravacao {
  const op = Operation.parse(operation);
  const valid = eventos.map((e) => ClinicalEvent.parse(e));
  if (!valid.length || valid.some((e, i) => e.operationId !== op.operationId || e.eventIndex !== i))
    throw new Error("OPERATION_EVENTS_INVALID");
  if (valid.some((e) => e.revisao !== "CONFIRMADO" && e.revisao !== "ASSINADO")) {
    auditarNegacao(db, "REVISAO_NAO_CONFIRMADA", op);
    return { estado: "NEGADA", resultRef: null, motivo: "REVISAO_NAO_CONFIRMADA" };
  }
  if (valid.some((e) => e.criadoPor.tipo !== "SESSAO"
    || !e.payload || typeof e.payload !== "object"
    || !("reviewDecisionId" in e.payload)
    || typeof e.payload.reviewDecisionId !== "string" || !e.payload.reviewDecisionId)) {
    auditarNegacao(db, "REVIEW_DECISION_REQUIRED", op);
    return { estado: "NEGADA", resultRef: null, motivo: "REVIEW_DECISION_REQUIRED" };
  }
  // Enforce binding of the idempotency hash to the actual event material.
  if (op.payloadHash !== hashPayload(valid)) {
    auditarNegacao(db, "PAYLOAD_HASH_INVALID", op);
    return { estado: "NEGADA", resultRef: null, motivo: "PAYLOAD_HASH_INVALID" };
  }
  const existing = resultadoExistente(db, op);
  if (existing) return existing;
  return transacao(db, () => {
    // Recheck under the write lock (another connection could have committed).
    const replay = resultadoExistente(db, op);
    if (replay) return replay;
    antesDeGravar?.();
    db.prepare("INSERT INTO operation VALUES (?,?,?,?)").run(op.operationId, op.payloadHash, op.resultRef, op.criadoEm);
    const insert = db.prepare(`INSERT INTO clinical_event
      (eventId,operationId,eventIndex,patientId,tumorLotId,encounterId,tipo,payload,fontes,
       revisao,criadoEm,criadoPor,supersedesEventId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const e of valid) {
      if (e.supersedesEventId) {
        const old = db.prepare("SELECT patientId,tumorLotId FROM clinical_event WHERE eventId=?").get(e.supersedesEventId);
        if (!old || old.patientId !== e.patientId || old.tumorLotId !== e.tumorLotId)
          throw new Error("SUPERSEDES_CONTEXT_INVALID");
      }
      insert.run(e.eventId, e.operationId, e.eventIndex, e.patientId, e.tumorLotId,
        e.encounterId, e.tipo, JSON.stringify(e.payload), JSON.stringify(e.fontes),
        e.revisao, e.criadoEm, JSON.stringify(e.criadoPor), e.supersedesEventId);
    }
    return { estado: "GRAVADA", resultRef: op.resultRef } as Gravacao;
  });
}

export function listarEventos(db: DatabaseSync, patientId: string): Evento[] {
  return db.prepare(`SELECT * FROM clinical_event WHERE patientId=?
    ORDER BY criadoEm, operationId, eventIndex`).all(patientId).map((row) => ClinicalEvent.parse({
    ...row, payload: JSON.parse(String(row.payload)), fontes: JSON.parse(String(row.fontes)),
    criadoPor: JSON.parse(String(row.criadoPor)),
  }));
}
