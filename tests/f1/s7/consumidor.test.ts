import { expect, it } from 'vitest';
import { obterInvestigacao } from '../../../src/server/investigacao.js';
import { InvestigacaoConsultaVisao } from '../../../src/contracts/api/investigacao.js';
import type { Retrato, FatoRetrato } from '../../../src/contracts/f1/retrato.js';
const ctx={patientId:'p',encounterId:'e',tumorLotId:'t'},ref={id:'pack-sintetico',versao:'1',hash:'hash-sintetico'};
const f=(campo:string,valor:unknown,id=campo):FatoRetrato=>({ref:{eventId:id,revisao:'1'},tipo:'FATO',campo,dados:{campo,valor},...ctx,escopo:'TUMOR',tempoClinico:'2026-10-12T08:00:00-03:00',tempoRegistro:'2026-10-12T09:00:00-03:00',fontes:[{sourceId:'sintetica',classe:'DOCUMENT',contentHash:'sintetico',versao:'1',localizador:'p1',dataClinica:'2026-10-12',dataCaptura:'2026-10-12T09:00:00-03:00'}]});
const hist=f('histologia','histologia-sintetica');
const r:Retrato={schema:'Retrato@1',...ctx,revisao:'rev',versaoProjecao:'1',geradoEm:'2026-10-12T09:00:00-03:00',biblioteca:ref,regras:[],fatos:[hist],integridade:[],delta:{encounterAnteriorId:null,novos:[],substituidos:[]},resumo:[{texto:'Caso inteiramente sintético',fatos:[hist.ref]}]};
const req=(id:string,extra={})=>({id,exameCodigo:id,contexto:'fixture',fonte:'Requisito sintético aprovado para testar software',codigoSus:null,validadeHoras:null,...extra});
it('consumidor servidor não promove corpus RASCUNHO nem converte texto em requisitos',()=>{
 const deps={motorF1:{retrato:()=>r}};
 const out=obterInvestigacao(deps,ctx);expect(out.estado).toBe('PENDENTE');expect(out.lacunas[0]?.codigo).toBe('PACK_NAO_APROVADO');expect(out.resultado).toBeNull();
 expect(obterInvestigacao({...deps,packInvestigacao:()=>({status:'RASCUNHO',texto:'Pedir todos exames'})},ctx).lacunas[0]?.codigo).toBe('PACK_NAO_APROVADO');
});
it('consumidor real classifica seis situações e deduplica sem emitir exames',()=>{
 const fatos=[hist,f('a',{exameCodigo:'a',contexto:'fixture',resultado:'sintetico',data:'2026-10-12T08:00:00-03:00'}),f('pedido',{exameCodigo:'c',contexto:'fixture',status:'SOLICITADO'}),f('d',{exameCodigo:'d',contexto:'fixture',resultado:'sintetico',data:'2026-10-10T08:00:00-03:00'}),f('e',{exameCodigo:'e',contexto:'fixture',resultado:'X',data:'2026-10-12T08:00:00-03:00'}),f('e2',{exameCodigo:'e',contexto:'fixture',resultado:'Y',data:'2026-10-12T08:00:00-03:00'})];
 const pack={referencia:ref,status:'CONFERIDA_MEDICO',fonte:'Fixture aprovada sintética',requisitos:[req('a'),req('b'),req('bduplicada',{exameCodigo:'b'}),req('c'),req('d',{validadeHoras:24}),req('e'),req('f',{aplicabilidade:{histologia:['histologia-outra']}})]};
 const snapshot={...r,fatos},before=JSON.stringify(snapshot);
 const out=obterInvestigacao({motorF1:{retrato:()=>snapshot},packInvestigacao:()=>pack},ctx);
 expect(new Set(out.resultado?.requisitos.map(q=>q.classificacao))).toEqual(new Set(['confirmado','ausente','solicitado','vencido','conflitante','naoAplicavel']));
 expect(out.resultado?.propostas.filter(p=>p.exameCodigo==='b')).toHaveLength(1);expect(out.resultado?.propostas.some(p=>p.exameCodigo==='c')).toBe(false);
 expect(JSON.stringify(snapshot)).toBe(before);expect(out.resultado?.propostas.every(p=>p.codigoSus===null)).toBe(true);
});
it('referência não pinada, conteúdo em outro paciente e resposta com fato inexistente são recusados',()=>{
 const pack={referencia:{...ref,hash:'outro'},status:'CONFERIDA_MEDICO',fonte:'Fonte sintética',requisitos:[req('a')]};
 const out=obterInvestigacao({motorF1:{retrato:()=>r},packInvestigacao:()=>pack},ctx);expect(out.resultado?.lacunas[0]?.codigo).toBe('PACK_NAO_APROVADO');
 expect(obterInvestigacao({motorF1:{retrato:()=>({...r,patientId:'outro'})}},ctx).lacunas[0]?.codigo).toBe('RETRATO_FORA_CONTEXTO');
 expect(InvestigacaoConsultaVisao.safeParse({...out,lacunas:[{codigo:'x',texto:'sintetico',fatos:[{eventId:'inexistente',revisao:'1'}]}]}).success).toBe(false);
});
