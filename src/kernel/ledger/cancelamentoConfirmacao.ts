import type {DatabaseSync} from 'node:sqlite';
/** Chamado sob a mesma transação de escrita que confirma: cancelamento vence somente antes do commit. */
export function confirmacaoCancelada(db:DatabaseSync,operationId:string):boolean {
 return !!db.prepare('SELECT 1 FROM confirmation_cancel WHERE operationId=?').get(operationId);
}
export function cancelarConfirmacao(db:DatabaseSync,operationId:string,atorId:string,em:string):void {
 db.prepare('INSERT OR IGNORE INTO confirmation_cancel(operationId,atorId,em) VALUES(?,?,?)').run(operationId,atorId,em);
}
