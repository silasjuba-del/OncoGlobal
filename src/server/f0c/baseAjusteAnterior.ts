import type { ClinicalEvent } from '../../contracts/operacao.js';
import { Ciclo, TreatmentEpisode, TreatmentAdministration } from '../../contracts/clinico.js';
import type { ProtocolTemplate, PrescriptionItem } from '../../contracts/w10/prescricao.js';
import { dadosDoEvento, eventosVigentes } from '../../kernel/projections/snapshot.js';
import { horizonteDoEncontro } from './avaliacaoConsulta.js';

const nome=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
/** K-06: base é a quantidade efetivamente administrada no ciclo anterior, nunca a dose apenas planejada. */
export function baseAjusteAnterior(eventos:readonly ClinicalEvent[],ctx:{patientId:string;encounterId:string;tumorLotId?:string|null},template:ProtocolTemplate,agora:string){
 const vazio=(motivo:string)=>({itens:[] as PrescriptionItem[],motivo,cicloAnteriorId:null as string|null,
  pendencias:[] as {droga:string;motivo:string;eventIds:string[]}[],
  fontes:[] as {eventId:string;adminId:string;quantidadeEfetivaMg:number;status:string;fonte:TreatmentAdministration['fonte']}[]});
 if(!ctx.tumorLotId)return vazio('LOTE_ANTERIOR_NAO_DEFINIDO');
 const paciente=eventos.filter(e=>e.patientId===ctx.patientId),horizonte=horizonteDoEncontro(paciente,ctx.encounterId,agora);
 const vigentes=eventosVigentes(paciente.filter(e=>e.tumorLotId===ctx.tumorLotId&&Date.parse(e.criadoEm)<=horizonte));
 const ciclos=vigentes.filter(e=>e.tipo==='Ciclo').flatMap(e=>{const c=Ciclo.safeParse(dadosDoEvento(e));return c.success?[{evento:e,ciclo:c.data}]:[];});
 const atuais=ciclos.filter(c=>c.evento.encounterId===ctx.encounterId);
 if(atuais.length!==1)return vazio('CICLO_ATUAL_AUSENTE_OU_AMBIGUO');
 const atual=atuais[0]!.ciclo;
 const episodios=vigentes.filter(e=>e.tipo==='TreatmentEpisode').flatMap(e=>{const p=TreatmentEpisode.safeParse(dadosDoEvento(e));return p.success&&p.data.episodioId===atual.episodioId&&p.data.tumorLotId===ctx.tumorLotId?[p.data]:[];});
 if(episodios.length!==1||episodios[0]!.esquemaId!==template.templateId)return vazio('EPISODIO_OU_FICHA_ANTERIOR_DIVERGENTE');
 if(atual.numero===1)return vazio('PRIMEIRO_CICLO_SEM_BASE_ANTERIOR');
 const anteriores=ciclos.filter(c=>c.ciclo.episodioId===atual.episodioId&&c.ciclo.numero===atual.numero-1);
 if(anteriores.length!==1||!anteriores[0]!.ciclo.prescricaoRef)return vazio('CICLO_ANTERIOR_AUSENTE_OU_AMBIGUO');
 const anterior=anteriores[0]!.ciclo,ref=anterior.prescricaoRef!;
 const administracoes=vigentes.filter(e=>e.tipo==='TreatmentAdministration').flatMap(e=>{
  const a=TreatmentAdministration.safeParse(dadosDoEvento(e));if(!a.success)return[];
  const v=a.data,data=v.fim??v.inicio??v.fonte.dataClinica;
  if(v.cicloId!==anterior.cicloId||v.prescricaoRef.documentId!==ref.documentId||v.prescricaoRef.documentVersion!==ref.documentVersion
   ||!data||!Number.isFinite(Date.parse(data))||Date.parse(data)>horizonte
   ||(v.inicio!==null&&v.fim!==null&&Date.parse(v.fim)<Date.parse(v.inicio))
   ||!e.fontes.some(f=>f.sourceId===v.fonte.sourceId&&f.contentHash===v.fonte.contentHash)
   ||!anterior.itens.some(i=>i.item===v.item&&nome(i.droga)===nome(v.droga)))return[];
  return[{evento:e,admin:v}];
 });
 const fontes:ReturnType<typeof vazio>['fontes']=[];
 const pendencias:ReturnType<typeof vazio>['pendencias']=[];
 const itens=template.itens.map(item=>{
  const candidatos=administracoes.filter(a=>nome(a.admin.droga)===nome(item.drug));
  const emMg=['MG_M2','MG_KG','AUC'].includes(item.doseBasis)||(item.doseBasis==='FIXED'&&item.unit==='mg');
  const unico=template.itens.filter(i=>nome(i.drug)===nome(item.drug)).length===1;
  const efetivas=candidatos.filter(a=>a.admin.status!=='OMITIDA'&&a.admin.quantidadeEfetivaMg>0)
    .sort((a,b)=>Date.parse(a.admin.inicio??'')-Date.parse(b.admin.inicio??''));
  // Fragmentos só podem ser somados para uma única administração prevista do item,
  // com IDs distintos e intervalos fechados não sobrepostos. Itens previstos em múltiplos dias não são fundidos.
  const fragmentos=efetivas.length<=1||(item.days.length===1&&/^d\d+$/.test(item.days[0]!)
    &&efetivas.every((a,i)=>a.admin.inicio!==null&&a.admin.fim!==null&&Date.parse(a.admin.fim)>Date.parse(a.admin.inicio)
      &&(i===0||Date.parse(a.admin.inicio)>=Date.parse(efetivas[i-1]!.admin.fim!))));
  const total=efetivas.reduce((s,a)=>s+a.admin.quantidadeEfetivaMg,0);
  const valido=emMg&&unico&&fragmentos&&new Set(candidatos.map(a=>a.admin.adminId)).size===candidatos.length
    &&new Set(candidatos.map(a=>a.admin.item)).size===1&&Number.isSafeInteger(total)&&total>0;
  if(valido)for(const a of efetivas)fontes.push({eventId:a.evento.eventId,adminId:a.admin.adminId,quantidadeEfetivaMg:a.admin.quantidadeEfetivaMg,status:a.admin.status,fonte:a.admin.fonte});
  else pendencias.push({droga:item.drug,motivo:candidatos.length?'BASE_EFETIVA_AMBIGUA_OU_UNIDADE_INCOMPATIVEL':'ADMINISTRACAO_EFETIVA_ANTERIOR_AUSENTE',eventIds:candidatos.map(a=>a.evento.eventId)});
  return {...item,unit:emMg?'mg':item.unit,prescribedDose:valido?total:null};
 });
 return{itens,motivo:itens.some(i=>i.prescribedDose===null)?'BASE_EFETIVA_PARCIAL_REVISAR_ITENS':null,cicloAnteriorId:anterior.cicloId,fontes,pendencias};
}
