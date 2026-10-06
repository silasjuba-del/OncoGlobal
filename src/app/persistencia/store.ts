import { mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface Registro<T> {
  collection: string;
  key: string;
  revision: number;
  value: T;
}

export interface ConflitoRevisao<T> {
  codigo: "CONFLITO_REVISAO";
  collection: string;
  key: string;
  expectedRevision: number;
  atual: Registro<unknown> | null;
  candidato: T;
}

export class ConflitoPersistencia<T> extends Error {
  readonly conflito: ConflitoRevisao<T>;
  constructor(conflito: ConflitoRevisao<T>) {
    super("A revisão persistida mudou; a gravação concorrente foi preservada como conflito");
    this.name = "ConflitoPersistencia";
    this.conflito = conflito;
  }
}

export interface WorkspaceStore {
  ler<T>(collection: string, key: string): Registro<T> | null;
  gravar<T>(input: {
    collection: string;
    key: string;
    value: T;
    expectedRevision: number | null;
  }): Registro<T>;
  listar<T>(collection: string): Registro<T>[];
  append<T>(input: { collection: string; key: string; event: T }): number;
  lerHistorico<T>(collection: string, key: string): T[];
  fechar(): void;
}

const seguro = (value: string, label: string) => {
  if (!value || value.length > 240 || value === "." || value === ".." || /[\0/\\]/.test(value)) {
    throw new TypeError(`${label} inválido`);
  }
  return value;
};

function decodificar<T>(row: Record<string, unknown>): Registro<T> {
  return {
    collection: String(row.collection),
    key: String(row.record_key),
    revision: Number(row.revision),
    value: JSON.parse(String(row.payload)) as T,
  };
}

/** SQLite local genérico para workspace. Nenhum identificador é usado como caminho ou logado. */
export function criarWorkspaceStore(options: { rootDir: string }): WorkspaceStore {
  const root = resolve(options.rootDir);
  mkdirSync(root, { recursive: true });
  const dbPath = resolve(root, "workspace.sqlite");
  if (!dbPath.startsWith(`${root}${sep}`)) throw new Error("CAMINHO_FORA_DO_WORKSPACE");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS workspace_record (
      collection TEXT NOT NULL,
      record_key TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      payload TEXT NOT NULL,
      PRIMARY KEY (collection, record_key)
    );
    CREATE TABLE IF NOT EXISTS workspace_history (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      record_key TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_conflict (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      record_key TEXT NOT NULL,
      expected_revision INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
  `);

  return {
    ler<T>(collection: string, key: string) {
      const c = seguro(collection, "collection");
      const k = seguro(key, "key");
      const row = db.prepare("SELECT collection, record_key, revision, payload FROM workspace_record WHERE collection=? AND record_key=?").get(c, k);
      return row ? decodificar<T>(row as Record<string, unknown>) : null;
    },
    gravar<T>({ collection, key, value, expectedRevision }: {
      collection: string;
      key: string;
      value: T;
      expectedRevision: number | null;
    }) {
      const c = seguro(collection, "collection");
      const k = seguro(key, "key");
      if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
        throw new TypeError("expectedRevision inválida");
      }
      const payload = JSON.stringify(value);
      if (payload === undefined) throw new TypeError("Valor não serializável");
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = db.prepare("SELECT collection, record_key, revision, payload FROM workspace_record WHERE collection=? AND record_key=?").get(c, k) as Record<string, unknown> | undefined;
        const atual = row ? decodificar<unknown>(row) : null;
        const actualRevision = atual?.revision ?? null;
        if (actualRevision !== expectedRevision) {
          db.prepare("INSERT INTO workspace_conflict(collection,record_key,expected_revision,payload) VALUES(?,?,?,?)")
            .run(c, k, expectedRevision ?? 0, payload);
          db.exec("COMMIT");
          throw new ConflitoPersistencia<T>({
            codigo: "CONFLITO_REVISAO", collection: c, key: k,
            expectedRevision: expectedRevision ?? 0, atual, candidato: value,
          });
        }
        const revision = (actualRevision ?? 0) + 1;
        db.prepare(`INSERT INTO workspace_record(collection,record_key,revision,payload) VALUES(?,?,?,?)
          ON CONFLICT(collection,record_key) DO UPDATE SET revision=excluded.revision,payload=excluded.payload`)
          .run(c, k, revision, payload);
        db.prepare("INSERT INTO workspace_history(collection,record_key,payload) VALUES(?,?,?)").run(c, k, payload);
        db.exec("COMMIT");
        return { collection: c, key: k, revision, value };
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch { /* transação já encerrada */ }
        throw error;
      }
    },
    listar<T>(collection: string) {
      const c = seguro(collection, "collection");
      const rows = db.prepare("SELECT collection, record_key, revision, payload FROM workspace_record WHERE collection=? ORDER BY record_key").all(c);
      return rows.map((row) => decodificar<T>(row as Record<string, unknown>));
    },
    append<T>({ collection, key, event }: { collection: string; key: string; event: T }) {
      const c = seguro(collection, "collection");
      const k = seguro(key, "key");
      const payload = JSON.stringify(event);
      if (payload === undefined) throw new TypeError("Evento não serializável");
      const result = db.prepare("INSERT INTO workspace_history(collection,record_key,payload) VALUES(?,?,?)").run(c, k, payload);
      return Number(result.lastInsertRowid);
    },
    lerHistorico<T>(collection: string, key: string) {
      const c = seguro(collection, "collection");
      const k = seguro(key, "key");
      return db.prepare("SELECT payload FROM workspace_history WHERE collection=? AND record_key=? ORDER BY sequence")
        .all(c, k).map((row) => JSON.parse(String((row as Record<string, unknown>).payload)) as T);
    },
    fechar() { db.close(); },
  };
}
