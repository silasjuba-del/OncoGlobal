import type { DatabaseSync } from "node:sqlite";
import type { ResultadoGateway, StoreIdempotencia } from "../gateway/gateway.js";

type Registro = ReturnType<StoreIdempotencia["get"]>;

function ler(db: DatabaseSync, chave: string): Registro {
  const row = db.prepare("SELECT payloadHash, resultado FROM action_idempotency WHERE chave=?").get(chave);
  if (!row) return undefined;
  const resultado: unknown = JSON.parse(String(row.resultado));
  if (!resultado || typeof resultado !== "object"
    || !["EXECUTADA", "OUTCOME_UNKNOWN", "FALHOU"].includes(String((resultado as ResultadoGateway).decisao))
    || typeof (resultado as ResultadoGateway).motivoCodigo !== "string")
    throw new Error("IDEMPOTENCIA_CORROMPIDA");
  return { payloadHash: String(row.payloadHash), resultado: resultado as ResultadoGateway };
}

/** W4-01 · reserva atomica antes do efeito, independente do ciclo de vida do gateway. */
export function sqliteIdempotencia(db: DatabaseSync): StoreIdempotencia {
  return {
    get: (chave) => ler(db, chave),
    reserve(chave, payloadHash, atualizadoEm) {
      const resultado: ResultadoGateway = {
        decisao: "OUTCOME_UNKNOWN", motivoCodigo: "RESERVADA_EM_EXECUCAO",
      };
      // Um INSERT atomico decide o vencedor mesmo com dois gateways/processos sobre o mesmo SQLite.
      const insert = db.prepare(`INSERT INTO action_idempotency
        (chave,payloadHash,resultado,atualizadoEm) VALUES (?,?,?,?)
        ON CONFLICT(chave) DO NOTHING`).run(
        chave, payloadHash, JSON.stringify(resultado), atualizadoEm,
      );
      const registro = ler(db, chave);
      if (!registro) throw new Error("IDEMPOTENCIA_RESERVA_AUSENTE");
      return { criada: Number(insert.changes) === 1, registro };
    },
    set(chave, value, atualizadoEm) {
      const update = db.prepare(`UPDATE action_idempotency
        SET resultado=?, atualizadoEm=? WHERE chave=? AND payloadHash=?`).run(
        JSON.stringify(value.resultado), atualizadoEm, chave, value.payloadHash,
      );
      if (Number(update.changes) !== 1) throw new Error("IDEMPOTENCIA_SEM_RESERVA");
    },
    delete(chave) {
      db.prepare("DELETE FROM action_idempotency WHERE chave=?").run(chave);
    },
  };
}
