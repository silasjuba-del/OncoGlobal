import type { DatabaseSync } from "node:sqlite";
import { transacao } from "../ledger/db.js";
import { listarEventos } from "../ledger/ledger.js";
import { cumulativos } from "./cumulativos.js";
import { labSeries, weightSeries } from "./series.js";
import { projetarSnapshot } from "./snapshot.js";

export interface ProjectionContext { patientId: string; tumorLotId: string | null; encounterId: string; projectionVersion: string }

export function criarCache(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS projection_cache (
    patientId TEXT NOT NULL, tumorLotKey TEXT NOT NULL, encounterId TEXT NOT NULL,
    projectionVersion TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY(patientId,tumorLotKey,encounterId,projectionVersion)
  )`);
}

function payload(db: DatabaseSync, ctx: ProjectionContext): string {
  const all = listarEventos(db, ctx.patientId);
  const events = all.filter((e) => e.tumorLotId === ctx.tumorLotId || e.tumorLotId === null);
  return JSON.stringify({
    snapshot: projetarSnapshot(all, ctx.patientId, ctx.tumorLotId, ctx.encounterId, ctx.projectionVersion),
    labSeries: labSeries(events), weightSeries: weightSeries(events),
    cumulativeDose: cumulativos(events),
  });
}

/** Cache is disposable. No clock or live ruleset lookup enters the reconstruction. */
export function reconstruir(db: DatabaseSync, contexts: readonly ProjectionContext[]): void {
  criarCache(db);
  transacao(db, () => {
    db.exec("DELETE FROM projection_cache");
    const put = db.prepare(`INSERT INTO projection_cache
      (patientId,tumorLotKey,encounterId,projectionVersion,data) VALUES (?,?,?,?,?)`);
    for (const ctx of [...contexts].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b))))
      put.run(ctx.patientId, ctx.tumorLotId ?? "", ctx.encounterId, ctx.projectionVersion, payload(db, ctx));
  });
}

export function lerCache(db: DatabaseSync, ctx: ProjectionContext): string | null {
  criarCache(db);
  return db.prepare(`SELECT data FROM projection_cache
    WHERE patientId=? AND tumorLotKey=? AND encounterId=? AND projectionVersion=?`)
    .get(ctx.patientId, ctx.tumorLotId ?? "", ctx.encounterId, ctx.projectionVersion)?.data as string ?? null;
}
