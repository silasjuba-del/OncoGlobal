// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import {createHmac,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ambiente,ctx,EM} from '../../bateria2/fixtures.js';
import {criarServidorLocal} from '../../../src/server/http.js';
import {criarGateway,memoriaIdempotencia} from '../../../src/kernel/gateway/gateway.js';
import {registrarConsentimentoCanal,revogarConsentimentoCanal,receberTransporteSintetico} from '../../../src/server/canalEntrada.js';
import {reconciliarMensagemCanalPersistida} from '../../../src/server/canalReconciliacao.js';
import {executarEnvioAutorizadoCanal,prepararRascunhoRespostaCanal} from '../../../src/server/canalResposta.js';
import {revisaoContextoCanal,vinculoAtualCanal,type OperacaoCanal} from '../../../src/server/canalOperacao.js';
import {criarPortaHttp} from '../../../src/ui/api/http.js';
import {criarChaves} from '../../../src/ui/api/chaves.js';
import {CaixaCanal} from '../../../src/ui/telas/canal/CaixaCanal.js';
const SENDER='5500'+'000007777',CONTA='wpp-consultorio',PHONE_NUMBER_ID='00000000',SEGREDO='segredo-exclusivamente-sintetico-http';
const conta={accountId:CONTA,phoneNumberId:PHONE_NUMBER_ID,canal:'WHATSAPP_SERVICO' as const,keyId:'sintetica',segredo:SEGREDO,verifyToken:'token-sintetico'};
const fechar:Array<()=>Promise<void>>=[];
afterEach(async()=>{cleanup();vi.unstubAllGlobals();for(const f of fechar.splice(0).reverse())await f();});
async function montar(configurada=true){
 const dir=mkdtempSync(join(tmpdir(),'f2-http-sintetico-'));let a=ambiente(join(dir,'ledger.sqlite')),base='',server:ReturnType<typeof criarServidorLocal>;let efeitos=0,agora=EM;
 const operacao:OperacaoCanal={contasWebhook:[conta],...(configurada?{transporteSaida:async()=>{efeitos++;return {ok:true as const,providerReceiptId:'recibo-sintetico'};}}:{})};
 const subir=async()=>{server=criarServidorLocal({db:a.db,sessoes:a.acesso.sessoes,gateway:criarGateway({agora:()=>agora,auditar:()=>{},store:memoriaIdempotencia(),executores:{}}),agora:()=>agora,log:()=>{},canal:operacao});
  await new Promise<void>(r=>server.once('listening',r));const addr=server.address();if(!addr||typeof addr==='string')throw Error('PORTA_AUSENTE');base=`http://127.0.0.1:${addr.port}`;};
 const descer=()=>new Promise<void>(r=>{server.close(()=>r());server.closeIdleConnections();});
 await subir();fechar.push(async()=>{await descer();a.db.close();rmSync(dir,{recursive:true,force:true});});
 a.seed('Paciente',{patientId:ctx.patientId,nome:'Paciente Sintético HTTP F2',identificadores:[],nascimento:null,sexoCadastral:'NAO_INFORMADO',divergencia:false});
 a.seed('Contato',{contatoId:'contato-http-sintetico',canal:'WHATSAPP_SERVICO',endereco:SENDER,patientId:ctx.patientId,relacao:'PACIENTE',vinculadoEm:EM,revogadoEm:null});
 const post=async(path:string,body:unknown,token=a.login.token)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});return {status:r.status,data:await r.json() as any};};
 const receber=async(id='mensagem-sintetica',texto='Quando é meu retorno?',sender=SENDER)=>{
  const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'waba-sintetica',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:PHONE_NUMBER_ID},messages:[{from:sender,id,timestamp:String(Date.parse(EM)/1000),type:'text',text:{body:texto}}]}}]}]},null,2);
  const response=await fetch(base+'/canal/webhook/sintetica',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':`sha256=${createHmac('sha256',SEGREDO).update(raw).digest('hex')}`},body:raw});
  return {status:response.status,data:await response.json() as any,raw};
 };
 const consentir=()=>registrarConsentimentoCanal(a.db,{...a.acesso,agora},{contatoId:SENDER,patientId:ctx.patientId,referenciaTermo:'termo-sintetico',versaoTermo:'1',finalidade:['COMUNICACAO_CLINICA'],origem:'PRESENCIAL_CONSULTORIO'});
 const preparar=async()=>{await receber();consentir();const caixa=await post('/consulta/canal',{});expect(caixa.status,JSON.stringify(caixa.data)).toBe(200);const mensagem=caixa.data.mensagens.find((m:any)=>m.contatoId===SENDER);expect(mensagem.contextosResposta).toContainEqual(ctx);
  const r=await post('/consulta/canal/resposta/preparar',{...ctx,mensagemOrigemId:mensagem.mensagemId,respostaId:'resposta-http-sintetica',versao:1,texto:'Retorno na quinta-feira.'});expect(r.status,JSON.stringify(r.data)).toBe(200);return r.data.rascunho;};
 const confirmar=async(p:any)=>post('/consulta/canal/resposta/confirmar',{respostaId:p.respostaId,versao:p.versao,comprovanteExibicao:{destinatario:p.destinatario,conteudoSha256:p.conteudoSha256,contexto:p.contexto}});
 const intent=(p:any,key='tentativa-sintetica')=>({verbo:'ENVIAR_WHATSAPP' as const,objeto:{tipo:'MENSAGEM_CANAL',id:p.respostaId,versao:p.versao},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:p.destinatario,idempotencyKey:key});
 return {get a(){return a;},get base(){return base;},post,receber,consentir,preparar,confirmar,intent,efeitos:()=>efeitos,operacao,setAgora:(em:string)=>{agora=em;},reiniciar:async()=>{await descer();a.db.close();a=ambiente(join(dir,'ledger.sqlite'));await subir();}};
}
it('GET challenge separado e POST nativo autenticado preservam bytes, persistem antes do ACK e deduplicam',async()=>{
 const e=await montar();const challenge=await fetch(e.base+'/canal/webhook/sintetica?hub.mode=subscribe&hub.verify_token=token-sintetico&hub.challenge=prova-sintetica');expect(challenge.status).toBe(200);expect(await challenge.text()).toBe('prova-sintetica');
 const r=await e.receber('id-sintetico','Relato sintético com acentuação e espaços.');expect(r.status,JSON.stringify(r.data)).toBe(200);
 expect(e.a.db.prepare('SELECT COUNT(*) n FROM canal_mensagem').get()?.n).toBe(1);expect(e.a.db.prepare('SELECT COUNT(*) n FROM canal_pendencia').get()?.n).toBe(1);
 expect((await e.receber('id-sintetico','Relato sintético com acentuação e espaços.')).status).toBe(200);expect(e.a.db.prepare('SELECT COUNT(*) n FROM canal_mensagem').get()?.n).toBe(1);
 const adulterado=await fetch(e.base+'/canal/webhook/sintetica',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+'0'.repeat(64)},body:r.raw});expect(adulterado.status).toBe(401);
 expect((await e.receber('id-sintetico','Conteúdo conflitante sintético.')).status).toBe(409);
});
it('mensagem desconhecida recebe vínculo médico pela tela e resposta autorizada sem promoção do ingresso',async()=>{
 const e=await montar(),sender='5500'+'000008888';
 expect((await e.receber('desconhecida','Dúvida sintética sobre retorno',sender)).status).toBe(200);
 const realFetch=globalThis.fetch;vi.stubGlobal('fetch',(input:string|URL|Request,init?:RequestInit)=>realFetch(typeof input==='string'&&input.startsWith('/')?e.base+input:input,init));
 const porta=criarPortaHttp({onSessaoExpirada:()=>{}});expect((await porta.login('senha-sintetica-bateria2')).ok).toBe(true);
 await porta.carregarConsulta(ctx.patientId,null,ctx.encounterId);
 render(<CaixaCanal porta={porta} chaves={criarChaves()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'vincular Paciente Sintético HTTP F2'}));
 await waitFor(()=>expect(screen.getByRole('region',{name:'Mensagens de Paciente Sintético HTTP F2'})).toBeTruthy());
 const caixa=await e.post('/consulta/canal',{}),msg=caixa.data.mensagens[0];
 expect(msg).toMatchObject({patientId:ctx.patientId,pendenciaProcessamento:false,redFlag:false});
 expect(e.a.db.prepare('SELECT vinculoPatientId FROM canal_mensagem').get()?.vinculoPatientId).toBe(null);
 expect((await e.post('/consulta/canal/vincular',{contatoId:sender,patientId:ctx.patientId,idempotencyKey:'replay-manual-sintetico'})).status).toBe(200);
 const preparada=await e.post('/consulta/canal/resposta/preparar',{...ctx,tumorLotId:null,mensagemOrigemId:msg.mensagemId,respostaId:'resposta-manual-sintetica',versao:1,texto:'Resposta médica sintética para revisão.'});
 expect(preparada.status).toBe(200);const p=preparada.data.rascunho;
 expect((await e.confirmar(p)).status).toBe(409); // vínculo não cria consentimento.
 expect(e.efeitos()).toBe(0);
 expect(registrarConsentimentoCanal(e.a.db,e.a.acesso,{contatoId:sender,patientId:ctx.patientId,referenciaTermo:'termo-manual-sintetico',versaoTermo:'1',finalidade:['COMUNICACAO_CLINICA'],origem:'PRESENCIAL_CONSULTORIO'}).ok).toBe(true);
 expect((await e.confirmar(p)).status).toBe(200);
 expect((await e.post('/acao',e.intent(p))).data.decisao).toBe('EXECUTADA');
 expect((await e.post('/acao',e.intent(p,'replay-desconhecido'))).data.decisao).toBe('REPLAY');
 expect(e.efeitos()).toBe(1);
 const observarLeitura=vi.spyOn(e.a.db,'prepare');
 const consulta=await e.post('/consulta/carregar',{...ctx,tumorLotId:null});
 expect(observarLeitura.mock.calls.filter(([sql])=>/SELECT \* FROM clinical_event/i.test(sql))).toHaveLength(1);
 observarLeitura.mockRestore();
 expect(consulta.status,JSON.stringify(consulta.data)).toBe(200);
 expect(consulta.data.contatosCanal.mensagens).toContainEqual(expect.objectContaining({mensagemId:msg.mensagemId,patientId:ctx.patientId,texto:'Dúvida sintética sobre retorno'}));
 expect(revogarConsentimentoCanal(e.a.db,e.a.acesso,{contatoId:sender,patientId:ctx.patientId,origem:'REVOGACAO_MEDICO'}).ok).toBe(true);
 expect((await e.post('/acao',e.intent(p,'apos-revogacao'))).status).toBe(409);
 expect(e.efeitos()).toBe(1);
});
it('retoma pendências duráveis no início e projeta somente alarmes persistidos e conferidos',async()=>{
 const e=await montar(),texto='Estou com sangramento agora';
 const ack=receberTransporteSintetico(e.a.db,{accountId:CONTA,canal:'WHATSAPP_SERVICO',providerMessageId:'pendente-reinicio',senderRef:SENDER,
  providerSentAt:EM,ingestedAt:EM,conteudo:{tipo:'TEXT',texto,contentSha256:createHash('sha256').update(texto).digest('hex')},
  cadastros:[{patientId:ctx.patientId,nome:'Paciente Sintético HTTP F2',chaveDemografica:null,identificadores:[{tipo:'TELEFONE',valor:SENDER}]}]});
 if(!ack.ok)throw Error('INGRESSO_SINTETICO');
 const r=await reconciliarMensagemCanalPersistida(e.a.db,e.a.acesso,{mensagemId:ack.reciboId,cadastros:[],rulesetAlarmes:{
  rulesetId:'conferido-apenas-fixture',rulesetVersao:'1',fraseFinal:'Nada substitui a avaliação presencial do seu médico.',sinais:[{
   id:'sangramento-sintetico',termo:'Sangramento',termos:['sangramento'],limiarDecimosExclusivo:null,status:'CONFERIDA_MEDICO',fonte:'fixture-sintetica',orientacao:'Avaliação médica.'}]}});
 expect(r.ok).toBe(true);
 expect((await e.post('/consulta/canal',{})).data.mensagens[0].redFlag).toBe(true);
 const pendente=receberTransporteSintetico(e.a.db,{accountId:CONTA,canal:'WHATSAPP_SERVICO',providerMessageId:'pendente-frio',senderRef:SENDER,
  providerSentAt:EM,ingestedAt:EM,conteudo:{tipo:'TEXT',texto:'Relato sintético',contentSha256:createHash('sha256').update('Relato sintético').digest('hex')},cadastros:[]});
 expect(pendente.ok).toBe(true);
 if(!pendente.ok)throw Error('INGRESSO_SINTETICO');
 await e.reiniciar();
 await waitFor(()=>expect(e.a.db.prepare('SELECT COUNT(*) n FROM canal_reconciliacao_clinica').get()?.n).toBe(2));
 const caixa=await e.post('/consulta/canal',{});
 expect(caixa.data.mensagens.find((m:any)=>m.mensagemId===pendente.reciboId).redFlag).toBe(false);
 expect(caixa.data.mensagens.every((m:any)=>m.pendenciaProcessamento===false)).toBe(true);
 expect(e.efeitos()).toBe(0);
});
it('banco indisponível não produz ACK e ausência de configuração nunca habilita transporte',async()=>{
 const e=await montar(false);e.a.db.exec('PRAGMA query_only=ON');expect((await e.receber()).status).toBe(503);e.a.db.exec('PRAGMA query_only=OFF');
 const p=await e.preparar();expect((await e.confirmar(p)).status).toBe(200);expect((await e.post('/acao',e.intent(p))).data.codigo).toBe('TRANSPORTE_CANAL_NAO_CONFIGURADO');expect(e.efeitos()).toBe(0);
});
it('HTTP prepara, confirma e envia a resposta correta uma vez; replay durável sobrevive a reinício',async()=>{
 const e=await montar(),p=await e.preparar();expect((await e.post('/acao',e.intent(p))).data.codigo).toBe('RESPOSTA_NAO_CONFIRMADA_PELO_MEDICO');expect(e.efeitos()).toBe(0);
 expect((await e.confirmar(p)).status).toBe(200);expect((await e.post('/acao',e.intent(p))).data.decisao).toBe('EXECUTADA');expect(e.efeitos()).toBe(1);
 expect(e.a.db.prepare('SELECT providerReceiptId FROM canal_resposta_envio').get()?.providerReceiptId).toBe('recibo-sintetico');
 expect((await e.post('/consulta/canal',{})).data.mensagens[0]).toMatchObject({estadoConversa:'RESPONDIDA',reciboTecnico:'ENVIADA'});
 await e.reiniciar();expect((await e.post('/acao',e.intent(p,'outra-chave'))).data.decisao).toBe('REPLAY');expect(e.efeitos()).toBe(1);
 expect((await e.post('/consulta/canal',{})).data.mensagens[0].estadoConversa).toBe('RESPONDIDA');
 expect(revogarConsentimentoCanal(e.a.db,e.a.acesso,{contatoId:SENDER,patientId:ctx.patientId,origem:'REVOGACAO_MEDICO'}).ok).toBe(true);
 expect((await e.post('/acao',e.intent(p))).status).toBe(409);expect(e.efeitos()).toBe(1);
});
it('acuso técnico enviado não equivale a resposta médica nem encerra conversa',async()=>{
 const e=await montar(),p=await e.preparar();
 const tecnico=prepararRascunhoRespostaCanal(e.a.db,e.a.acesso,{respostaId:'acuso-sintetico',versao:1,mensagemOrigemId:p.mensagemOrigemId,
  contexto:p.contexto,tipoResposta:'ACUSO_RECEBIMENTO_TECNICO',texto:'Recebimento técnico registrado.'});
 if(!tecnico.ok)throw Error('ACUSO_SINTETICO');
 expect((await e.confirmar(tecnico.rascunho)).status).toBe(200);
 expect((await e.post('/acao',e.intent(tecnico.rascunho))).data.decisao).toBe('EXECUTADA');
 expect((await e.post('/consulta/canal',{})).data.mensagens[0]).toMatchObject({estadoConversa:'AGUARDA_MEDICO',reciboTecnico:'ENVIADA'});
});
it('recibo nativo de entrega correlaciona o wamid preservado sem representar atendimento clínico',async()=>{
 const e=await montar(),p=await e.preparar();expect((await e.confirmar(p)).status).toBe(200);expect((await e.post('/acao',e.intent(p))).data.decisao).toBe('EXECUTADA');
 const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'waba-sintetica',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:PHONE_NUMBER_ID},statuses:[{id:'recibo-sintetico',status:'read',timestamp:String(Date.parse(EM)/1000+60),recipient_id:SENDER}]}}]}]});
 const r=await fetch(e.base+'/canal/webhook/sintetica',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':`sha256=${createHmac('sha256',SEGREDO).update(raw).digest('hex')}`},body:raw});expect(r.status).toBe(200);
 const caixa=await e.post('/consulta/canal',{});expect(caixa.data.mensagens[0].reciboTecnico).toBe('LIDA');expect(caixa.data.mensagens[0].pendenciaProcessamento).toBe(false);
});
it('resultado incerto não reenvia com outra chave nem após reiniciar',async()=>{
 const e=await montar(),original=e.operacao.transporteSaida!;
 e.operacao.transporteSaida=async envio=>{await original(envio);return {ok:false,incerto:true,erro:'timeout-sintetico'};};
 const p=await e.preparar();expect((await e.confirmar(p)).status).toBe(200);expect((await e.post('/acao',e.intent(p))).data.decisao).toBe('OUTCOME_UNKNOWN');expect(e.efeitos()).toBe(1);
 await e.reiniciar();expect((await e.post('/acao',e.intent(p,'outra-chave'))).data.decisao).toBe('OUTCOME_UNKNOWN');expect(e.efeitos()).toBe(1);
});
it('falha ao confirmar sucesso faz rollback do recibo e conserva reserva incerta sem reenviar',async()=>{
 const e=await montar(),p=await e.preparar();expect((await e.confirmar(p)).status).toBe(200);
 e.a.db.exec(`CREATE TRIGGER falha_sintetica_confirmacao BEFORE UPDATE ON action_idempotency
   WHEN json_extract(NEW.resultado,'$.decisao')='EXECUTADA' BEGIN SELECT RAISE(ABORT,'FALHA_SINTETICA'); END;`);
 expect((await e.post('/acao',e.intent(p))).status).toBe(500);expect(e.efeitos()).toBe(1);
 expect(e.a.db.prepare('SELECT COUNT(*) n FROM canal_resposta_envio').get()?.n).toBe(0);
 const reserva=e.a.db.prepare('SELECT resultado FROM action_idempotency').get();expect(JSON.parse(String(reserva?.resultado)).decisao).toBe('OUTCOME_UNKNOWN');
 e.a.db.exec('DROP TRIGGER falha_sintetica_confirmacao');await e.reiniciar();
 expect((await e.post('/acao',e.intent(p,'depois-da-falha'))).data.decisao).toBe('OUTCOME_UNKNOWN');expect(e.efeitos()).toBe(1);
});
it('limite de bytes é preservado sem gravar nem confirmar corpo excessivo',async()=>{
 const e=await montar();const r=await fetch(e.base+'/canal/webhook/sintetica',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+'0'.repeat(64)},body:' '.repeat(262_145)});expect(r.status).toBe(413);
 expect(e.a.db.prepare("SELECT COUNT(*) n FROM canal_mensagem").get()?.n).toBe(0);
});
it('troca de conteúdo, destinatário, contexto ou revisão depois da prévia impede confirmação/envio',async()=>{
 const e=await montar(),p=await e.preparar();
 for(const comprovanteExibicao of [{destinatario:'outro-destino',conteudoSha256:p.conteudoSha256,contexto:p.contexto},{destinatario:p.destinatario,conteudoSha256:'a'.repeat(64),contexto:p.contexto},{destinatario:p.destinatario,conteudoSha256:p.conteudoSha256,contexto:{...p.contexto,encounterId:'outro-encontro'}}])expect((await e.post('/consulta/canal/resposta/confirmar',{respostaId:p.respostaId,versao:p.versao,comprovanteExibicao})).status).toBe(409);
 expect((await e.confirmar(p)).status).toBe(200);e.a.seed('FATO',{campo:'anotacao-sintetica',valor:'Revisão nova do prontuário.'});expect((await e.post('/acao',e.intent(p))).status).toBe(409);expect((await e.confirmar(p)).status).toBe(409);expect(e.efeitos()).toBe(0);
});
function compartilhar(e:Awaited<ReturnType<typeof montar>>){
 const outro={...ctx,patientId:'paciente-sintetico-http-b'};
 e.a.seed('Paciente',{patientId:outro.patientId,nome:'Outro Paciente Sintético',identificadores:[],nascimento:null,sexoCadastral:'NAO_INFORMADO',divergencia:false},'CONFIRMADO',outro);
 e.a.seed('Contato',{contatoId:'outro-contato-sintetico',canal:'WHATSAPP_SERVICO',endereco:SENDER,patientId:outro.patientId,relacao:'PACIENTE',vinculadoEm:EM,revogadoEm:null},'CONFIRMADO',outro);
}
it.each([false,true])('telefone compartilhado depois da prévia recusa confirmação/envio/replay (já enviado=%s)',async enviado=>{
 const e=await montar(),p=await e.preparar();if(enviado){expect((await e.confirmar(p)).status).toBe(200);expect((await e.post('/acao',e.intent(p))).data.decisao).toBe('EXECUTADA');}
 compartilhar(e);expect((await e.confirmar(p)).status).toBe(409);expect((await e.post('/acao',e.intent(p,'nova-tentativa'))).status).toBe(409);expect(e.efeitos()).toBe(enviado?1:0);
});
it.each(['revisao','sessao','vinculo'] as const)('mudança de %s durante espera assíncrona impede efeito externo',async tipo=>{
 const e=await montar(),p=await e.preparar();expect((await e.confirmar(p)).status).toBe(200);let em=EM;
 const r=await executarEnvioAutorizadoCanal(e.a.db,e.a.acesso,{intent:e.intent(p),agoraAtual:()=>em,revisaoContextoAtual:()=>revisaoContextoCanal(e.a.db,ctx)!,
  validarVinculoAtual:()=>vinculoAtualCanal(e.a.db,ctx.patientId,SENDER),antesDoEnvioAssincrono:async()=>{if(tipo==='revisao')e.a.seed('FATO',{campo:'revisao-sintetica',valor:'Nova informação.'});else if(tipo==='vinculo')compartilhar(e);else em='2026-10-21T18:00:00Z';},transporteSaida:e.operacao.transporteSaida!});
 expect(r.resultadoGateway.decisao).toBe('NEGADA');expect(e.efeitos()).toBe(0);
});
it('interface usa prévia do servidor, confirmação explícita e respostaId; edição invalida a prévia',async()=>{
 const e=await montar();await e.receber();e.consentir();const realFetch=globalThis.fetch;vi.stubGlobal('fetch',(input:string|URL|Request,init?:RequestInit)=>realFetch(typeof input==='string'&&input.startsWith('/')?e.base+input:input,init));
 const porta=criarPortaHttp({onSessaoExpirada:()=>{}});expect((await porta.login('senha-sintetica-bateria2')).ok).toBe(true);const acao=vi.spyOn(porta,'acao');
 render(<CaixaCanal porta={porta} chaves={criarChaves()}/>);const caixa=await screen.findByRole('region',{name:'Caixa do canal'});const form=within(caixa).getByRole('form',{name:'Resposta do canal'});
 fireEvent.change(within(form).getByLabelText('Encontro para a resposta'),{target:{value:JSON.stringify(ctx)}});fireEvent.change(within(form).getByLabelText('Texto da resposta'),{target:{value:'Retorno na quinta-feira.'}});fireEvent.click(within(form).getByRole('button',{name:'Revisar resposta'}));
 await within(form).findByRole('region',{name:'Resposta preparada para confirmação'});expect(acao).not.toHaveBeenCalled();
 fireEvent.change(within(form).getByLabelText('Texto da resposta'),{target:{value:'Retorno na sexta-feira.'}});expect(within(form).queryByRole('region',{name:'Resposta preparada para confirmação'})).toBeNull();
 fireEvent.click(within(form).getByRole('button',{name:'Revisar resposta'}));await within(form).findByRole('region',{name:'Resposta preparada para confirmação'});
 fireEvent.click(within(form).getByLabelText('Confirmo destinatário, conteúdo e contexto da resposta'));fireEvent.click(within(form).getByRole('button',{name:'Confirmar e enviar resposta'}));
 await waitFor(()=>expect(e.efeitos()).toBe(1));expect(acao.mock.calls[0]![0].objeto.id).toMatch(/^resposta-/);expect(acao.mock.calls[0]![0].destino).toBe(SENDER);
});
