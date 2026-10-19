import type { DatabaseSync } from 'node:sqlite';
import type { ClinicalEvent } from '../contracts/operacao.js';
import { dadosDoEvento,eventosVigentes } from '../kernel/projections/snapshot.js';
import { Contato, Paciente } from '../contracts/clinico.js';
import { projetarVinculosContato } from '../kernel/projections/vinculosContato.js';

export interface RelatoInfusaoPendente {
 patientId:string; mensagemId:string; payloadSha256:string; texto:string; em:string;
 contextoMensagens: {mensagemId:string;texto:string;em:string}[];
}
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Localização documental, não diagnóstico nem regra de alarme clínico. Inclusive negativas ficam para leitura. */
export function relatoMencionaInfusao(s:string):boolean {
 return /\b(infusao|platina|empolad[ao]|garganta apertou|remedio (?:da|na) veia)\b/.test(normal(s));
}
export function relatosInfusaoPendentes(db:DatabaseSync,eventos:readonly ClinicalEvent[],agora:string):RelatoInfusaoPendente[] {
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='canal_mensagem'").get())return [];
 const vigentes=eventosVigentes(eventos.filter(e=>Date.parse(e.criadoEm)<=Date.parse(agora)));
 const contatos=vigentes.filter(e=>e.tipo==='Contato'&&['CONFIRMADO','ASSINADO'].includes(e.revisao)).flatMap(event=>{
  const c=Contato.safeParse(dadosDoEvento(event));return c.success?[{event,value:c.data}]:[];
 });
 const projetados=projetarVinculosContato(contatos,vigentes);
 const pacientes=new Set(vigentes.filter(e=>e.tipo==='Paciente'&&['CONFIRMADO','ASSINADO'].includes(e.revisao))
  .flatMap(e=>{const p=Paciente.safeParse(dadosDoEvento(e));return p.success&&p.data.patientId===e.patientId?[p.data.patientId]:[];}));
 const rows=db.prepare(`SELECT mensagemId,vinculoClasse,vinculoPatientId,senderRef,canal,conteudo,payloadSha256,ingestedAt FROM canal_mensagem
  WHERE provaMetodo <> 'IMAP_CONTA_LOCAL'
  ORDER BY ingestedAt,mensagemId`).all() as {mensagemId:string;vinculoClasse:string;vinculoPatientId:string|null;senderRef:string;canal:string;conteudo:string;payloadSha256:string;ingestedAt:string}[];
 const mensagens=rows.filter(r=>Date.parse(r.ingestedAt)<=Date.parse(agora)).flatMap(r=>{
  if(r.vinculoClasse==='AMBIGUO')return [];
  const contatosAtuais=projetados.filter(c=>c.value.endereco===r.senderRef&&c.value.canal===r.canal);
  if(contatosAtuais.some(c=>c.value.revogadoEm!==null||c.estadoVinculo==='CONFLITO'))return [];
  const alvos=[...new Set(contatosAtuais.flatMap(c=>c.patientIdResolvido?[c.patientIdResolvido]:[]))];
  if(alvos.length>1)return [];
  const patientId=alvos[0]??(r.vinculoClasse==='CONHECIDO'?r.vinculoPatientId:null);
  if(!patientId||!pacientes.has(patientId)||(r.vinculoPatientId&&r.vinculoPatientId!==patientId))return [];
  try {const c=JSON.parse(r.conteudo) as {tipo?:string;texto?:string};
   return c.tipo==='TEXT'&&typeof c.texto==='string'?[{patientId,mensagemId:r.mensagemId,payloadSha256:r.payloadSha256,texto:c.texto,em:r.ingestedAt}]:[];
  }catch{return [];}
 });
 return mensagens.filter(m=>relatoMencionaInfusao(m.texto)).filter(m=>!vigentes.some(e=>{
  if(e.tipo!=='ReviewDecision'||e.patientId!==m.patientId||e.criadoPor.tipo!=='SESSAO'||!['CONFIRMADO','ASSINADO'].includes(e.revisao)
   ||Date.parse(e.criadoEm)<Date.parse(m.em)||Date.parse(e.criadoEm)>Date.parse(agora))return false;
  const d=dadosDoEvento(e);
  return d?.campo==='revisaoRelatoInfusaoCanal'&&d.mensagemId===m.mensagemId&&d.payloadSha256===m.payloadSha256
   &&typeof d.decisao==='string'&&!!d.decisao.trim();
 })).map(m=>({...m,contextoMensagens:mensagens.filter(x=>x.patientId===m.patientId&&Date.parse(x.em)>=Date.parse(m.em))
  .map(({mensagemId,texto,em})=>({mensagemId,texto,em}))}));
}
