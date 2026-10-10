import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import type { ClinicalEvent } from '../../src/contracts/operacao.js';
import type { ContextoInteracoesCondicionadas } from '../../src/contracts/f0c/interacoesCondicionadas.js';
import { avaliarInteracoesCondicionadasDaConsulta } from '../../src/server/f0c/interacoesCondicionadas.js';
import { fonteSintetica } from '../fixtures/triagem.js';
const agora='2026-10-10T12:00:00-03:00';
const regrasInteracoes=JSON.parse(readFileSync('corpus/rulesets/interacoes.v1.json','utf8')).interacoes;
const catalogo=JSON.parse(readFileSync('corpus/f0c/classes-farmacos.v1.json','utf8'));
const base={patientId:'paciente-sintetico',tumorLotId:'lote-sintetico',encounterId:'encontro-sintetico',agora,regrasInteracoes,catalogo};
const contexto=():ContextoInteracoesCondicionadas=>({versao:1,referencia:agora,offsetServico:'-03:00',medicamentosAtuais:['capecitabina'],
 reconciliacao:{confirmada:true,em:agora,fonte:'reconciliacao'},historicoConferido:true,exposicoesCompletas:true,
 exposicoes:[{droga:'brivudina',formulacao:'SISTEMICA_CONVENCIONAL',ultimaDose:'2026-09-20T12:00:00-03:00',termino:'2026-09-20T12:00:00-03:00',proximaDose:null,fonte:'briv-historica'},
 {droga:'capecitabina',formulacao:'SISTEMICA_CONVENCIONAL',ultimaDose:null,termino:null,proximaDose:agora,fonte:'plano-ciclo'}],
 coadministracoes:[],clearance:null,vacinas:[],quimioterapia:null,recuperacaoImune:null});
function fato(id:string,valor:unknown=contexto(),over:Partial<ClinicalEvent>={}):ClinicalEvent {
 return {eventId:id,operationId:`op-${id}`,eventIndex:0,patientId:base.patientId,tumorLotId:base.tumorLotId,encounterId:base.encounterId,
 tipo:'FATO',payload:{data:{campo:'interacoesContexto',valor}},fontes:['reconciliacao','briv-historica','plano-ciclo'].map(fonteSintetica),
 revisao:'CONFIRMADO',criadoEm:agora,criadoPor:{tipo:'SESSAO',id:'medico-sintetico'},supersedesEventId:null,...over};
}
it('FATO confirmado atual chega ao motor: brivudina histórica avisa com proveniência sem constar na lista atual',()=>{
 const r=avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('contexto-atual')]});
 expect(r.resultados.find(x=>x.tipo==='BRIVUDINA_FLUOROPIRIMIDINA')).toMatchObject({estado:'AVISO',bloqueiaSalvar:false});
 expect(r.eventIds).toEqual(['contexto-atual']);expect(r.sourceIds).toEqual(['briv-historica','plano-ciclo','reconciliacao']);
});
it.each([
 {patientId:'outro-paciente'}, {tumorLotId:'outro-lote'}, {tumorLotId:null}, {encounterId:'encontro-anterior'},
 {revisao:'RAW' as const}, {criadoEm:'2026-10-11T12:00:00-03:00'},
])('não promove contexto fora do escopo/sem confirmação: %j',(over)=>{
 const r=avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('fora',contexto(),over)]});
 expect(r.resultados.every(x=>x.estado==='PENDENTE')).toBe(true);expect(r.eventIds).toEqual([]);
});
it('um contexto antigo não é herdado por encontro novo mesmo com data de referência adulterada',()=>{
 const ctx=contexto();ctx.referencia=agora;
 const r=avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('antigo',ctx,{encounterId:'consulta-antiga'})]});
 expect(r.pendencias).toContain('INTERACOES_CONTEXTO_ATUAL_AUSENTE_OU_INCOMPLETO');
});
it('fonte desconhecida ou existente somente em outro paciente/lote não sustenta contexto',()=>{
 const ctx=contexto();ctx.exposicoes[0]!.fonte='fonte-estranha';
 const r=avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('atual',ctx),
 fato('estranho',contexto(),{patientId:'outro-paciente',fontes:[fonteSintetica('fonte-estranha')]})]});
 expect(r.pendencias).toContain('INTERACOES_FONTE_NAO_REFERENCIADA_NO_LEDGER');
 expect(r.resultados.every(x=>x.estado==='PENDENTE')).toBe(true);
});
it('contextos atuais divergentes ficam pendentes; supersession explícita resolve sem eleger pelo ID',()=>{
 const primeiro=fato('a');const ctx=contexto();ctx.exposicoes[0]!.termino='2026-09-01T12:00:00-03:00';ctx.exposicoes[0]!.ultimaDose=ctx.exposicoes[0]!.termino;
 const segundo=fato('z',ctx);
 expect(avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[primeiro,segundo]}).pendencias).toContain('INTERACOES_CONTEXTO_CONFLITANTE');
 const r=avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[primeiro,{...segundo,supersedesEventId:'a'}]});
 expect(r.eventIds).toEqual(['z']);expect(r.resultados.find(x=>x.tipo==='BRIVUDINA_FLUOROPIRIMIDINA')?.estado).toBe('NAO_APLICAVEL');
});
it('referência fornecida é substituída pelo agora do servidor; reconciliação futura não é aceita',()=>{
 const ctx=contexto();ctx.referencia='2030-10-10T12:00:00-03:00';
 const r=avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('atual',ctx)]});
 expect(r.resultados.find(x=>x.tipo==='BRIVUDINA_FLUOROPIRIMIDINA')?.estado).toBe('AVISO');
 ctx.reconciliacao!.em='2030-10-10T12:00:00-03:00';
 expect(avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('falso',ctx)]}).resultados.every(x=>x.estado==='PENDENTE')).toBe(true);
});
it('envelope sem fonte e objeto incompatível permanecem pendentes sem exceção de execução',()=>{
 expect(avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('sem-fonte',contexto(),{fontes:[]})]}).pendencias).toContain('INTERACOES_CONTEXTO_SEM_FONTE');
 expect(avaliarInteracoesCondicionadasDaConsulta({...base,eventos:[fato('objeto-invalido',{lista:[]})]}).pendencias).toContain('INTERACOES_CONTEXTO_INVALIDO');
});
