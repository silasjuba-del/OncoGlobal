import type {ClinicalEvent} from '../contracts/operacao.js';
import type {GerenciadorSessao} from './sessao.js';
import {hashConteudoExibido} from './sessao.js';
type Contexto={patientId:string;encounterId:string;tumorLotId:string|null};
export function registrarFontesDutoExibidas(sessoes:GerenciadorSessao,token:string,c:Contexto,eventos:readonly ClinicalEvent[]){
 for(const e of eventos)sessoes.registrarConteudoExibido?.(token,c,'DUTO_FONTE',e.eventId,hashConteudoExibido(e));
}
export function fonteDutoFoiExibida(sessoes:GerenciadorSessao,token:string,c:Contexto,e:ClinicalEvent):boolean{
 return sessoes.conteudoFoiExibido?.(token,c,'DUTO_FONTE',e.eventId,hashConteudoExibido(e))===true;
}
