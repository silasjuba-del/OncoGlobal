import { z } from "zod";
import { TreatmentAdministration } from "../../contracts/clinico.js";
import { PrescricaoAssinadaRef, ContextoDutoServidor, mesmoContexto } from "../../contracts/f1/dutos.js";
const Pedido=z.object({prescricao:PrescricaoAssinadaRef,administracao:TreatmentAdministration}).strict();
/** Registro efetivo fornecido pela pessoa; nenhum cálculo de dose ou administração presumida. */
export function registrarAdministracao(input:unknown,contexto:ContextoDutoServidor){
 const p=Pedido.safeParse(input),c=ContextoDutoServidor.safeParse(contexto);
 if(!p.success||!c.success)return {ok:false as const,codigo:"ADMINISTRACAO_INVALIDA"};
 const a=p.data.administracao,r=p.data.prescricao;
 if(!mesmoContexto(r,c.data)||a.prescricaoRef.documentId!==r.documentId||a.prescricaoRef.documentVersion!==r.documentVersion)
  return {ok:false as const,codigo:"PRESCRICAO_OU_CONTEXTO_DIVERGENTE"};
 if(a.quantidadeEfetivaMg>0&&a.inicio===null)return {ok:false as const,codigo:"ADMINISTRACAO_EFETIVA_SEM_INICIO"};
 if(a.inicio!==null&&a.fim!==null&&Date.parse(a.fim)<Date.parse(a.inicio))return {ok:false as const,codigo:"ADMINISTRACAO_INTERVALO_INVALIDO"};
 if(a.inicio!==null&&Date.parse(a.inicio)>Date.parse(c.data.em))return {ok:false as const,codigo:"ADMINISTRACAO_FUTURA"};
 if(a.fim!==null&&Date.parse(a.fim)>Date.parse(c.data.em))return {ok:false as const,codigo:"ADMINISTRACAO_FUTURA"};
 return {ok:true as const,tipo:"TreatmentAdministration" as const,contexto:{patientId:c.data.patientId,encounterId:c.data.encounterId,tumorLotId:c.data.tumorLotId},dados:a,atorId:c.data.atorId};
}
