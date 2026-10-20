// provenance: dados sintéticos - não utilizar em produção
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import * as drafts from "../../src/kernel/ledger/drafts.js";

const dbs: ReturnType<typeof abrirLedger>[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });

it("fila sem vínculo não trunca desconhecidos, ordena IDs e ignora payloads de outros pacientes", () => {
  const db = abrirLedger(":memory:"); dbs.push(db);
  for (let index = 124; index >= 0; index--) {
    const id = `sem-${String(index).padStart(3, "0")}`;
    drafts.salvarDraft(db, { draftId: id, patientId: null, sourceId: `fonte-${id}`, rawRef: id,
      payload: { kind: "EXTRACAO_RASCUNHO", valor: index }, diagnostics: [], revision: 0,
      criadoEm: "2026-10-20T12:00:00Z" });
  }
  drafts.salvarDraft(db, { draftId: "vinculado", patientId: "outro-paciente", sourceId: "fonte-outro",
    rawRef: "vinculado", payload: {}, diagnostics: [], revision: 0, criadoEm: "2026-10-20T12:00:00Z" });
  db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run("{invalido", "vinculado");
  const result = drafts.listarDraftsSemVinculo(db);
  expect(result).toHaveLength(125);
  expect(result[0]?.draftId).toBe("sem-000");
  expect(result[124]?.draftId).toBe("sem-124");
  expect(result.every(d => d.patientId === null)).toBe(true);
  expect(result[0]?.payload).toEqual({ kind: "EXTRACAO_RASCUNHO", valor: 0 });
});

it("fila vazia permanece vazia sem inventar vínculo", () => {
  const db = abrirLedger(":memory:"); dbs.push(db);
  expect(drafts.listarDraftsSemVinculo(db)).toEqual([]);
});
