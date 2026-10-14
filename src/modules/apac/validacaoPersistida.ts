import { createHash } from "node:crypto";
import { z } from "zod";
import { Apac } from "../../contracts/operacao.js";
import { VereditoAntiglosa } from "../../contracts/w10/clinico-w10.js";
import { ContextoDutoServidor, PrescricaoAssinadaRef, ReferenciaSigtap, ValidacaoApacPersistida, mesmoContexto, mesmaPrescricao } from "../../contracts/f1/dutos.js";
const Referencias=z.object({apac:Apac,prescricao:PrescricaoAssinadaRef,sigtap:ReferenciaSigtap}).strict();
const Pedido=Referencias.extend({antiglosa:VereditoAntiglosa}).strict();
function canonico(v:unknown):string {if(Array.isArray(v))return `[${v.map(canonico).join(",")}]`;if(v!==null&&typeof v==="object")return `{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${canonico(x)}`).join(",")}}`;return JSON.stringify(v)??"null";}
export function hashApac(apac:Apac):string{return createHash("sha256").update(canonico(Apac.parse(apac))).digest("hex");}
/** Persiste o resultado da validação administrativa; nunca fabrica autorização externa. */
export function criarValidacaoPersistida(input:unknown,contexto:ContextoDutoServidor){
 const p=Pedido.safeParse(input),c=ContextoDutoServidor.safeParse(contexto);
 if(!p.success||!c.success)return {ok:false as const,codigo:"VALIDACAO_APAC_INVALIDA"};
 const {apac,prescricao,sigtap,antiglosa}=p.data;
 if(!mesmoContexto(prescricao,c.data)||apac.tumorLotId!==c.data.tumorLotId||apac.prescricaoAssinadaRef.documentId!==prescricao.documentId||apac.prescricaoAssinadaRef.documentVersion!==prescricao.documentVersion)
  return {ok:false as const,codigo:"PRESCRICAO_OU_CONTEXTO_DIVERGENTE"};
 if(sigtap.competencia!==apac.competencia||antiglosa.competencia!==apac.competencia||antiglosa.apacId!==apac.apacId)
  return {ok:false as const,codigo:"COMPETENCIA_OU_APAC_DIVERGENTE"};
 if(!antiglosa.exportavel)return {ok:false as const,codigo:"ANTIGLOSA_IMPEDE_EXPORTACAO"};
 const validacao:ValidacaoApacPersistida={patientId:c.data.patientId,encounterId:c.data.encounterId,tumorLotId:c.data.tumorLotId,apacId:apac.apacId,apacVersao:apac.versao,apacHash:hashApac(apac),prescricao,sigtap,validadoPor:c.data.atorId,validadoEm:c.data.em,exportavel:true};
 return {ok:true as const,validacao};
}
export function validarReferenciaApac(input:unknown,referencias:unknown):boolean{
 const v=ValidacaoApacPersistida.safeParse(input),r=Referencias.safeParse(referencias);
 if(!v.success||!r.success)return false;
 return mesmoContexto(v.data,v.data.prescricao)&&v.data.tumorLotId===r.data.apac.tumorLotId&&v.data.apacId===r.data.apac.apacId&&v.data.apacVersao===r.data.apac.versao&&v.data.apacHash===hashApac(r.data.apac)
  &&mesmaPrescricao(v.data.prescricao,r.data.prescricao)&&v.data.sigtap.competencia===r.data.sigtap.competencia&&v.data.sigtap.versao===r.data.sigtap.versao&&v.data.sigtap.hash===r.data.sigtap.hash;
}
