import { Tarefa, AcompanhamentoPedido } from "../../contracts/f1/tarefa.js";
import { ContextoDutoServidor, mesmoContexto } from "../../contracts/f1/dutos.js";
function alterar(input:unknown,contexto:ContextoDutoServidor,concluir:boolean){
 const t=Tarefa.safeParse(input),c=ContextoDutoServidor.safeParse(contexto);
 if(!t.success||!c.success)return {ok:false as const,codigo:"TAREFA_INVALIDA"};
 if(!mesmoContexto(t.data,c.data)||t.data.responsavel!==c.data.atorId)return {ok:false as const,codigo:"CONTEXTO_OU_RESPONSAVEL_DIVERGENTE"};
 if(t.data.estado!=="CONFIRMADA")return {ok:false as const,codigo:"TRANSICAO_INVALIDA"};
 if(concluir&&t.data.recebidoEm===null)return {ok:false as const,codigo:"RECEBIMENTO_PENDENTE"};
 return {ok:true as const,tarefa:{...t.data,recebidoEm:t.data.recebidoEm??c.data.em,estado:concluir?"CONCLUIDA" as const:"CONFIRMADA" as const}};
}
export const receberTarefa=(input:unknown,contexto:ContextoDutoServidor)=>alterar(input,contexto,false);
export const concluirTarefa=(input:unknown,contexto:ContextoDutoServidor)=>alterar(input,contexto,true);

/** Estados de exame são independentes da conclusão administrativa da tarefa de retorno. */
export function atualizarResultadoPedido(tarefa:Tarefa, contexto:ContextoDutoServidor, proximo:AcompanhamentoPedido){
 if(tarefa.patientId!==contexto.patientId||tarefa.tumorLotId!==contexto.tumorLotId||["CANCELADA","SUPERSEDED","RASCUNHO"].includes(tarefa.estado))return {ok:false as const,codigo:"TAREFA_FORA_CONTEXTO"};
 const igual=(p:{documentId:string;documentVersion:number})=>p.documentId===proximo.pedido.documentId&&p.documentVersion===proximo.pedido.documentVersion;
 if(!tarefa.pedidoRefs.some(igual))return {ok:false as const,codigo:"PEDIDO_FORA_TAREFA"};
 const anterior=tarefa.acompanhamentoPedidos.find(r=>igual(r.pedido));
 const ordem=["SOLICITADO","REALIZADO","RESULTADO_DISPONIVEL","REVISADO"];
 if(ordem.indexOf(proximo.estado)!==ordem.indexOf(anterior?.estado??"SOLICITADO")+1)return {ok:false as const,codigo:"TRANSICAO_RESULTADO_INVALIDA"};
 const mesmaFonte = anterior?.resultado && proximo.resultado && (["draftId","revision","sourceId","hash","encounterId"] as const).every(k=>anterior.resultado![k]===proximo.resultado![k]);
 if(proximo.estado==="REVISADO"&&!mesmaFonte)return {ok:false as const,codigo:"RESULTADO_ALTERADO"};
 if(proximo.resultado&&proximo.resultado.encounterId!==contexto.encounterId&&!(proximo.estado==="REVISADO"&&mesmaFonte))return {ok:false as const,codigo:"RESULTADO_FORA_ENCONTRO"};
 if(proximo.estado==="REVISADO"&&(proximo.revisadoPor!==contexto.atorId||proximo.revisadoEm!==contexto.em))return {ok:false as const,codigo:"REVISAO_NAO_AUTORIZADA"};
 const p=Tarefa.safeParse({...tarefa,atualizadoNoEncontroId:contexto.encounterId,acompanhamentoPedidos:[...tarefa.acompanhamentoPedidos.filter(r=>!igual(r.pedido)),proximo]});
 return p.success?{ok:true as const,tarefa:p.data}:{ok:false as const,codigo:"RESULTADO_INVALIDO"};
}
