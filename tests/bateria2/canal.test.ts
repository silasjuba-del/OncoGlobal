import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { receberTransporteSintetico,registrarConsentimentoCanal } from '../../src/server/canalEntrada.js';
import { prepararRascunhoRespostaCanal,confirmarRespostaCanalPeloMedico,executarEnvioAutorizadoCanal } from '../../src/server/canalResposta.js';
import { criarGerenciadorSessao } from '../../src/server/sessao.js';
import { relatosInfusaoPendentes } from '../../src/server/relatosInfusaoCanal.js';
import { rotearDutos } from '../../src/server/dutos.js';
import { listarEventos } from '../../src/kernel/comandos/portas.js';
import { ambiente,ctx,EM } from './fixtures.js';

const remetente='+55'+'00000008888';
const cadastros=[{patientId:ctx.patientId,identificadores:[{tipo:'TELEFONE' as const,valor:remetente}],chaveDemografica:null,nome:"Paciente Sintético Bateria2"}];
export function receber(a:ReturnType<typeof ambiente>,id:string,texto:string,em=EM){
 const r=receberTransporteSintetico(a.db,{accountId:'bateria2-sintetica',canal:'WHATSAPP_SERVICO',providerMessageId:id,senderRef:remetente,providerSentAt:em,ingestedAt:em,
  conteudo:{tipo:'TEXT',texto,contentSha256:createHash('sha256').update(texto).digest('hex')},cadastros});
 if(!r.ok)throw Error(JSON.stringify(r));return r.reciboId;
}
function resposta(){
 const a=ambiente(),contexto={...ctx,revisaoContexto:'revisao-b2'};
 const origem=receber(a,'origem','Relato sintético');
 registrarConsentimentoCanal(a.db,a.acesso,{contatoId:remetente,patientId:ctx.patientId,referenciaTermo:'termo-sintetico',versaoTermo:'1',finalidade:['COMUNICACAO_CLINICA'],origem:'PRESENCIAL_CONSULTORIO'});
 const base={respostaId:'resposta-b2',mensagemOrigemId:origem,contexto,tipoResposta:'RESPOSTA_LIVRE_MEDICA' as const};
 function preparar(versao:number,texto:string,acesso=a.acesso){const r=prepararRascunhoRespostaCanal(a.db,acesso,{...base,versao,texto});if(!r.ok)throw Error(JSON.stringify(r));return r;}
 function confirmar(versao:number,p:ReturnType<typeof preparar>,acesso=a.acesso){return confirmarRespostaCanalPeloMedico(a.db,acesso,{respostaId:base.respostaId,versao,comprovanteExibicao:{destinatario:remetente,conteudoSha256:p.rascunho.conteudoSha256,contexto}});}
 const enviados:string[]=[];
 const enviar=(versao:number,acesso=a.acesso)=>executarEnvioAutorizadoCanal(a.db,acesso,{intent:{verbo:'ENVIAR_WHATSAPP',objeto:{tipo:'MENSAGEM_CANAL',id:base.respostaId,versao},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:remetente,idempotencyKey:`envio-sintetico-${versao}`},transporteSaida:async e=>{enviados.push(e.texto);return {ok:true,providerReceiptId:'recibo-sintetico'};}});
 return {...a,preparar,confirmar,enviar,enviados};
}
it('5A política vigente congelada: v2 pendente invalida envio de v1; nenhuma é enviada',async()=>{
 const a=resposta();try{
  expect(a.confirmar(1,a.preparar(1,'mantenha a enoxaparina')).ok).toBe(true);
  a.acesso.agora='2026-10-19T18:15:00Z';a.preparar(2,'suspenda a enoxaparina, plaquetas 38 mil');
  a.acesso.agora='2026-10-19T18:17:00Z';
  expect((await a.enviar(1)).resultadoGateway.decisao).toBe('NEGADA');
  expect((await a.enviar(2)).resultadoGateway.decisao).toBe('NEGADA');
  receber(a,'ok','ok, vou manter');
  expect((await a.enviar(2)).resultadoGateway.decisao).toBe('NEGADA');expect(a.enviados).toEqual([]);
  expect(a.db.prepare('SELECT count(*) n FROM canal_resposta_autorizada').get()!.n).toBe(1);
 }finally{a.db.close();}
});
it.each(['mantenha enoxaparina 80 mg à noite','não mantenha enoxaparina 40 mg à noite'])('5B mudança por outra pessoa não herda confirmação: %s',async texto=>{
 const a=resposta();try{
  expect(a.confirmar(1,a.preparar(1,'mantenha enoxaparina 40 mg à noite')).ok).toBe(true);
  const sessoes=criarGerenciadorSessao({medicoId:'medico-sintetico-b',crm:'CRM-SINTETICO-B',senha:'senha-sintetica-b',duracaoMs:3600000,agora:()=>EM});
  const b={sessoes,token:sessoes.login('senha-sintetica-b')!.token,agora:EM};
  const p=a.preparar(2,texto,b);expect((await a.enviar(2)).resultadoGateway.decisao).toBe('NEGADA');expect(a.enviados).toEqual([]);
  expect(a.confirmar(2,p,b).ok).toBe(true);const envio=await a.enviar(2,b);expect(envio.resultadoGateway.decisao,JSON.stringify(envio)).toBe('EXECUTADA');expect(a.enviados).toEqual([texto]);
  const historico=a.db.prepare('SELECT autorizacaoJson FROM canal_resposta_autorizada ORDER BY versao').all().map(r=>String(r.autorizacaoJson));
  expect(historico[0]).toContain('medico-sintetico-a');expect(historico[1]).toContain('medico-sintetico-b');
 }finally{a.db.close();}
});
it('6A retratação e processamento administrativo não apagam relato; somente decisão médica referenciada',()=>{
 const a=ambiente();try{
  a.seed('Paciente',{patientId:ctx.patientId,nome:'Paciente Sintético Bateria2',identificadores:[],nascimento:null,sexoCadastral:'NAO_INFORMADO',divergencia:false},'CONFIRMADO',{...ctx,tumorLotId:null});
  const id=receber(a,'reacao','fiquei toda vermelha e com coceira no braço na infusão de ontem, acho que foi a platina','2026-10-18T12:00:00Z');
  receber(a,'retracao','melhorou, deve ter sido o calor da sala, esquece','2026-10-18T20:00:00Z');
  const ler=()=>relatosInfusaoPendentes(a.db,listarEventos(a.db,ctx.patientId),EM);
  expect(relatosInfusaoPendentes(a.db,listarEventos(a.db,ctx.patientId),'2026-11-09T18:00:00Z')).toHaveLength(1);
  expect(ler()).toHaveLength(1);expect(ler()[0]!.contextoMensagens.map(m=>m.texto).join(' ')).toContain('esquece');
  const r=ler()[0]!;
  const decisao={contexto:{...ctx,tumorLotId:null,operationId:'revisao-sintetica'},mensagemId:id,payloadSha256:r.payloadSha256,decisao:'Relato revisto; conduta registrada pelo médico sintético.'};
  expect(rotearDutos({db:a.db,sessoes:a.acesso.sessoes,agora:()=>EM},a.acesso.token,'/salao/revisar-relato-canal',decisao,a.login.sessao)?.status).toBe(200);
  expect(ler()).toHaveLength(0);
  const decisaoAntiga=listarEventos(a.db,ctx.patientId).find(e=>e.tipo==='ReviewDecision')!;
  a.seed('ReviewDecision',{campo:'revisaoRelatoInfusaoCanal',mensagemId:id,payloadSha256:r.payloadSha256,decisao:null,motivo:'Revisão registrada por engano'},'CONFIRMADO',{...ctx,tumorLotId:null},decisaoAntiga.eventId);
  expect(ler()).toHaveLength(1);
  receber(a,'reacao-nova','tive reação na infusão novamente');expect(ler()).toHaveLength(2);
 }finally{a.db.close();}
});
it('6B alergia prévia e prescrição assinada não escondem novo relato nem atribuem droga',()=>{
 const a=ambiente();try{
  a.assinar();a.seed('FATO',{campo:'alergias',valor:['dipirona']});
  const relato='fiquei toda empolada, a garganta apertou e a voz mudou, foi logo depois do remédio da veia';receber(a,'novo',relato);
  const r=relatosInfusaoPendentes(a.db,listarEventos(a.db,ctx.patientId),EM);
  expect(r).toHaveLength(1);expect(r[0]!.texto).toBe(relato);expect(JSON.stringify(r)).not.toContain('oxaliplatina');
  expect(listarEventos(a.db,ctx.patientId).filter(e=>e.tipo==='FATO')).toHaveLength(1);
 }finally{a.db.close();}
});
