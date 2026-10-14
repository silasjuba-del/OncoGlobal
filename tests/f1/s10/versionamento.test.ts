import { expect, it } from 'vitest';
import { ClinicalEvent } from '../../../src/contracts/operacao.js';
import { verificarPrescricaoDuto, resolverPrescricaoDuto } from '../../../src/server/dutos.js';
import { projetarDutos } from '../../../src/server/projecaoDutos.js';
import { hashCanonico } from '../../../src/rules/conteudoCanonico.js';
import { fonteSintetica } from '../../fixtures/triagem.js';
const ctx={patientId:'p',encounterId:'e',tumorLotId:'t'},em='2026-10-12T12:00:00Z';
function doc(v:number,id='rx',eventId=`rx-${v}`,alterar:{hash?:string;ator?:string;sigId?:string;patientId?:string}={}){
 const data={documentId:id,documentVersion:v,tipoDocumento:'PRESCRICAO_QT',texto:`Documento sintético versão ${v}`};
 return ClinicalEvent.parse({eventId,operationId:`op-${eventId}`,eventIndex:0,...ctx,patientId:alterar.patientId??ctx.patientId,tipo:'DOCUMENTO',payload:{reviewDecisionId:'review',data:{data,signature:{documentId:alterar.sigId??id,documentVersion:v,documentHash:alterar.hash??hashCanonico(data),reviewDecisionId:'review',serverActorId:alterar.ator??'m'}}},fontes:[fonteSintetica(eventId)],revisao:'ASSINADO',criadoEm:em,criadoPor:{tipo:'SESSAO',id:'m'},supersedesEventId:null});
}
it('versão2 assinada bloqueia versão1 para uso clínico mesmo sem supersedesEventId',()=>{
 const eventos=[doc(1),doc(2)];
 expect(verificarPrescricaoDuto(eventos,ctx,{documentId:'rx',documentVersion:1})).toEqual({ok:false,codigo:'PRESCRICAO_VERSAO_DESATUALIZADA'});
 expect(resolverPrescricaoDuto(eventos,ctx,{documentId:'rx',documentVersion:1})).toBeNull();
 expect(resolverPrescricaoDuto(eventos,ctx,{documentId:'rx',documentVersion:2})?.documentVersion).toBe(2);
});
it.each([{hash:'a'.repeat(64)},{ator:'forjado'},{sigId:'outro'}])('versão maior inválida exige revisão, não permite fallback para assinatura antiga: %j',alterar=>{
 const r=verificarPrescricaoDuto([doc(1),doc(2,'rx','rx2',alterar)],ctx,{documentId:'rx',documentVersion:1});
 expect(r.ok).toBe(false);expect(resolverPrescricaoDuto([doc(1),doc(2,'rx','rx2',alterar)],ctx,{documentId:'rx',documentVersion:2})).toBeNull();
});
it('duas assinaturas vigentes para a mesma versão são ambíguas mesmo com um hash incorreto',()=>{
 expect(verificarPrescricaoDuto([doc(1),doc(2),doc(2,'rx','rx2-duplicada')],ctx,{documentId:'rx',documentVersion:2})).toEqual({ok:false,codigo:'PRESCRICAO_VERSAO_AMBIGUA'});
 expect(resolverPrescricaoDuto([doc(2),doc(2,'rx','rx2-corrompida',{hash:'b'.repeat(64)})],ctx,{documentId:'rx',documentVersion:2})).toBeNull();
});
it('outro documentId ou paciente não substitui identidade clínica por ordem/data',()=>{
 expect(resolverPrescricaoDuto([doc(1),doc(99,'outra-rx'),doc(100,'rx','estrangeiro',{patientId:'outro'})],ctx,{documentId:'rx',documentVersion:1})?.documentVersion).toBe(1);
});
it('nova versão invalida conferência e validação APAC existentes sem apagar assinatura histórica',()=>{
 const antiga=doc(1),ref=resolverPrescricaoDuto([antiga],ctx,{documentId:'rx',documentVersion:1})!;
 const conferencia=ClinicalEvent.parse({...antiga,eventId:'conferencia',operationId:'op-conf',tipo:'FATO',revisao:'CONFIRMADO',payload:{reviewDecisionId:'review',data:{campo:'farmacia.conferencia',valor:{prescricao:ref,estado:'CONFERIDA',motivo:null,atorId:'m',em}}}});
 const out=projetarDutos([antiga,doc(2),conferencia],ctx);
 expect(out.farmacia[0]?.referenciaValida).toBe(false);
 expect(antiga.revisao).toBe('ASSINADO');expect(antiga.supersedesEventId).toBeNull();
});
it('APAC persistida deixa de autorizar exportação ao surgir nova versão assinada sem supersession',async()=>{
 const {abrirLedger}=await import('../../../src/kernel/ledger/db.js');
 const {salvarDraft}=await import('../../../src/kernel/comandos/portas.js');
 const {executarConfirmacao}=await import('../../../src/kernel/comandos/index.js');
 const {criarValidacaoPersistida}=await import('../../../src/modules/apac/validacaoPersistida.js');
 const {autorizarSaida}=await import('../../../src/server/autorizacao.js');
 const db=abrirLedger(':memory:'),sessao={medicoId:'m',crm:'CRM-SINTETICO',emitidaEm:em,expiraEm:'2026-10-13T12:00:00Z'};
 const seed=(e:ClinicalEvent)=>{
  const draftId=`d-${e.eventId}`,draft=salvarDraft(db,{draftId,patientId:ctx.patientId,sourceId:'fixture',rawRef:'fixture-sintetica',payload:{contexto:ctx},diagnostics:[],revision:0,criadoEm:em});
  executarConfirmacao(db,{...ctx,operationId:e.operationId,reviewDecisionId:'review',sessao,em,registros:[{draftId:draft.draftId,expectedRevision:0,eventId:e.eventId,tipo:e.tipo,payload:(e.payload as {data:unknown}).data,fontes:e.fontes,revisao:e.revisao as 'ASSINADO'|'CONFIRMADO'}]});
 };
 try{
  const rx=doc(1);seed(rx);const prescricao=resolverPrescricaoDuto([rx],ctx,{documentId:'rx',documentVersion:1})!;
  const apac={apacId:'ap',tumorLotId:ctx.tumorLotId,prescricaoAssinadaRef:{documentId:'rx',documentVersion:1},dataGeracaoApp:'2026-10-12',competencia:'2026-09',campos:{},estado:'RASCUNHO',resultadoExterno:null,versao:1,substituiApacId:null};
  const sigtap={competencia:'2026-09',versao:'fixture',hash:'b'.repeat(64)};
  const r=criarValidacaoPersistida({apac,prescricao,sigtap,antiglosa:{apacId:'ap',competencia:'2026-09',achados:[],exportavel:true}},{...ctx,atorId:'m',em});expect(r.ok).toBe(true);if(!r.ok)throw Error(r.codigo);
  seed(ClinicalEvent.parse({...rx,eventId:'ap',operationId:'op-ap',tipo:'APAC',revisao:'CONFIRMADO',payload:{reviewDecisionId:'review',data:apac}}));
  seed(ClinicalEvent.parse({...rx,eventId:'validacao',operationId:'op-val',tipo:'FATO',revisao:'CONFIRMADO',payload:{reviewDecisionId:'review',data:{campo:'apac.validacaoEmissao',valor:r.validacao}}}));
  const intent={verbo:'EXPORTAR_APAC' as const,objeto:{tipo:'APAC',id:'ap',versao:1},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:null,idempotencyKey:'export-fixture'};
  expect(autorizarSaida(db,intent,()=>sigtap)).toEqual({ok:true});
  seed(doc(2));expect(autorizarSaida(db,intent,()=>sigtap)).toEqual({ok:false,codigo:'VALIDACAO_APAC_DESATUALIZADA'});
 }finally{db.close();}
});
