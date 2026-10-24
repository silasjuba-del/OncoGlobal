import { DatabaseSync } from "node:sqlite";
import { criarSchema } from "./schema.js";

export function abrirLedger(caminho: string): DatabaseSync {
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  criarSchema(db);
  return db;
}

/** BEGIN IMMEDIATE serializes competing writers before checking revisions. */
let proximoSavepoint = 0;

/** Efeitos fora do SQLite enfileirados pela unidade atômica aberta por transacao(). */
const pendentes = new WeakMap<DatabaseSync, { efeitos: Array<() => void> }>();

/**
 * Efeito fora do SQLite (ex.: comprovante na sessão em memória) só depois do COMMIT da
 * transação externa. Rollback, inclusive ROLLBACK TO de um savepoint, descarta o efeito
 * e preserva o estado anterior; RELEASE de savepoint não basta para publicá-lo.
 */
export function depoisDoCommit(db: DatabaseSync, efeito: () => void): void {
  const estado = pendentes.get(db);
  if (!estado) { efeito(); return; }
  estado.efeitos.push(efeito);
}

function publicar(efeitos: ReadonlyArray<() => void>): void {
  // Todos os efeitos do commit são publicados; a primeira falha é relançada ao final.
  let falha: unknown, falhou = false;
  for (const efeito of efeitos) {
    try { efeito(); } catch (error) { if (!falhou) { falha = error; falhou = true; } }
  }
  if (falhou) throw falha;
}

/** A rejeicao de dominio devolve o resultado somente depois de desfazer a unidade atomica. */
export function transacao<T>(db: DatabaseSync, fn: () => T, rejeitar?: (resultado:T)=>boolean): T {
  const sinal={};let rejeitado:T;
  try { return transacaoInterna(db,()=>{const resultado=fn();if(rejeitar?.(resultado)){rejeitado=resultado;throw sinal;}return resultado;}); }
  catch(error){if(error===sinal)return rejeitado!;throw error;}
}
function transacaoInterna<T>(db: DatabaseSync, fn: () => T): T {
  // Operações compostas podem reunir vários drafts em uma única unidade atômica.
  if (db.isTransaction) {
    const savepoint = `ledger_aninhado_${++proximoSavepoint}`;
    const estado = pendentes.get(db), marca = estado?.efeitos.length ?? 0;
    db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = fn();
      db.exec(`RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      db.exec(`ROLLBACK TO ${savepoint}`);
      db.exec(`RELEASE ${savepoint}`);
      if (estado) estado.efeitos.length = marca;
      throw error;
    }
  }
  db.exec("BEGIN IMMEDIATE");
  const estado = { efeitos: [] as Array<() => void> };
  pendentes.set(db, estado);
  let result: T;
  try {
    result = fn();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    pendentes.delete(db);
  }
  publicar(estado.efeitos);
  return result;
}
