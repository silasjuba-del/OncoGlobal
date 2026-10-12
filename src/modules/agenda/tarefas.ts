import { Tarefa } from "../../contracts/f1/tarefa.js";
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
