import type { ClinicalEvent } from "../../contracts/operacao.js";
import { Ciclo,TreatmentEpisode } from "../../contracts/clinico.js";
import { ProtocolTemplate } from "../../contracts/w10/prescricao.js";
import { dadosDoEvento,eventosVigentes } from "../../kernel/projections/snapshot.js";
import { avaliarIntervaloCiclo } from "../../rules/f0c/intervaloCiclo.js";
export interface EntradaIntervaloClinico {
 eventos:readonly ClinicalEvent[];patientId:string;encounterId:string;tumorLotId:string|null;agora:string;hoje:string;
 episodio?:unknown;ciclo?:unknown;templates?:readonly unknown[];dataProxima?:string|null;
}
/** Apenas início efetivo explicitamente registrado. Administração D3 e previsão anterior não são âncoras. */
export function projetarIntervaloCiclo(i:EntradaIntervaloClinico) {
 const fontes={eventIds:[] as string[],sourceIds:[] as string[]};
 const templateRef:{id:string;versao:string;hash:string;fonte:string}|null=null;
 const pendente=(motivo:string)=>({...avaliarIntervaloCiclo({inicioAnterior:null,dataProxima:null,intervaloDias:null}),motivo,aplicavel:true as boolean|null,fontes,templateRef});
 const agora=Date.parse(i.agora);if(!Number.isFinite(agora)) return pendente("HORARIO_ATUAL_INVALIDO");
 const eventos=eventosVigentes(i.eventos.filter(e=>e.patientId===i.patientId && e.tumorLotId===i.tumorLotId && Date.parse(e.criadoEm)<=agora));
 const ep=TreatmentEpisode.safeParse(i.episodio),ci=Ciclo.safeParse(i.ciclo);
 if(!ep.success || !ci.success || !i.tumorLotId || ep.data.tumorLotId!==i.tumorLotId || ci.data.episodioId!==ep.data.episodioId)
  return pendente("EPISODIO_CICLO_OU_LOTE_PENDENTE");
 const vinculoEp=eventos.filter(e=>e.tipo==="TreatmentEpisode").some(e=>{const p=TreatmentEpisode.safeParse(dadosDoEvento(e));return p.success && JSON.stringify(p.data)===JSON.stringify(ep.data);});
 const vinculoCi=eventos.filter(e=>e.tipo==="Ciclo" && e.encounterId===i.encounterId).some(e=>{const p=Ciclo.safeParse(dadosDoEvento(e));return p.success && JSON.stringify(p.data)===JSON.stringify(ci.data);});
 if(!vinculoEp || !vinculoCi) return pendente("CICLO_EPISODIO_SEM_VINCULO_CONFIRMADO_AO_PACIENTE");
 if(ci.data.numero===1) return {...pendente("C1_INTERVALO_ENTRE_CICLOS_NAO_APLICAVEL"),estado:"SEM_AVISO" as const,aplicavel:false};
 const templates=(i.templates??[]).flatMap(t=>{const p=ProtocolTemplate.safeParse(t);return p.success && p.data.templateId===ep.data.esquemaId && p.data.status==="CONFERIDA_MEDICO" ? [p.data]:[];});
 if(templates.length!==1) return pendente("FICHA_CURADA_AUSENTE_OU_AMBIGUA");
 const template=templates[0]!;
 const anteriores=eventos.filter(e=>e.tipo==="Ciclo").flatMap(e=>{const p=Ciclo.safeParse(dadosDoEvento(e));return p.success && p.data.episodioId===ep.data.episodioId && p.data.numero===ci.data.numero-1 ? [p.data]:[];});
 if(anteriores.length!==1) return pendente("CICLO_ANTERIOR_AUSENTE_OU_AMBIGUO");
 const anterior=anteriores[0]!;
 const ancoras=eventos.filter(e=>e.tipo==="FATO" && e.fontes.length>0).flatMap(e=>{
  const d=dadosDoEvento(e);if(d?.campo!=="inicioCicloEfetivo" || d.cicloId!==anterior.cicloId || d.episodioId!==ep.data.episodioId || typeof d.valor!=="string") return [];
  return [{data:d.valor,eventId:e.eventId,sourceIds:e.fontes.map(f=>f.sourceId)}];
 });
 fontes.eventIds=ancoras.map(a=>a.eventId);fontes.sourceIds=[...new Set(ancoras.flatMap(a=>a.sourceIds))];
 if(!ancoras.length || new Set(ancoras.map(a=>a.data)).size!==1) return pendente("INICIO_EFETIVO_ANTERIOR_AUSENTE_OU_CONFLITANTE");
 const inicio=ancoras[0]!.data;
 if(inicio>i.hoje) return pendente("INICIO_EFETIVO_ANTERIOR_FUTURO");
 return {...avaliarIntervaloCiclo({inicioAnterior:inicio,dataProxima:i.dataProxima===undefined ? ci.data.previstoEm : i.dataProxima,intervaloDias:template.intervaloDias}),
  aplicavel:true,fontes,templateRef:{id:template.templateId,versao:template.versao,hash:template.hash,fonte:template.fonte}};
}
