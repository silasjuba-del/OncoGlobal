import {ConfirmacaoPendente} from '../../contracts/api/recuperacaoConfirmacao.js';
import {ErroPorta} from './porta.js';
const prefixo='oncoglobal:confirmacao:v1:';
const armazenamento=()=> typeof window==='undefined' ? {
 getItem:(_k:string)=>null,setItem:(_k:string,_v:string)=>{},removeItem:(_k:string)=>{}
} : window.sessionStorage;
const chave=(tipo:ConfirmacaoPendente['tipo'],c:ConfirmacaoPendente['pedido']['contexto'])=>prefixo+JSON.stringify([tipo,c.patientId,c.encounterId,c.tumorLotId]);
const avisar=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('confirmacoes-pendentes'));};
export function pendente(tipo:ConfirmacaoPendente['tipo'],c:ConfirmacaoPendente['pedido']['contexto']):ConfirmacaoPendente|null {
 try{const texto=armazenamento().getItem(chave(tipo,c));if(!texto)return null;return ConfirmacaoPendente.parse(JSON.parse(texto));}
 catch{throw new ErroPorta('RECUPERACAO_LOCAL_INDISPONIVEL');}
}
export function guardarPendente(valor:ConfirmacaoPendente):void {
 const v=ConfirmacaoPendente.parse(valor),antes=pendente(v.tipo,v.pedido.contexto);
 if(antes&&JSON.stringify(antes)!==JSON.stringify(v))throw new ErroPorta('CONFIRMACAO_PENDENTE_RECONCILIAR');
 try{armazenamento().setItem(chave(v.tipo,v.pedido.contexto),JSON.stringify(v));}catch{throw new ErroPorta('RECUPERACAO_LOCAL_INDISPONIVEL');}avisar();
}
export function concluirPendente(v:ConfirmacaoPendente):void {armazenamento().removeItem(chave(v.tipo,v.pedido.contexto));avisar();}
export function exigirSemPendente(tipo:ConfirmacaoPendente['tipo'],c:ConfirmacaoPendente['pedido']['contexto']):void {
 if(pendente(tipo,c))throw new ErroPorta('CONFIRMACAO_PENDENTE_RECONCILIAR');
}
