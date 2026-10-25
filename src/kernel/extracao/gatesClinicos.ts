import type {ClinicalFact} from '../../contracts/w10/extracao.js';
import {g07Lateralidade,g08AnatomiaSexo,g09PtDeBiopsia,type Veredito} from '../harness/gates.js';
import {hashCanonico} from '../../modules/tipos.js';
import {normalizarLateralidade} from './normalizacao.js';
export type FatoGate=Pick<ClinicalFact,'id'|'sourceId'|'sourceType'|'domain'|'value'|'rawEvidence'|'evidence'|'qualificadores'>;
export type AvisoGate=Veredito&{id:string;factIds:string[];sourceIds:string[]};
export interface ContextoGates {sexoCadastral:string|null;fatos:FatoGate[];referencias:string[]}
const objeto=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const atual=(f:FatoGate)=>f.evidence==='EXPLICIT'&&f.qualificadores?.polaridade==='AFIRMADA'
 &&f.qualificadores.sujeito==='PACIENTE'&&f.qualificadores.temporalidade==='ATUAL';
const literal=(f:FatoGate)=>typeof f.value==='string'?f.value:typeof objeto(f.value).literal==='string'?String(objeto(f.value).literal):'';
/** Só declaração rotulada de material no segmento. Narrativa de cirurgia anterior não classifica peça. */
export function materialExplicito(texto:string):string|undefined{
 const linhas=[...texto.matchAll(/^\s*(?:material|esp[eé]cime)\s*:\s*([^\r\n]+)$/gimu)].map(m=>m[1]!.trim());
 if(linhas.length!==1)return undefined;
 const m=linhas[0]!;
 if(/\b(?:anterior|hist[oó]ric[oa]|n[aã]o|suspeit[oa]|poss[ií]vel)\b/iu.test(m))return undefined;
 if(/bi[oó]psia|biopsy/iu.test(m)&&/ressec|resection/iu.test(m))return undefined;
 if(/^(?:bi[oó]psia|core biopsy|needle biopsy|punch biopsy)\b/iu.test(m))return 'BIOPSY';
 if(/^(?:ressec[cç][aã]o cir[uú]rgica|pe[cç]a de ressec[cç][aã]o|surgical resection)\b/iu.test(m))return 'SURGICAL_RESECTION';
 return undefined;
}
export function avaliarGatesExtracao(fatos:readonly FatoGate[],texto:string,contexto?:ContextoGates):AvisoGate[]{
 const resultados:AvisoGate[]=[];
 const incluir=(v:Veredito,grupo:readonly FatoGate[])=>{
  const factIds=grupo.filter(f=>fatos.some(n=>n.id===f.id)).map(f=>f.id).sort();if(!factIds.length)return;
  const sourceIds=[...new Set(grupo.map(f=>f.sourceId))].sort();
  resultados.push({...v,factIds,sourceIds,id:`gate-${hashCanonico({v,factIds,sourceIds})}`});
 };
 const grupos=new Map<string,FatoGate[]>();
 for(const f of [...fatos,...contexto?.fatos??[]]){
  if(!['diagnosis','histology','imaging','procedure'].includes(f.domain))continue;
  const v=objeto(f.value),orgao=typeof v.sitioCanonico==='string'?v.sitioCanonico:typeof v.anatomia==='string'?v.anatomia:'';
  if(!orgao)continue;
  if(!atual(f)){
   if(f.qualificadores?.sujeito!=='TERCEIRO'&&f.qualificadores?.polaridade!=='NEGADA'&& !['HISTORICA','FUTURA'].includes(f.qualificadores?.temporalidade??''))
    incluir({gate:'G-08',decisao:'PENDENTE',motivo:'Sujeito/temporalidade/evidência não determinam aplicabilidade; conferir a fonte.'},[f]);
   continue;
  }
  incluir(g08AnatomiaSexo({anatomia:orgao,sexoCadastral:contexto?.sexoCadastral}),[f]);
  // Relação só quando a fonte nomeia a mesma lesão. Mesmo órgão sozinho não prova identidade da lesão.
  const lesao=/^\s*les[aã]o\s+(?:id\s*:\s*)?([\p{L}\d_-]+)\s*:/iu.exec(f.rawEvidence)?.[1];
  if(!lesao){incluir({gate:'G-07',decisao:'PENDENTE',motivo:'Correspondência da lesão entre fontes não documentada.'},[f]);continue;}
  const chave=JSON.stringify([orgao,lesao.toLowerCase()]);grupos.set(chave,[...grupos.get(chave)??[],f]);
 }
 for(const [chave,grupo] of grupos){
  const [orgao]=JSON.parse(chave) as [string,string];
  const slots:{path?:unknown;rads?:unknown;procedimento?:unknown;diagnostico?:unknown}={};
  let conflitoInterno=false;
  for(const f of grupo){const v=objeto(f.value),bruto=v.lateralidade??v.lateralityRaw;
   if(typeof bruto!=='string'||!bruto.trim())continue;
   const valor=normalizarLateralidade(bruto,orgao)??bruto;
   const slot=f.sourceType==='pathology'?'path':f.sourceType==='imaging_report'?'rads':f.domain==='procedure'?'procedimento':'diagnostico';
   if(slots[slot]!==undefined&&slots[slot]!==valor)conflitoInterno=true;slots[slot]=valor;
  }
  incluir(conflitoInterno?{gate:'G-07',decisao:'ALERTA',motivo:'Lateralidades divergentes em documentos da mesma categoria e lesão; conferir as fontes.'}:g07Lateralidade({orgao,...slots}),grupo);
 }
 for(const f of fatos.filter(f=>f.domain==='stage')){
  const tnm=literal(f),prefixo=/^(yp|[cp])T/iu.exec(tnm.trim())?.[1]??'';
  if(['p','yp'].includes(prefixo.toLowerCase())&&(!atual(f)||/\b(?:antig[oa]|anterior|hist[oó]ric[oa]|pr[eé]vi[oa])\b/iu.test(f.rawEvidence))){
   incluir({gate:'G-09',decisao:'PENDENTE',motivo:'Sujeito ou temporalidade não sustentam associação do pTNM à peça atual.'},[f]);continue;
  }
  if(['p','yp'].includes(prefixo.toLowerCase())&&!materialExplicito(f.rawEvidence)&&new Set(fatos.filter(n=>n.domain==='stage').map(literal)).size>1){
   incluir({gate:'G-09',decisao:'PENDENTE',motivo:'Múltiplos TNM sem material individualizado por trecho; conferir a origem.'},[f]);continue;
  }
  const v=objeto(f.value),tipoEsperado=prefixo.toLowerCase()==='p'?'PATOLOGICO':prefixo.toLowerCase()==='yp'?'POS_TRATAMENTO':'CLINICO';
  if(typeof v.prefixo==='string'&&v.prefixo.toLowerCase()!==prefixo.toLowerCase()||typeof v.tipo==='string'&&v.tipo!==tipoEsperado){
   incluir({gate:'G-09',decisao:'PENDENTE',motivo:'Prefixo/tipo estruturado diverge do TNM literal; conferir a fonte.'},[f]);continue;
  }
  const tnmExplicito=f.evidence==='EXPLICIT'&&f.qualificadores?.polaridade!=='NEGADA'&&f.qualificadores?.sujeito!=='TERCEIRO'
   &&!!tnm&&f.rawEvidence.replace(/\s/g,'').toUpperCase().includes(tnm.replace(/\s/g,'').toUpperCase());
  incluir(g09PtDeBiopsia({prefixo,tnmExplicito,specimen:materialExplicito(texto)}),[f]);
 }
 return resultados;
}
