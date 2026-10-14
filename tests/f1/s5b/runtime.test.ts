import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { criarMotorF1, type ConfigMotor } from '../../../src/kernel/orquestracao/runtime.js';
import { confirmar, salvarDraft, type Confirmacao } from '../../../src/kernel/ledger/writeRouter.js';
import { gravarEstimulo, listarEstimulos, listarExecucoesPendentes, registrarExecucao } from '../../../src/kernel/orquestracao/estimulos/gravar.js';
import * as setores from '../../../src/modules/setores/index.js';
import { lerLedgerIntegro } from '../../../src/kernel/ledger/leituraIntegra.js';
vi.mock('../../../src/modules/setores/index.js', { spy: true });
const ctx={patientId:'p',encounterId:'e',tumorLotId:'t'};
const ref={id:'regra',versao:'1',hash:'h1'},bib={id:'biblioteca',versao:'1',hash:'b1'};
const fonte={sourceId:'source',classe:'DOCUMENT' as const,localizador:'p1',dataClinica:'2026-10-09',dataCaptura:'2026-10-12T10:00:00-03:00',versao:'1',contentHash:'hash'};
function config():ConfigMotor{return {regras:[ref],biblioteca:bib,opcoes:{laboratorio:{referencia:ref,status:'CONFERIDA_MEDICO',fonte:'Decisão sintética',conteudo:{id:'regra',versao:'1',ativo:true,analitos:[{codigo:'creatinina',threshold:{regraId:'creatinina',ativo:true,unidade:'mg/dL',max:2},conversoes:[]}]}},validadeExame:{referencia:ref,status:'CONFERIDA_MEDICO',fonte:'Decisão sintética',conteudo:{bioquimicaHoras:72}}}};}
function gravar(db:ReturnType<typeof abrirLedger>,id='op'):Confirmacao {
  salvarDraft(db,{draftId:id,patientId:'p',sourceId:'source',rawRef:'local',payload:{},diagnostics:[],revision:1,criadoEm:'2026-10-12T10:00:00-03:00'});
  const req:Confirmacao={operationId:id,...ctx,reviewDecisionId:'review',sessao:{medicoId:'medico',crm:'SINTETICO',emitidaEm:'2026-10-12T09:00:00-03:00',expiraEm:'2026-10-12T19:00:00-03:00'},em:'2026-10-12T10:00:00-03:00',registros:[{draftId:id,expectedRevision:1,eventId:`event:${id}`,tipo:'LabResult',payload:{campo:'creatinina',valor:1,unidade:'mg/dL',data:'2026-10-09T10:30:00-03:00',sourceId:'source'},fontes:[fonte],revisao:'CONFIRMADO'}]};
  expect(confirmar(db,req).estado).toBe('GRAVADA');return req;
}
describe('S5b runtime SQLite causal, temporal e persistente',()=>{
 it('usa sete setores uma vez, reconcilia, preserva fatos e vence no limite exato dentro da mesma hora',async()=>{
  const db=abrirLedger(':memory:');let now='2026-10-12T10:29:59-03:00';const motor=criarMotorF1(db,()=>now,config);gravar(db);
  const eventos=db.prepare('SELECT count(*) AS n FROM clinical_event').get()?.n;
  await motor.processar();
  const nomes=['avaliarLaboratorio','avaliarImagem','avaliarPatologia','avaliarComorbidades','avaliarInteracoes','avaliarToxicidades','avaliarTratamento'] as const;
  const spies=nomes.map(n=>vi.mocked(setores[n]));spies.forEach(spy=>spy.mockClear());
  const a=await motor.consultar(ctx); for(const spy of spies){expect(spy).toHaveBeenCalledTimes(1);spy.mockClear();} expect(a.visaoIntegrada?.cobertura.setoresAvaliados).toHaveLength(7);
  expect(a.visaoIntegrada?.achados.find(x=>x.id.startsWith('LABORATORIO:'))?.estado).toBe('VERDE');
  now='2026-10-12T10:30:01-03:00';const b=await motor.consultar(ctx);
  expect(b.visaoIntegrada?.achados.find(x=>x.id.startsWith('LABORATORIO:'))?.estado).toBe('PENDENTE');
  expect(b.visaoIntegrada?.lacunas.some(x=>x.texto==='PRAZO_EXCEDIDO')).toBe(true);
  expect(db.prepare('SELECT count(*) AS n FROM clinical_event').get()?.n).toBe(eventos);db.close();
 });
 it('mesmo relógio não reutiliza biblioteca ou opções de avaliação antigas',async()=>{
  const db=abrirLedger(':memory:');let c=config();const m=criarMotorF1(db,()=> '2026-10-12T10:29:59-03:00',()=>c);gravar(db);
  const a=await m.consultar(ctx);c={...c,biblioteca:{...bib,versao:'2',hash:'b2'}};const b=await m.consultar(ctx);
  expect(b.visaoIntegrada?.correlacao.biblioteca.hash).toBe('b2');expect(b.retrato.revisao).not.toBe(a.retrato.revisao);
  const {laboratorio: _lab, ...opcoes}=c.opcoes!;c={...c,opcoes};const d=await m.consultar(ctx);expect(d.visaoIntegrada?.lacunas.some(x=>x.codigo==='LAB_SEM_REGRA')).toBe(true);db.close();
 });
 it('confirmação e estímulo são atômicos, replay é único, EM_CURSO sobrevive reinício',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'f1-s5b-')),file=join(dir,'ledger.db');let db=abrirLedger(file);
  try {criarMotorF1(db,()=> '2026-10-12T10:29:59-03:00',config);const req=gravar(db);confirmar(db,req);
   expect(listarEstimulos(db)).toHaveLength(1);registrarExecucao(db,'op:op','EM_CURSO',{},'2026-10-12T10:29:59-03:00');db.close();db=abrirLedger(file);
   const m=criarMotorF1(db,()=> '2026-10-12T10:29:59-03:00',config);await m.processar();expect(listarExecucoesPendentes(db)).toHaveLength(0);
   expect(db.prepare("SELECT estado FROM execucao_tecnica WHERE runId='op:op' ORDER BY indice DESC LIMIT 1").get()?.estado).toBe('PRONTO');
   db.exec("CREATE TRIGGER falhar_estimulo BEFORE INSERT ON estimulo_tecnico BEGIN SELECT RAISE(ABORT,'falha sintetica'); END;");
   expect(()=>gravar(db,'falha')).toThrow('falha sintetica');expect(db.prepare("SELECT eventId FROM clinical_event WHERE eventId='event:falha'").get()).toBeUndefined();
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('ativação global distribui apenas contextos avaliados dependentes e replay não duplica',async()=>{
  const db=abrirLedger(':memory:');let c=config();const m=criarMotorF1(db,()=> '2026-10-12T10:29:59-03:00',()=>c);gravar(db);await m.consultar(ctx);
  c={...c,biblioteca:{...bib,versao:'2',hash:'b2'}};
  const stimulus={schema:'EstimuloTecnico@1' as const,id:'global',operationId:'global',tipo:'BIBLIOTECA_ATIVADA' as const,patientId:null,encounterId:null,tumorLotId:null,revisaoEntrada:'b2',criadoEm:'2026-10-12T10:29:59-03:00',ator:'SISTEMA' as const};
  gravarEstimulo(db,stimulus);await m.processar();gravarEstimulo(db,stimulus);await m.processar();
  const filhos=listarEstimulos(db).filter(x=>x.id.startsWith('fanout:'));expect(filhos).toHaveLength(1);expect(filhos[0]).toMatchObject(ctx);
  const row=db.prepare("SELECT conteudo FROM execucao_tecnica WHERE runId=? AND estado='PRONTO'").get(filhos[0]!.id);
  expect(JSON.parse(String(row?.conteudo)).visaoIntegrada.correlacao.biblioteca.hash).toBe('b2');
  gravarEstimulo(db,{...stimulus,id:'global2',operationId:'global2'});await m.processar();
  expect(listarEstimulos(db).filter(x=>x.id.startsWith('fanout:'))).toHaveLength(1);db.close();
 });
 it('mudança de biblioteca durante a reconciliação impede publicação da visão antiga',async()=>{
  const db=abrirLedger(':memory:');let c=config();let trocou=false;
  c={...c,cruzamentos:[{aprovada:true,referencia:ref,setores:['LABORATORIO','INTERACOES'],avaliar:()=>{
    if(!trocou){trocou=true;c={...c,biblioteca:{...bib,versao:'2',hash:'b2'}};}return [];
  }}]};
  const m=criarMotorF1(db,()=> '2026-10-12T10:29:59-03:00',()=>c);gravar(db);await m.processar();
  expect(db.prepare("SELECT estado FROM execucao_tecnica WHERE runId='op:op' ORDER BY indice DESC LIMIT 1").get()?.estado).toBe('FALHOU');
  expect(db.prepare("SELECT count(*) AS n FROM execucao_tecnica WHERE runId='op:op' AND estado='PRONTO'").get()?.n).toBe(0);
  const v=await m.consultar(ctx);expect(v.visaoIntegrada?.correlacao.biblioteca.hash).toBe('b2');db.close();
 });
 it('reutiliza leitura íntegra fornecida sem reconsultar payloads durante leitura HTTP',async()=>{
  const db=abrirLedger(':memory:');const m=criarMotorF1(db,()=> '2026-10-12T10:29:59-03:00',config);gravar(db);await m.processar();
  const leitura=lerLedgerIntegro(db,'p'),spy=vi.spyOn(db,'prepare');const v=await m.consultar(ctx,leitura);
  expect(v.visaoIntegrada).not.toBeNull();expect(spy.mock.calls.filter(([s])=>/SELECT \* FROM clinical_event/.test(s))).toHaveLength(0);spy.mockClear();db.close();
 });
});
