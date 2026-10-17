import { z } from 'zod';
import { Retrato, type FatoRetrato } from '../../contracts/f1/retrato.js';
import { Correlacao, VersaoReferencia } from '../../contracts/f1/correlacao.js';
import { avaliarValidadeExame } from '../../rules/f0c/clinica.js';

type Referencia = z.infer<typeof VersaoReferencia>;
export type ClassificacaoRequisito = 'confirmado'|'ausente'|'solicitado'|'vencido'|'conflitante'|'naoAplicavel';
export interface AplicabilidadeRequisito {
  tumor?: readonly string[];
  histologia?: readonly string[];
  estagio?: readonly string[];
  biomarcadores?: readonly {nome:string;resultados:readonly string[]}[];
  linha?: readonly number[];
}
export interface RequisitoInvestigacao {
  id:string; exameCodigo:string; contexto:string; fonte:string; codigoSus:string|null;
  categoria?:'LABORATORIO'|'IMAGEM'|'OUTRO'|undefined;
  aplicabilidade?:AplicabilidadeRequisito;
  /** Null = requisito documental sem janela; nunca utiliza prazo inventado. */
  validadeHoras:number|null;
}
export interface PackRequisitos {
  referencia:Referencia; status:'CONFERIDA_MEDICO'; fonte:string;
  requisitos:readonly RequisitoInvestigacao[];
}
export interface PedidoAtivo { exameCodigo:string; contexto:string; status:'SOLICITADO'|'SIGNED'|'AGENDADO'; fatos:readonly FatoRetrato['ref'][] }
export interface OpcoesInvestigacao { agora?:string; pedidosAtivos?:readonly PedidoAtivo[] }
export interface ResultadoRequisito {
  id:string; exameCodigo:string; contexto:string; classificacao:ClassificacaoRequisito;
  justificativa:string; fonte:string; fatos:FatoRetrato['ref'][]; regras:Referencia[];
}
export interface PropostaExame {
  exameCodigo:string; contexto:string; codigoSus:string|null; pendencias:string[];
  categoria?:'LABORATORIO'|'IMAGEM'|'OUTRO'|undefined;
  justificativa:string; fatos:FatoRetrato['ref'][]; regras:Referencia[];
}
export interface ResultadoInvestigacao {
  schema:'Investigacao@1'; correlacao:Correlacao; requisitos:ResultadoRequisito[];
  propostas:PropostaExame[]; lacunas:{codigo:string;texto:string;fatos:FatoRetrato['ref'][]}[];
}
const k=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const canonical=(v:unknown):string=>JSON.stringify(v,(_key,x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function d(f:FatoRetrato){const v=record(f.dados.valor);return Object.keys(v).length?v:f.dados;}
function valores(r:Retrato,campo:string):{valor:unknown;f:FatoRetrato}[]{return r.fatos.flatMap(f=>{
 const o=d(f);if(k(f.campo??'')===k(campo))return [{valor:f.dados.valor??o.valor,f}];
 const val=o[campo];if(val!==undefined)return [{valor:record(val).valor??val,f}];return [];
});}
function elegibilidade(r:Retrato,a:AplicabilidadeRequisito|undefined):{aplicavel:boolean|null;fatos:FatoRetrato['ref'][];motivo:string}{
 if(!a)return {aplicavel:true,fatos:[],motivo:'Requisito do pack específico aprovado.'};
 const refs:FatoRetrato['ref'][]=[];
 for(const campo of ['tumor','histologia','estagio','linha'] as const){const permitidos=a[campo];if(!permitidos)continue;
  const fs=valores(r,campo);refs.push(...fs.map(x=>x.f.ref));if(!fs.length)return {aplicavel:null,fatos:refs,motivo:`${campo} não documentado para aplicar requisito.`};
  const unicos=new Set(fs.map(x=>canonical(x.valor)));if(unicos.size>1)return {aplicavel:null,fatos:refs,motivo:`${campo} conflitante; aplicabilidade não definida.`};
  if(!permitidos.some(v=>typeof v==='number'?v===fs[0]!.valor:k(String(v))===k(String(fs[0]!.valor))))return {aplicavel:false,fatos:refs,motivo:`${campo} documentado fora da população do requisito.`};
 }
 for(const b of a.biomarcadores??[]){const fs=r.fatos.filter(f=>k(f.campo??'')===k(b.nome)||k(String(d(f).nome??''))===k(b.nome));refs.push(...fs.map(f=>f.ref));
  const rs=fs.flatMap(f=>{const o=d(f);const v=o.resultado??f.dados.valor;return typeof v==='string'?[v]:[];});
  if(!rs.length||new Set(rs.map(k)).size>1)return {aplicavel:null,fatos:refs,motivo:`Biomarcador ${b.nome} ausente ou conflitante; ausência não é negativo.`};
  if(!b.resultados.some(v=>k(v)===k(rs[0]!)))return {aplicavel:false,fatos:refs,motivo:`Biomarcador ${b.nome} documentado fora do requisito.`};
 }
 return {aplicavel:true,fatos:refs,motivo:'Aplicabilidade documentada no retrato.'};
}
/** Somente leitura. Propostas permanecem minutas, sem assinatura, emissão ou efeito externo. */
export function avaliarInvestigacao(r:Retrato,c:Correlacao,pack:PackRequisitos,op:OpcoesInvestigacao={}):ResultadoInvestigacao {
 Retrato.parse(r);Correlacao.parse(c);
 if(r.patientId!==c.patientId||r.encounterId!==c.encounterId||r.tumorLotId!==c.tumorLotId||r.revisao!==c.revisaoFatos||canonical(r.biblioteca)!==canonical(c.biblioteca)||canonical(r.regras)!==canonical(c.regras))throw new Error('CORRELACAO_RETRATO_DIVERGENTE');
 if(r.fatos.some(f=>f.patientId!==r.patientId||f.escopo==='TUMOR'&&f.tumorLotId!==r.tumorLotId))throw new Error('FATO_FORA_ESCOPO');
 const out:ResultadoInvestigacao={schema:'Investigacao@1',correlacao:c,requisitos:[],propostas:[],lacunas:[]};
 const lacuna=(codigo:string,texto:string,fs:FatoRetrato['ref'][]=[])=>out.lacunas.push({codigo,texto,fatos:fs});
 const fonte=(s:string)=>!!s.trim()&&!s.includes('[VERIFICAR]');
 if(pack.status!=='CONFERIDA_MEDICO'||!fonte(pack.fonte)||!VersaoReferencia.safeParse(pack.referencia).success||![c.biblioteca,...c.regras].some(v=>canonical(v)===canonical(pack.referencia))){lacuna('PACK_NAO_APROVADO','Pack sem aprovação, fonte ou versão fixada na correlação.');return out;}
 const hist=valores(r,'histologia');
 if(!hist.length||hist.some(x=>!x.f.fontes.length||typeof x.valor!=='string'||!x.valor.trim())||new Set(hist.map(x=>k(String(x.valor)))).size!==1){lacuna('HISTOLOGIA_NAO_CONFIRMADA','Histologia não confirmada; não gerar bateria universal de exames.',hist.map(x=>x.f.ref));return out;}
 const ativos=[...(op.pedidosAtivos??[]),...r.fatos.flatMap(f=>{const o=d(f);return ['SOLICITADO','SIGNED','AGENDADO'].includes(String(o.status))&&typeof o.exameCodigo==='string'&&typeof o.contexto==='string'&&f.fontes.length?[{exameCodigo:o.exameCodigo,contexto:o.contexto,status:o.status as PedidoAtivo['status'],fatos:[f.ref]}]:[];})];
 const propostos=new Set<string>();
 for(const req of pack.requisitos){if(!req.id.trim()||!req.exameCodigo.trim()||!req.contexto.trim()||!fonte(req.fonte)||req.validadeHoras!==null&&(!Number.isFinite(req.validadeHoras)||req.validadeHoras<=0)){lacuna('REQUISITO_INVALIDO','Requisito sem identidade, contexto, fonte ou validade explícita.');continue;}
  const e=elegibilidade(r,req.aplicabilidade);if(e.aplicavel===null){lacuna(`APLICABILIDADE:${req.id}`,e.motivo,e.fatos);continue;}
  const base={id:req.id,exameCodigo:req.exameCodigo,contexto:req.contexto,fonte:req.fonte,regras:[pack.referencia]};
  if(!e.aplicavel){out.requisitos.push({...base,classificacao:'naoAplicavel',justificativa:e.motivo,fatos:e.fatos});continue;}
  const fs=r.fatos.filter(f=>{const o=d(f);return k(String(o.exameCodigo??o.codigo??o.marker??o.campo??f.campo??''))===k(req.exameCodigo)&&k(String(o.contexto??req.contexto))===k(req.contexto)&&!/pedido|solicitacao/.test(k(f.tipo))&&!['SOLICITADO','SIGNED','AGENDADO','CANCELLED','CANCELADO'].includes(String(o.status));});
  const validos=fs.filter(f=>f.fontes.length>0);if(fs.length!==validos.length)lacuna(`FONTE:${req.id}`,'Resultado sem fonte não comprova requisito.',fs.map(f=>f.ref));
  const refs=[...e.fatos,...validos.map(f=>f.ref)];let classificacao:ClassificacaoRequisito='ausente',motivo='Resultado confirmado não disponível.';
  const pedido=ativos.filter(p=>k(p.exameCodigo)===k(req.exameCodigo)&&k(p.contexto)===k(req.contexto));
  if(validos.length){const ordenados=[...validos].sort((a,b)=>String(d(a).data??a.tempoClinico??'').localeCompare(String(d(b).data??b.tempoClinico??'')));const ultimo=ordenados.at(-1)!;const data=String(d(ultimo).data??ultimo.tempoClinico??'');const atuais=ordenados.filter(f=>String(d(f).data??f.tempoClinico??'')===data);
    if(new Set(atuais.map(f=>canonical(d(f).resultado??d(f).valor??d(f).value??d(f)))).size>1){classificacao='conflitante';motivo='Resultados conflitantes na mesma data; nenhum eleito.';}
    else if(req.validadeHoras!==null){const v=avaliarValidadeExame('BIOQUIMICA',data||null,op.agora??null,req.validadeHoras);
      if(v.estado==='VENCIDO'){classificacao='vencido';motivo='Resultado vencido conforme prazo do pack aprovado.';}
      else if(v.estado==='PENDENTE'){lacuna(`VALIDADE:${req.id}`,v.motivo??'Validade não demonstrada.',refs);continue;}
      else{classificacao='confirmado';motivo='Resultado documentado dentro da validade aprovada.';}}
    else {classificacao='confirmado';motivo='Cobertura documental confirmada; requisito sem janela temporal.';}}
  if((classificacao==='ausente'||classificacao==='vencido')&&pedido.length){classificacao='solicitado';motivo='Pedido ativo correspondente; não gerar duplicata.';refs.push(...pedido.flatMap(p=>p.fatos));}
  const resumo=r.resumo.map(x=>x.texto).join(' ');const refsResumo=r.resumo.flatMap(x=>x.fatos).filter(ref=>r.fatos.some(f=>f.ref.eventId===ref.eventId&&f.ref.revisao===ref.revisao&&f.fontes.length>0));const justificativa=`${motivo} Indicação: ${req.fonte}. Contexto ${req.contexto}. Caso: ${resumo||'Resumo clínico não disponível'}`;
  out.requisitos.push({...base,classificacao,justificativa,fatos:refs});
  if(classificacao==='ausente'||classificacao==='vencido'){const chave=`${k(req.exameCodigo)}|${k(req.contexto)}`;if(propostos.has(chave))continue;
    if(!refsResumo.length){lacuna(`RESUMO:${req.id}`,'Proposta de pedido exige resumo do caso com referências a fatos.');continue;}
    propostos.add(chave);out.propostas.push({exameCodigo:req.exameCodigo,contexto:req.contexto,codigoSus:req.codigoSus?.trim()||null,...(req.categoria?{categoria:req.categoria}:{}),pendencias:!req.codigoSus?.trim()?['SEM_CODIGO_SUS']:[],justificativa,fatos:[...refs,...refsResumo],regras:[pack.referencia]});}
 }
 return out;
}
