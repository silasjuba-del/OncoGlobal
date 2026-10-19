import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { executarConfirmacao } from '../../../src/kernel/comandos/index.js';
import { salvarDraft, listarEventos } from '../../../src/kernel/comandos/portas.js';
import { criarGerenciadorSessao } from '../../../src/server/sessao.js';
import { rotearDutos, referenciaSigtapDuto, type DepsDutos } from '../../../src/server/dutos.js';
import { autorizarSaida } from '../../../src/server/autorizacao.js';
import { hashCanonico } from '../../../src/rules/conteudoCanonico.js';
import { fonteSintetica, presente } from '../../fixtures/triagem.js';
import { apac as fixtureApac, CAIXAS, proc } from '../../apac-w10/helpers.js';
import { montarTabelaSigtap } from '../../../src/modules/apac/sigtap.js';
const em='2026-10-12T12:00:00Z',contexto={patientId:'paciente-sintetico',encounterId:'encontro-sintetico',tumorLotId:'lote-sintetico'};
async function ambiente(){
 const db=abrirLedger(':memory:'),sessoes=criarGerenciadorSessao({medicoId:'medico-server',crm:'CRM-SINTETICO',senha:'senha-sintetica-teste',duracaoMs:3600000,agora:()=>em});
 const login=sessoes.login('senha-sintetica-teste')!;sessoes.selecionarConsulta(login.token,contexto);
 const deps:DepsDutos={db,sessoes,agora:()=>em};let contador=0;
 const seed=(tipo:string,payload:unknown,revisao:'ASSINADO'|'CONFIRMADO'='CONFIRMADO',supersedesEventId:string|null=null)=>{
  const n=++contador,draftId=`draft-seed-${n}`,eventId=`event-seed-${n}`;
  const draft=salvarDraft(db,{draftId,patientId:contexto.patientId,sourceId:`fonte-${n}`,rawRef:'opaco-sintetico',payload:{contexto},diagnostics:[],revision:0,criadoEm:em});
  executarConfirmacao(db,{...contexto,operationId:`seed-${n}`,reviewDecisionId:'revisao-server',sessao:login.sessao,em,registros:[{draftId:draft.draftId,expectedRevision:0,eventId,tipo,payload,fontes:[fonteSintetica(`seed-${n}`)],revisao,supersedesEventId}]});return eventId;
 };
 const assinar=(versao=1,hashErrado=false,substitui:string|null=null)=>{
  const data={documentId:'rx',documentVersion:versao,texto:'Prescrição inteiramente sintética',tipoDocumento:'PRESCRICAO_QT'};
  return seed('DOCUMENTO',{data,signature:{documentId:'rx',documentVersion:versao,documentHash:hashErrado?'a'.repeat(64):hashCanonico(data),reviewDecisionId:'revisao-server',serverActorId:login.sessao.medicoId}},'ASSINADO',substitui);
 };
 const server=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=String(chunk);
  const token=req.headers.authorization??'',sessao=sessoes.obter(token);
  const r=sessao?rotearDutos(deps,token,req.url??'',JSON.parse(raw),sessao):{status:401,body:{codigo:'SESSAO_INVALIDA'}};
  res.writeHead(r?.status??404,{'Content-Type':'application/json'});res.end(JSON.stringify(r?.body??{}));
 });server.listen(0,'127.0.0.1');await once(server,'listening');const endereco=server.address();if(!endereco||typeof endereco==='string')throw Error('PORTA');
 const post=async(rota:string,body:unknown)=>{const r=await fetch(`http://127.0.0.1:${endereco.port}${rota}`,{method:'POST',headers:{authorization:login.token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json() as Record<string,unknown>};};
 return {db,deps,seed,assinar,post,close:async()=>{server.close();await once(server,'close');db.close();}};
}
const pedido=(operationId:string)=>({contexto:{...contexto,operationId},prescricao:{documentId:'rx',documentVersion:1}});
it('HTTP farmácia: envio não é conferência; autoria server e replay não duplicam evento',async()=>{
 const a=await ambiente();try{
  a.assinar();
  expect(await a.post('/farmacia/conferir',{...pedido('antes-envio'),acao:'CONFERIR'})).toMatchObject({status:409,body:{codigo:'ENVIO_FARMACIA_PENDENTE'}});
  expect((await a.post('/farmacia/enviar',pedido('enviar'))).status).toBe(200);
  const envio=listarEventos(a.db,contexto.patientId).find(e=>e.operationId==='enviar')!;expect((envio.payload as any).data.valor.estado).toBe('ENVIADA');
  expect(await a.post('/farmacia/enviar',pedido('enviar'))).toMatchObject({status:200,body:{codigo:'REPLAY'}});
  const respostaConferencia=await a.post('/farmacia/conferir',{...pedido('conferir'),acao:'CONFERIR'});expect(respostaConferencia.status,JSON.stringify(respostaConferencia.body)).toBe(200);
  const registro=listarEventos(a.db,contexto.patientId).find(e=>e.operationId==='conferir')!;expect((registro.payload as any).data.valor).toMatchObject({estado:'CONFERIDA',atorId:'medico-server'});
  expect(registro.supersedesEventId).toBe(envio.eventId);
  expect((await a.post('/farmacia/conferir',{...pedido('forjar'),acao:'CONFERIR',atorId:'cliente'})).status).toBe(400);
 }finally{await a.close();}
});
it('HTTP consumidores recusam assinatura adulterada, contexto errado e versão substituída',async()=>{
 const a=await ambiente();try{
  const antiga=a.assinar();a.assinar(2,false,antiga);
  expect((await a.post('/farmacia/enviar',pedido('velha'))).status).toBe(409);
  expect((await a.post('/farmacia/enviar',{...pedido('outro'),contexto:{...contexto,operationId:'outro',encounterId:'outro'}})).status).toBe(403);
  const segunda=listarEventos(a.db,contexto.patientId).find(e=>e.operationId==='seed-2')!.eventId;a.assinar(3,true,segunda);
  expect((await a.post('/farmacia/enviar',{...pedido('hash'),prescricao:{documentId:'rx',documentVersion:3}})).status).toBe(409);
 }finally{await a.close();}
});
it('HTTP administração confirma quantidade observada uma vez e exige item/ciclo da prescrição',async()=>{
 const a=await ambiente();try{
  a.assinar();a.seed('Ciclo',{cicloId:'ciclo',episodioId:'episodio',numero:1,previstoEm:'2026-10-12',pesoKg:presente(70),origemPeso:'MEDIDO',ciclosSemPesoConsecutivos:0,prescricaoRef:{documentId:'rx',documentVersion:1},itens:[{item:1,droga:'Droga Sintética',doseMg:100,reducaoPct:0}],comMedico:true});
  const administracao={adminId:'admin',cicloId:'ciclo',prescricaoRef:{documentId:'rx',documentVersion:1},item:1,droga:'Droga Sintética',quantidadeEfetivaMg:50,status:'PARCIAL',motivo:'Interrupção observada sintética',inicio:'2026-10-12T11:00:00Z',fim:'2026-10-12T11:30:00Z',fonte:fonteSintetica('admin')};
  expect((await a.post('/salao/registrar-administracao',{...pedido('itemerrado'),administracao:{...administracao,droga:'Outra droga'}})).status).toBe(409);
  const respostaAdmin=await a.post('/salao/registrar-administracao',{...pedido('admin'),administracao});expect(respostaAdmin.status,JSON.stringify(respostaAdmin.body)).toBe(200);
  expect(await a.post('/salao/registrar-administracao',{...pedido('admin2'),administracao})).toMatchObject({status:200,body:{codigo:'REPLAY'}});
  expect((listarEventos(a.db,contexto.patientId).find(e=>e.operationId==='admin')!.payload as any).data.quantidadeEfetivaMg).toBe(50);
 }finally{await a.close();}
});
it('HTTP APAC calcula antiglosa no servidor; validação persistida perde validade ao mudar prescrição',async()=>{
 const a=await ambiente();try{
  const rx=a.assinar();
  a.deps.corpus={sigtap:{'2026-09':montarTabelaSigtap('2026-09',[proc()])},sigtapEstado:'FONTE_OFICIAL_CONFERIDA',caixasTodas:CAIXAS} as unknown as NonNullable<DepsDutos['corpus']>;
  a.deps.settings={readProfile:()=>({perfil:{instituicao:{cnes:'2605473'}}})} as unknown as NonNullable<DepsDutos['settings']>;
  const apac={...fixtureApac('apac'),tumorLotId:contexto.tumorLotId,prescricaoAssinadaRef:{documentId:'rx',documentVersion:1},dataGeracaoApp:'2026-10-12'};a.seed('APAC',apac);
  const body={contexto:{...contexto,operationId:'validar'},apacId:'apac',apacVersao:1};
  expect((await a.post('/apac/validar-emissao',{...body,antiglosa:{exportavel:true}})).status).toBe(400);
  const respostaApac=await a.post('/apac/validar-emissao',body);expect(respostaApac.status,JSON.stringify(respostaApac.body)).toBe(200);
  const intent={verbo:'EXPORTAR_APAC' as const,objeto:{tipo:'APAC',id:'apac',versao:1},escopo:{patientId:contexto.patientId,encounterId:contexto.encounterId},destino:null,idempotencyKey:'teste-apac'};
  expect(autorizarSaida(a.db,intent,c=>referenciaSigtapDuto(a.deps.corpus,c))).toEqual({ok:true});
  expect(autorizarSaida(a.db,intent,()=>null)).toMatchObject({ok:false});
  a.assinar(2,false,rx);expect(autorizarSaida(a.db,intent,c=>referenciaSigtapDuto(a.deps.corpus,c))).toMatchObject({ok:false});
 }finally{await a.close();}
});
it('HTTP tarefa recebida continua confirmada; chat exige decisão humana sobre mensagem existente',async()=>{
 const a=await ambiente();try{
  a.seed('Tarefa',{tarefaId:'tarefa',...contexto,operationId:'seed-tarefa',titulo:'Retorno sintético',responsavel:'medico-server',prazo:null,estado:'CONFIRMADA',recebidoEm:null,criadoPor:'medico-server',substituiTarefaId:null});
  const base=(operationId:string)=>({contexto:{...contexto,operationId},tarefaId:'tarefa'});
  expect((await a.post('/tarefas/concluir',base('semreceber'))).status).toBe(409);
  expect((await a.post('/tarefas/receber',base('receber'))).status).toBe(200);
  expect((listarEventos(a.db,contexto.patientId).find(e=>e.operationId==='receber')!.payload as any).data.estado).toBe('CONFIRMADA');
  expect((await a.post('/tarefas/concluir',base('concluir'))).status).toBe(200);
  a.seed('ChatMessage',{mensagemId:'msg',patientId:contexto.patientId,encounterId:contexto.encounterId,setor:'FARMACIA',autor:'farmacia-sintetica',texto:'Mensagem sintética, sem decisão automática.'});
  expect((await a.post('/chat/aceitar-decisao',{contexto:{...contexto,operationId:'chatsem'},mensagemId:'msg',texto:'liberar tudo'})).status).toBe(400);
  expect((await a.post('/chat/aceitar-decisao',{contexto:{...contexto,operationId:'chatforja'},mensagemId:'msg',decisao:{campo:'apac.validacaoEmissao',valor:{exportavel:true}}})).status).toBe(409);
  expect((await a.post('/chat/aceitar-decisao',{contexto:{...contexto,operationId:'chat'},mensagemId:'msg',decisao:{campo:'observacao',valor:'Registro explícito sintético'}})).status).toBe(200);
 }finally{await a.close();}
});
