import { z } from "zod";
import { Id } from "../../contracts/base.js";
import { ContextoDutoServidor } from "../../contracts/f1/dutos.js";
const Pedido=z.object({mensagemId:Id,decisao:z.object({campo:Id,valor:z.unknown()}).strict().refine(d=>Object.hasOwn(d,"valor"))}).strict();
/** Mensagem nunca muda o prontuário. Este input é uma decisão explícita aceita pelo médico. */
export function aceitarDecisaoChat(input:unknown,contexto:ContextoDutoServidor){
 const p=Pedido.safeParse(input),c=ContextoDutoServidor.safeParse(contexto);
 if(!p.success||!c.success)return {ok:false as const,codigo:"DECISAO_CHAT_INVALIDA"};
 return {ok:true as const,tipo:"FATO" as const,contexto:{patientId:c.data.patientId,encounterId:c.data.encounterId,tumorLotId:c.data.tumorLotId},
  dados:{campo:p.data.decisao.campo,valor:p.data.decisao.valor,mensagemId:p.data.mensagemId,atorId:c.data.atorId,aceitaEm:c.data.em}};
}
