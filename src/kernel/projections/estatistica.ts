import type { DatabaseSync } from 'node:sqlite';
import { ClinicalEvent } from '../../contracts/operacao.js';
import { projetarEstatistica, type OpcoesEstatistica, type ProjecaoEstatistica } from '../../modules/estatistica/projetar.js';
export * from '../../modules/estatistica/projetar.js';
/** Reads the complete persisted ledger; no parallel counter/cache is written. */
export function projetarEstatisticaLedger(db: DatabaseSync, opcoes: OpcoesEstatistica = {}): ProjecaoEstatistica {
  const eventos = db.prepare("SELECT * FROM clinical_event ORDER BY criadoEm, operationId, eventIndex")
    .all().map((row) => {
      const parsed = {
        ...row,
        payload: JSON.parse(String(row.payload)),
        fontes: JSON.parse(String(row.fontes)),
        criadoPor: JSON.parse(String(row.criadoPor)),
      };
      return ClinicalEvent.parse(parsed);
    });
  return projetarEstatistica(eventos, opcoes);
}
