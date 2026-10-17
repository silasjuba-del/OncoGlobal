import {expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bootServidorDemoB2,corpusCompartilhadoDemoB2} from './fixtures/servidor-demo-b2.js';
import {confirmar,salvarDraft} from '../../../src/kernel/ledger/writeRouter.js';
import {ausente,presente,fonteSintetica} from '../../fixtures/triagem.js';
import {listarEventos} from '../../../src/kernel/ledger/ledger.js';
import {baseAjusteAnterior} from '../../../src/server/f0c/baseAjusteAnterior.js';

it('HTTP usa administração efetiva do ciclo anterior, conserva pendências e rejeita origem desatualizada',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'e2e-b2-f1-dose-')),demo=await bootServidorDemoB2(dir);
 try{
  const token=demo.app.sessoes.login(demo.manifesto.senhaDemo)!.token;
  const post=async(rota:string,body:unknown)=>{const r=await fetch(demo.manifesto.baseUrl+rota,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});return{status:r.status,body:await r.json() as any};};
  const ctx={patientId:demo.manifesto.b2.patientId,encounterId:demo.manifesto.b2.encounterId,tumorLotId:'lote-dose-sintetico'};
  const template=corpusCompartilhadoDemoB2!.templatesProtocolo.find(t=>/cemiplimabe__/i.test(t.templateId))!;demo.promoverTemplate(template.templateId);
  const fonte={...fonteSintetica('administracao-sintetica'),dataClinica:'2026-09-21'};
  const seed=(id:string,tipo:string,payload:unknown,encontro=ctx.encounterId)=>{
   salvarDraft(demo.app.db,{draftId:id,patientId:ctx.patientId,sourceId:fonte.sourceId,rawRef:'registro-clinico-sintetico',payload:{},diagnostics:[],revision:0,criadoEm:demo.manifesto.agora});
   const r=confirmar(demo.app.db,{patientId:ctx.patientId,encounterId:encontro,tumorLotId:ctx.tumorLotId,operationId:`op-${id}`,reviewDecisionId:`rev-${id}`,sessao:demo.app.sessoes.obter(token)!,em:demo.manifesto.agora,
    registros:[{draftId:id,expectedRevision:0,eventId:`evento-${id}`,tipo,payload,fontes:[fonte],revisao:'CONFIRMADO'}]});
   expect(r.estado,JSON.stringify(r)).toBe('GRAVADA');
  };
  seed('lote','TumorLot',{tumorLotId:ctx.tumorLotId,patientId:ctx.patientId,cid:ausente(),topografia:ausente(),histologia:ausente(),finalidadeApac:ausente(),estadiamentos:[],marcos:[]});
  seed('episodio','TreatmentEpisode',{episodioId:'ep-sintetico',tumorLotId:ctx.tumorLotId,modalidade:'QT',intencao:'PALIATIVA',intentModifier:null,linha:1,esquemaId:template.templateId,inicio:presente('2026-09-21'),fim:ausente()});
  const ref={documentId:'prescricao-sintetica-c1',documentVersion:1};
  const ciclo={episodioId:'ep-sintetico',pesoKg:presente(70),origemPeso:'MEDIDO',ciclosSemPesoConsecutivos:0,comMedico:true};
  seed('c1','Ciclo',{...ciclo,cicloId:'ciclo-1',numero:1,previstoEm:'2026-09-21',prescricaoRef:ref,itens:[{item:1,droga:'Cemiplimabe',doseMg:350,reducaoPct:0}]},'encontro-c1-sintetico');
  seed('c2','Ciclo',{...ciclo,cicloId:'ciclo-2',numero:2,previstoEm:'2026-10-12',prescricaoRef:null,itens:[]});
  expect((await post('/consulta/contexto/selecionar',ctx)).status).toBe(200);
  const criar=()=>post('/consulta/prescricao/rascunho',{...ctx,templateId:template.templateId});
  const semAdministracao=await criar();expect(semAdministracao.status).toBe(201);
  expect(semAdministracao.body.instanciacao.itens.find((i:any)=>i.item.drug==='Cemiplimabe').doseAnteriorPrescrita).toBeNull();
  const admin={adminId:'admin-c1',cicloId:'ciclo-1',prescricaoRef:ref,item:1,droga:'Cemiplimabe',quantidadeEfetivaMg:280,status:'PARCIAL',motivo:'Administração parcial sintética',inicio:'2026-09-21T08:00:00-03:00',fim:'2026-09-21T08:30:00-03:00',fonte};
  seed('administracao','TreatmentAdministration',admin,'encontro-c1-sintetico');
  const rasc=await criar();expect(rasc.status,JSON.stringify(rasc.body)).toBe(201);
  expect(rasc.body.instanciacao.itens.find((i:any)=>i.item.drug==='Cemiplimabe').doseAnteriorPrescrita).toBe(280);
  const eventos=listarEventos(demo.app.db,ctx.patientId);
  for(const alteracao of [{patientId:'outro-paciente'},{tumorLotId:'outro-lote'},{criadoEm:'2030-01-01T00:00:00Z'},{fontes:[]}]){
   const isolados=eventos.map(e=>e.eventId==='evento-administracao'?{...e,...alteracao}:e);
   const base=baseAjusteAnterior(isolados,ctx,template,demo.manifesto.agora);
   expect(base.itens.find(i=>i.drug==='Cemiplimabe')?.prescribedDose??null).toBeNull();
  }
  const itens=rasc.body.instanciacao.itens.map((i:any)=>({...i.item,source:'MANUAL',overrideMotivo:'Fixture de ajuste explícito'}));
  const qt=itens.find((i:any)=>i.drug==='Cemiplimabe');qt.prescribedDose=224;qt.adjustmentPercent=-20;qt.adjustmentReason='Decisão sintética de redução';
  const pedido={...ctx,id:'ajuste-publico',operationId:'op-ajuste-publico',expectedRevision:null,rascunhoOrigemId:rasc.body.draftId,itens};
  const proposta=await post('/consulta/prescricao/propor',pedido);expect(proposta.status).toBe(201);
  const persistida=await post('/consulta/rascunho',{draftId:proposta.body.draftId});
  expect(persistida.body.draft.payload.itens.find((i:any)=>i.drug==='Cemiplimabe').prescribedDose).toBe(224);
  const origem=await post('/consulta/rascunho',{draftId:rasc.body.draftId});
  expect(origem.body.draft.payload.baseAjusteAnterior.fontes).toContainEqual(expect.objectContaining({eventId:'evento-administracao',quantidadeEfetivaMg:280,status:'PARCIAL'}));
  seed('administracao-conflitante','TreatmentAdministration',{...admin,adminId:'admin-conflitante',quantidadeEfetivaMg:260},'encontro-c1-sintetico');
  expect((await post('/consulta/prescricao/propor',{...pedido,id:'antigo',operationId:'op-antigo'})).body.codigo).toBe('ORIGEM_TEMPLATE_CONTEXTO_DESATUALIZADO');
  const ambiguo=await criar();expect(ambiguo.body.instanciacao.itens.find((i:any)=>i.item.drug==='Cemiplimabe').doseAnteriorPrescrita).toBeNull();
  const map=corpusCompartilhadoDemoB2!.templatesProtocolo.find(t=>t.nome==='MAP (ciclos 1–4)')!;demo.promoverTemplate(map.templateId);
  const parcial=await post('/consulta/prescricao/rascunho',{...ctx,templateId:map.templateId});
  expect(parcial.body.instanciacao.pendentes).toBeGreaterThan(0);
  const prontos=parcial.body.instanciacao.itens.filter((i:any)=>i.estado==='PRONTO').map((i:any)=>({...i.item,source:'MANUAL',overrideMotivo:'Fixture parcial'}));
  expect(prontos.length).toBeGreaterThan(0);
  const antes=demo.app.db.prepare('SELECT count(*) n FROM draft_envelope').get()!.n;
  expect((await post('/consulta/prescricao/propor',{...pedido,id:'parcial',operationId:'op-parcial',rascunhoOrigemId:parcial.body.draftId,itens:prontos})).body.codigo).toBe('ORIGEM_TEMPLATE_PENDENTE');
  expect(demo.app.db.prepare('SELECT count(*) n FROM draft_envelope').get()!.n).toBe(antes);
 }finally{await demo.app.close();rmSync(dir,{recursive:true,force:true});}
},30000);
