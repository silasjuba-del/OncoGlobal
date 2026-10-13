import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { criarSchema } from "../../src/kernel/ledger/schema";

const databases: DatabaseSync[] = [];
function banco(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  criarSchema(db);
  return db;
}
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("ledger: invariantes de integridade", () => {
  it("mantém chaves estrangeiras ativas", () => {
    const db = banco();
    expect(db.prepare("PRAGMA foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
  });

  it("rejeita evento clínico sem operação correspondente", () => {
    const db = banco();
    expect(() => db.prepare(`INSERT INTO clinical_event
      (eventId, operationId, eventIndex, patientId, encounterId, tipo,
       payload, fontes, revisao, criadoEm, criadoPor)
      VALUES ('e1','inexistente',0,'p1','c1','TESTE','{}','[]',
              'CONFIRMADO','2026-10-13T00:00:00Z','medico')`).run()).toThrow();
  });

  it("impede alteração e exclusão de eventos clínicos confirmados", () => {
    const db = banco();
    db.prepare(`INSERT INTO operation (operationId,payloadHash,criadoEm)
      VALUES ('op1','hash','2026-10-13T00:00:00Z')`).run();
    db.prepare(`INSERT INTO clinical_event
      (eventId,operationId,eventIndex,patientId,encounterId,tipo,
       payload,fontes,revisao,criadoEm,criadoPor)
      VALUES ('e1','op1',0,'p1','c1','TESTE','{}','[]',
              'CONFIRMADO','2026-10-13T00:00:00Z','medico')`).run();
    expect(() => db.prepare("UPDATE clinical_event SET payload='alterado' WHERE eventId='e1'").run()).toThrow();
    expect(() => db.prepare("DELETE FROM clinical_event WHERE eventId='e1'").run()).toThrow();
  });

  it("impede alterações de operação e auditoria", () => {
    const db = banco();
    db.prepare(`INSERT INTO operation (operationId,payloadHash,criadoEm)
      VALUES ('op1','hash','2026-10-13T00:00:00Z')`).run();
    db.prepare(`INSERT INTO audit_event
      (ator,acaoPedida,decisao,motivoCodigo,politicaVersao,em)
      VALUES ('medico','ASSINAR','NEGADO','TESTE','v1','2026-10-13T00:00:00Z')`).run();
    for (const table of ["operation", "audit_event"]) {
      expect(() => db.prepare(`UPDATE ${table} SET ${table === "operation" ? "payloadHash" : "decisao"}='x'`).run()).toThrow();
      expect(() => db.prepare(`DELETE FROM ${table}`).run()).toThrow();
    }
  });
});
