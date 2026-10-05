import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { DraftEnvelope, type DraftEnvelope as Draft } from "../../contracts/base.js";
import { transacao } from "./db.js";

function rowToDraft(row: Record<string, unknown>): Draft {
  return DraftEnvelope.parse({
    draftId: row.draftId, patientId: row.patientId, sourceId: row.sourceId,
    rawRef: row.rawRef, payload: JSON.parse(String(row.payload)),
    diagnostics: JSON.parse(String(row.diagnostics)), revision: row.revision, criadoEm: row.criadoEm,
  });
}

/** Inert payload is persisted without attempting clinical parsing or promotion. */
export function salvarDraft(db: DatabaseSync, draft: Draft): Draft {
  const valid = DraftEnvelope.parse(draft);
  return transacao(db, () => {
    const previous = db.prepare("SELECT revision FROM draft_envelope WHERE draftId = ?").get(valid.draftId);
    // Saving a stale edit must not overwrite the other tab OR lose this edit.
    const stale = previous && Number(previous.revision) !== valid.revision - 1;
    const stored = stale
      ? { ...valid, draftId: `${valid.draftId}-conflito-${randomUUID()}`,
          diagnostics: [...valid.diagnostics, "EXPECTED_REVISION_CONFLICT"] }
      : valid;
    if (previous && !stale) {
      db.prepare(`UPDATE draft_envelope SET patientId=?, sourceId=?, rawRef=?, payload=?, diagnostics=?,
        revision=?, criadoEm=? WHERE draftId=?`).run(
        stored.patientId, stored.sourceId, stored.rawRef, JSON.stringify(stored.payload),
        JSON.stringify(stored.diagnostics), stored.revision, stored.criadoEm, stored.draftId,
      );
    } else {
      db.prepare(`INSERT INTO draft_envelope
        (draftId,patientId,sourceId,rawRef,payload,diagnostics,revision,criadoEm)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        stored.draftId, stored.patientId, stored.sourceId, stored.rawRef,
        JSON.stringify(stored.payload), JSON.stringify(stored.diagnostics), stored.revision, stored.criadoEm,
      );
    }
    return stored;
  });
}

export function lerDraft(db: DatabaseSync, draftId: string): Draft | null {
  const row = db.prepare("SELECT * FROM draft_envelope WHERE draftId=?").get(draftId);
  return row ? rowToDraft(row) : null;
}

export function listarDrafts(db: DatabaseSync, patientId?: string): Draft[] {
  const rows = patientId === undefined
    ? db.prepare("SELECT * FROM draft_envelope ORDER BY draftId").all()
    : db.prepare("SELECT * FROM draft_envelope WHERE patientId=? ORDER BY draftId").all(patientId);
  return rows.map(rowToDraft);
}
