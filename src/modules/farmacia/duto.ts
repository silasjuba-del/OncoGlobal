import { z } from "zod";
import { PrescricaoAssinadaRef, ConferenciaFarmacia, ContextoDutoServidor, mesmoContexto, mesmaPrescricao } from "../../contracts/f1/dutos.js";
const Pedido=z.object({prescricao:PrescricaoAssinadaRef,acao:z.enum(["CONFERIR","PEDIR_CORRECAO"]),motivo:z.string().trim().min(1).optional(),anterior:ConferenciaFarmacia.optional()}).strict();
/** Nunca modifica conteúdo. Nova versão requer novo envio, não herda conferência. */
export function conferirPrescricao(input:unknown,contexto:ContextoDutoServidor):{ok:true;registro:ConferenciaFarmacia}|{ok:false;codigo:string}{
 const c=ContextoDutoServidor.safeParse(contexto),p=Pedido.safeParse(input);
 if(!c.success||!p.success)return {ok:false,codigo:"DUTO_FARMACIA_INVALIDO"};
 if(!mesmoContexto(p.data.prescricao,c.data))return {ok:false,codigo:"CONTEXTO_DIVERGENTE"};
 if(p.data.anterior&&!mesmaPrescricao(p.data.anterior.prescricao,p.data.prescricao))return {ok:false,codigo:"CONFERENCIA_INVALIDADA_POR_VERSAO"};
 if(p.data.anterior&&p.data.anterior.estado!=="ENVIADA")return {ok:false,codigo:"TRANSICAO_INVALIDA"};
 if(p.data.acao==="PEDIR_CORRECAO"&&!p.data.motivo)return {ok:false,codigo:"MOTIVO_OBRIGATORIO"};
 return {ok:true,registro:{prescricao:p.data.prescricao,estado:p.data.acao==="CONFERIR"?"CONFERIDA":"CORRECAO_PEDIDA",motivo:p.data.motivo??null,atorId:c.data.atorId,em:c.data.em}};
}
