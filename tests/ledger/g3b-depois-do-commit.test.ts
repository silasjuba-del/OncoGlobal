import { describe, expect, it } from "vitest";
import { abrirLedger, depoisDoCommit, transacao } from "../../src/kernel/ledger/db.js";

describe("G3b · efeitos fora do SQLite só depois do COMMIT externo", () => {
  it("fora de transação o efeito é imediato", () => {
    const db = abrirLedger(":memory:"), publicados: string[] = [];
    depoisDoCommit(db, () => publicados.push("imediato"));
    expect(publicados).toEqual(["imediato"]);
    db.close();
  });

  it("publica na ordem só após o COMMIT; RELEASE de savepoint não publica; ROLLBACK TO descarta só o seu trecho", () => {
    const db = abrirLedger(":memory:"), publicados: string[] = [];
    transacao(db, () => {
      depoisDoCommit(db, () => publicados.push("externo"));
      transacao(db, () => { depoisDoCommit(db, () => publicados.push("savepoint-liberado")); });
      expect(publicados).toEqual([]);
      expect(() => transacao(db, () => {
        depoisDoCommit(db, () => publicados.push("savepoint-desfeito"));
        throw new Error("FALHA_SINTETICA");
      })).toThrow("FALHA_SINTETICA");
      transacao(db, () => ({ status: 409 }), (r) => r.status >= 400);
      expect(publicados).toEqual([]);
    });
    expect(publicados).toEqual(["externo", "savepoint-liberado"]);
    db.close();
  });

  it("rollback externo, por exceção ou rejeição, descarta todos os efeitos", () => {
    const db = abrirLedger(":memory:"), publicados: string[] = [];
    expect(() => transacao(db, () => {
      transacao(db, () => { depoisDoCommit(db, () => publicados.push("interno")); });
      throw new Error("FALHA_SINTETICA");
    })).toThrow("FALHA_SINTETICA");
    expect(transacao(db, () => { depoisDoCommit(db, () => publicados.push("rejeitado")); return { status: 409 }; },
      (r) => r.status >= 400)).toEqual({ status: 409 });
    expect(publicados).toEqual([]);
    // Depois de um rollback, a próxima transação começa com a fila vazia.
    transacao(db, () => { depoisDoCommit(db, () => publicados.push("seguinte")); });
    expect(publicados).toEqual(["seguinte"]);
    db.close();
  });

  it("falha de um efeito não impede os demais e é relançada depois do COMMIT", () => {
    const db = abrirLedger(":memory:"), publicados: string[] = [];
    db.exec("CREATE TABLE g3b_marca (id TEXT)");
    expect(() => transacao(db, () => {
      db.prepare("INSERT INTO g3b_marca VALUES ('gravado')").run();
      depoisDoCommit(db, () => { throw new Error("EFEITO_FALHOU"); });
      depoisDoCommit(db, () => publicados.push("segundo"));
    })).toThrow("EFEITO_FALHOU");
    expect(publicados).toEqual(["segundo"]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM g3b_marca").get()).toMatchObject({ n: 1 });
    db.close();
  });
});
