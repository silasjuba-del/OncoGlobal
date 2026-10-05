import { DatabaseSync } from "node:sqlite";
import { criarSchema } from "./schema.js";

export function abrirLedger(caminho: string): DatabaseSync {
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  criarSchema(db);
  return db;
}

/** BEGIN IMMEDIATE serializes competing writers before checking revisions. */
export function transacao<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
