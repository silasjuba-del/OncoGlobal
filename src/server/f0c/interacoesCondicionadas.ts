import type { ClinicalEvent } from '../../contracts/operacao.js';
import { ContextoInteracoesCondicionadas, type ResultadoInteracaoCondicionada } from '../../contracts/f0c/interacoesCondicionadas.js';
import type { CatalogoInteracoes } from '../../contracts/f0c/interacoes.js';
import { dadosDoEvento, eventosVigentes, projetarSnapshot } from '../../kernel/projections/snapshot.js';
import { avaliarInteracoesCondicionadas } from '../../rules/f0c/interacoesCondicionadas.js';

export interface EntradaInteracoesCondicionadasDaConsulta {
  eventos:readonly ClinicalEvent[];patientId:string;tumorLotId:string|null;encounterId:string;agora:string;
  regrasInteracoes:readonly unknown[];catalogo?:CatalogoInteracoes;
}
export interface InteracoesCondicionadasDaConsulta {
  resultados:ResultadoInteracaoCondicionada[];eventIds:string[];sourceIds:string[];pendencias:string[];
}
const objeto=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
/** A presença de um envelope em outro atendimento não substitui reconciliação no atendimento atual. */
export function avaliarInteracoesCondicionadasDaConsulta(i:EntradaInteracoesCondicionadasDaConsulta):InteracoesCondicionadasDaConsulta {
  const horizonte=i.eventos.filter(e=>e.patientId===i.patientId&&(e.tumorLotId===i.tumorLotId||e.tumorLotId===null)
    &&Number.isFinite(Date.parse(e.criadoEm))&&Date.parse(e.criadoEm)<=Date.parse(i.agora));
  const vigentes=eventosVigentes(horizonte);
  const fatos=vigentes.filter(e=>e.tipo==='FATO'&&e.encounterId===i.encounterId&&e.tumorLotId===i.tumorLotId&&dadosDoEvento(e)?.campo==='interacoesContexto');
  const snapshot=projetarSnapshot(fatos,i.patientId,i.tumorLotId,i.encounterId,'f0c-interacoes-condicionadas-v1');
  const projetado=snapshot.campos.interacoesContexto;
  const eventIds=[...(projetado?.eventIds??[])].sort();
  const sourceIds=[...new Set(fatos.filter(e=>eventIds.includes(e.eventId)).flatMap(e=>e.fontes.map(f=>f.sourceId)))].sort();
  const pendente=(codigo:string):InteracoesCondicionadasDaConsulta=>({
    resultados:avaliarInteracoesCondicionadas(null,i.regrasInteracoes,i.catalogo).map(r=>({...r,motivo:codigo})),
    eventIds,sourceIds,pendencias:[codigo],
  });
  if(!projetado||projetado.estado==='PENDENTE')return pendente('INTERACOES_CONTEXTO_ATUAL_AUSENTE_OU_INCOMPLETO');
  if(projetado.estado==='VERMELHO')return pendente('INTERACOES_CONTEXTO_CONFLITANTE');
  if(!fatos.filter(e=>eventIds.includes(e.eventId)).every(e=>e.fontes.length>0&&e.fontes.every(f=>f.sourceId.trim()&&!f.sourceId.includes('[VERIFICAR]'))))
    return pendente('INTERACOES_CONTEXTO_SEM_FONTE');
  const bruto=objeto(projetado.valor);
  if(!bruto)return pendente('INTERACOES_CONTEXTO_INVALIDO');
  // O relógio do chamador prevalece sobre a referência contida no dado clínico.
  const parsed=ContextoInteracoesCondicionadas.safeParse({...bruto,referencia:i.agora});
  if(!parsed.success)return pendente('INTERACOES_CONTEXTO_INVALIDO');
  const c=parsed.data;
  const conhecidas=new Set(vigentes.flatMap(e=>e.fontes.map(f=>f.sourceId)));
  const referencias=[...(c.reconciliacao?[c.reconciliacao.fonte]:[]),...c.exposicoes.map(e=>e.fonte),
    ...c.coadministracoes.map(e=>e.fonte),...(c.clearance?[c.clearance.fonte]:[]),...c.vacinas.map(e=>e.fonte),
    ...(c.quimioterapia?[c.quimioterapia.fonte]:[]),...(c.recuperacaoImune?[c.recuperacaoImune.fonte]:[])];
  if(referencias.some(f=>!conhecidas.has(f)))return pendente('INTERACOES_FONTE_NAO_REFERENCIADA_NO_LEDGER');
  const resultados=avaliarInteracoesCondicionadas(c,i.regrasInteracoes,i.catalogo);
  return {resultados,eventIds,sourceIds:[...new Set([...sourceIds,...referencias])].sort(),
    pendencias:resultados.filter(r=>r.estado==='PENDENTE').map(r=>`${r.tipo}: ${r.motivo}`)};
}
