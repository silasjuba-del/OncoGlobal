import type { DatabaseSync } from "node:sqlite";
import { ClinicalEvent } from "../../src/contracts/operacao.js";
import { gravarOperacao, hashPayload } from "../../src/kernel/ledger/ledger.js";

export function evento(id: string, data: unknown, patch: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return ClinicalEvent.parse({
    eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "paciente-sintetico",
    tumorLotId: "lote-sintetico", encounterId: "consulta-sintetica", tipo: "FATO",
    payload: { reviewDecisionId: "revisao-sintetica", data }, fontes: [], revisao: "CONFIRMADO",
    criadoEm: "2026-10-07T12:00:00Z", criadoPor: { tipo: "SESSAO", id: "medico-sintetico" },
    supersedesEventId: null, ...patch,
  });
}

/** Seed confirmed synthetic rows to exercise read projections, not the review/write UI. */
export function persistirFixture(db: DatabaseSync, e: ClinicalEvent): void {
  const result = gravarOperacao(db, { operationId: e.operationId, payloadHash: hashPayload([e]),
    resultRef: e.eventId, criadoEm: e.criadoEm }, [e]);
  if (result.estado !== "GRAVADA") throw new Error(`Fixture failed: ${result.estado}`);
}
