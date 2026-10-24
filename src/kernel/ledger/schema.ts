import type { DatabaseSync } from "node:sqlite";

/** Schema local. Event and audit rows are immutable, including through direct SQL. */
export function criarSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS confirmation_cancel (operationId TEXT PRIMARY KEY, atorId TEXT NOT NULL, em TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS confirmation_cancel_no_update BEFORE UPDATE ON confirmation_cancel
      BEGIN SELECT RAISE(ABORT,'confirmation_cancel append-only'); END;
    CREATE TRIGGER IF NOT EXISTS confirmation_cancel_no_delete BEFORE DELETE ON confirmation_cancel
      BEGIN SELECT RAISE(ABORT,'confirmation_cancel append-only'); END;
    CREATE TABLE IF NOT EXISTS operation (
      operationId TEXT PRIMARY KEY,
      payloadHash TEXT NOT NULL,
      resultRef TEXT,
      criadoEm TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clinical_event (
      eventId TEXT PRIMARY KEY,
      operationId TEXT NOT NULL REFERENCES operation(operationId),
      eventIndex INTEGER NOT NULL CHECK(eventIndex >= 0),
      patientId TEXT NOT NULL,
      tumorLotId TEXT,
      encounterId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      payload TEXT NOT NULL,
      fontes TEXT NOT NULL,
      revisao TEXT NOT NULL CHECK(revisao IN ('CONFIRMADO','ASSINADO')),
      criadoEm TEXT NOT NULL,
      criadoPor TEXT NOT NULL,
      supersedesEventId TEXT REFERENCES clinical_event(eventId),
      UNIQUE(operationId, eventIndex)
    );
    CREATE INDEX IF NOT EXISTS clinical_event_context
      ON clinical_event(patientId, tumorLotId, encounterId, criadoEm, operationId, eventIndex);
    CREATE TABLE IF NOT EXISTS confirmation_rules (
      operationId TEXT PRIMARY KEY REFERENCES operation(operationId),
      contratoVersao TEXT NOT NULL, configHash TEXT NOT NULL, regras TEXT NOT NULL, biblioteca TEXT NOT NULL,
      medicoId TEXT NOT NULL, em TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS confirmation_rules_no_update BEFORE UPDATE ON confirmation_rules
      BEGIN SELECT RAISE(ABORT,'confirmation_rules append-only'); END;
    CREATE TRIGGER IF NOT EXISTS confirmation_rules_no_delete BEFORE DELETE ON confirmation_rules
      BEGIN SELECT RAISE(ABORT,'confirmation_rules append-only'); END;
    CREATE TABLE IF NOT EXISTS draft_envelope (
      draftId TEXT PRIMARY KEY,
      patientId TEXT,
      sourceId TEXT NOT NULL,
      rawRef TEXT NOT NULL,
      payload TEXT NOT NULL,
      diagnostics TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      criadoEm TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_event (
      auditId INTEGER PRIMARY KEY,
      ator TEXT NOT NULL,
      acaoPedida TEXT NOT NULL,
      decisao TEXT NOT NULL,
      motivoCodigo TEXT NOT NULL,
      politicaVersao TEXT NOT NULL,
      em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_idempotency (
      chave TEXT PRIMARY KEY,
      payloadHash TEXT NOT NULL,
      resultado TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS estimulo_tecnico (
      id TEXT PRIMARY KEY, operationId TEXT NOT NULL, conteudo TEXT NOT NULL, criadoEm TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS execucao_tecnica (
      runId TEXT NOT NULL REFERENCES estimulo_tecnico(id), indice INTEGER NOT NULL,
      estado TEXT NOT NULL CHECK(estado IN ('PENDENTE','EM_CURSO','PRONTO','CONCLUIDO','FALHOU')),
      conteudo TEXT NOT NULL, criadoEm TEXT NOT NULL, PRIMARY KEY(runId,indice)
    );
    CREATE TRIGGER IF NOT EXISTS estimulo_no_update BEFORE UPDATE ON estimulo_tecnico
      BEGIN SELECT RAISE(ABORT, 'estimulo append-only'); END;
    CREATE TRIGGER IF NOT EXISTS estimulo_no_delete BEFORE DELETE ON estimulo_tecnico
      BEGIN SELECT RAISE(ABORT, 'estimulo append-only'); END;
    CREATE TRIGGER IF NOT EXISTS execucao_no_update BEFORE UPDATE ON execucao_tecnica
      BEGIN SELECT RAISE(ABORT, 'execucao append-only'); END;
    CREATE TRIGGER IF NOT EXISTS execucao_no_delete BEFORE DELETE ON execucao_tecnica
      BEGIN SELECT RAISE(ABORT, 'execucao append-only'); END;
    CREATE TRIGGER IF NOT EXISTS clinical_event_no_update BEFORE UPDATE ON clinical_event
      BEGIN SELECT RAISE(ABORT, 'clinical_event append-only'); END;
    CREATE TRIGGER IF NOT EXISTS clinical_event_no_delete BEFORE DELETE ON clinical_event
      BEGIN SELECT RAISE(ABORT, 'clinical_event append-only'); END;
    CREATE TRIGGER IF NOT EXISTS operation_no_update BEFORE UPDATE ON operation
      BEGIN SELECT RAISE(ABORT, 'operation append-only'); END;
    CREATE TRIGGER IF NOT EXISTS operation_no_delete BEFORE DELETE ON operation
      BEGIN SELECT RAISE(ABORT, 'operation append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_event_no_update BEFORE UPDATE ON audit_event
      BEGIN SELECT RAISE(ABORT, 'audit_event append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_event_no_delete BEFORE DELETE ON audit_event
      BEGIN SELECT RAISE(ABORT, 'audit_event append-only'); END;
  `);
}
