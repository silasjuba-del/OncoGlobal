import type { DatabaseSync } from "node:sqlite";
import { EstimuloTecnico } from "../../../contracts/f1/estimuloTecnico.js";
import { transacao } from "../../ledger/db.js";

export function gravarEstimulo(db: DatabaseSync, input: EstimuloTecnico): void {
  const e = EstimuloTecnico.parse(input), json = JSON.stringify(e);
  const old = db.prepare("SELECT conteudo FROM estimulo_tecnico WHERE id=?").get(e.id);
  if(old) { if(old.conteudo !== json) throw new Error("ESTIMULO_CHAVE_CONFLITANTE"); return; }
  transacao(db, () => {
    db.prepare("INSERT INTO estimulo_tecnico(id,operationId,conteudo,criadoEm) VALUES(?,?,?,?)").run(e.id,e.operationId,json,e.criadoEm);
    db.prepare("INSERT INTO execucao_tecnica(runId,indice,estado,conteudo,criadoEm) VALUES(?,0,'PENDENTE',?,?)").run(e.id,json,e.criadoEm);
  });
}
export function listarEstimulos(db:DatabaseSync): EstimuloTecnico[] {
  return db.prepare("SELECT conteudo FROM estimulo_tecnico ORDER BY criadoEm,id").all().map(r => EstimuloTecnico.parse(JSON.parse(String(r.conteudo))));
}
export function registrarExecucao(db:DatabaseSync,runId:string,estado:"EM_CURSO"|"PRONTO"|"CONCLUIDO"|"FALHOU",conteudo:unknown,em:string):void {
  transacao(db,()=>{
    const n=Number(db.prepare("SELECT max(indice) AS n FROM execucao_tecnica WHERE runId=?").get(runId)?.n);
    if(!Number.isInteger(n)) throw new Error("RUN_AUSENTE");
    db.prepare("INSERT INTO execucao_tecnica(runId,indice,estado,conteudo,criadoEm) VALUES(?,?,?,?,?)").run(runId,n+1,estado,JSON.stringify(conteudo),em);
  });
}
export function listarExecucoesPendentes(db:DatabaseSync):EstimuloTecnico[] {
  const ids=new Set(db.prepare(`SELECT a.runId FROM execucao_tecnica a WHERE a.indice=(SELECT max(b.indice) FROM execucao_tecnica b WHERE b.runId=a.runId)
    AND a.estado IN ('PENDENTE','EM_CURSO')`).all().map(r=>String(r.runId)));
  return listarEstimulos(db).filter(e=>ids.has(e.id));
}
