import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {ambiente,ctx,EM} from '../../bateria2/fixtures.js';
import {receberTransporteSintetico,registrarConsentimentoCanal,revogarConsentimentoCanal} from '../../../src/server/canalEntrada.js';
import {prepararRascunhoRespostaCanal,confirmarRespostaCanalPeloMedico,executarEnvioAutorizadoCanal} from '../../../src/server/canalResposta.js';
import {reconciliarMensagemCanalPersistida,lerReconciliacaoMensagemCanal} from '../../../src/server/canalReconciliacao.js';
import {avaliarAlarmesCanalConferidos,extrairMencoesClinicasCanal,type RulesetAlarmeCanalEntrada} from '../../../src/modules/canal/reconciliacaoClinica.js';
const contato='+55'+'00000007777';
const cadastro=(endereco=contato)=>[{patientId:ctx.patientId,nome:'Paciente Sintético Integração',chaveDemografica:null,identificadores:[{tipo:'TELEFONE' as const,valor:endereco}]}];
function receber(a:ReturnType<typeof ambiente>,id:string,txt='Hoje tenho sangramento.',sender=contato,conhecido=true){
 const r=receberTransporteSintetico(a.db,{accountId:'sintetica-integracao',canal:'WHATSAPP_SERVICO',providerMessageId:id,senderRef:sender,providerSentAt:EM,ingestedAt:EM,
  conteudo:{tipo:'TEXT',texto:txt,contentSha256:createHash('sha256').update(txt).digest('hex')},cadastros:conhecido?cadastro(sender):[]});
 if(!r.ok)throw Error(JSON.stringify(r));return r.reciboId;
}
function autorizada(comCadastro=true){
 const a=ambiente(),mensagemOrigemId=receber(a,'origem'),contexto={...ctx,revisaoContexto:'r1'};
 if(comCadastro)a.seed('Paciente',{patientId:ctx.patientId,nome:'Paciente Sintetico Integracao',identificadores:[],nascimento:null,sexoCadastral:'NAO_INFORMADO',divergencia:false},'CONFIRMADO',{...ctx,tumorLotId:null});
 const consentir=(versaoTermo='1')=>registrarConsentimentoCanal(a.db,a.acesso,{contatoId:contato,patientId:ctx.patientId,referenciaTermo:'termo-sintetico',versaoTermo,finalidade:['COMUNICACAO_CLINICA'],origem:'PRESENCIAL_CONSULTORIO'});
 consentir();const p=prepararRascunhoRespostaCanal(a.db,a.acesso,{respostaId:'resposta-sintetica',versao:1,mensagemOrigemId,contexto,tipoResposta:'RESPOSTA_LIVRE_MEDICA',texto:'Retorno na quinta-feira.'});
 if(!p.ok)throw Error(JSON.stringify(p));expect(confirmarRespostaCanalPeloMedico(a.db,a.acesso,{respostaId:p.rascunho.respostaId,versao:1,comprovanteExibicao:{destinatario:contato,conteudoSha256:p.rascunho.conteudoSha256,contexto}}).ok).toBe(true);
 let efeitos=0;
 const enviar=(idempotencyKey:string)=>executarEnvioAutorizadoCanal(a.db,a.acesso,{intent:{verbo:'ENVIAR_WHATSAPP',objeto:{tipo:'MENSAGEM_CANAL',id:'resposta-sintetica',versao:1},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:contato,idempotencyKey},transporteSaida:async()=>{efeitos++;return {ok:true,providerReceiptId:'recibo-sintetico'};}});
 return {...a,consentir,enviar,efeitos:()=>efeitos};
}
it('mesma resposta/versão não envia duas vezes com chaves de tentativa distintas',async()=>{
 const a=autorizada();try{const primeira=await a.enviar('tentativa-sintetica-1');expect(primeira.resultadoGateway.decisao,JSON.stringify(primeira)).toBe('EXECUTADA');expect((await a.enviar('tentativa-sintetica-2')).resultadoGateway.decisao).toBe('REPLAY');expect(a.efeitos()).toBe(1);}finally{a.db.close();}
});
it.each(['1','2'])('revogação e reaceite da versão %s no mesmo instante não recuperam autorização antiga',async versao=>{
 const a=autorizada();try{expect(revogarConsentimentoCanal(a.db,a.acesso,{contatoId:contato,patientId:ctx.patientId,origem:'REVOGACAO_MEDICO'}).ok).toBe(true);a.consentir(versao);expect((await a.enviar('apos-novo-termo')).resultadoGateway.decisao).toBe('NEGADA');expect(a.efeitos()).toBe(0);}finally{a.db.close();}
});
const regras=(id:string,status='CONFERIDA_MEDICO'):RulesetAlarmeCanalEntrada=>({rulesetId:id,rulesetVersao:'1',fraseFinal:'Texto sintético.',sinais:[{id:'sangramento',termo:'Sangramento',termos:['sangramento'],limiarDecimosExclusivo:null,orientacao:'Texto sintético.',status,fonte:'Fonte sintética.'}]});
it('ATIVO isolado não equivale à curadoria médica',()=>{
 const textoOriginal='Hoje tenho sangramento.';
 expect(avaliarAlarmesCanalConferidos({textoOriginal,mencoes:extrairMencoesClinicasCanal(textoOriginal),patientIdVinculado:ctx.patientId,autorRelato:'PACIENTE',ruleset:regras('r','ATIVO')}).alarmesAtivos).toHaveLength(0);
});
it('vínculo reconciliado recupera comparação entre contatos do mesmo paciente',async()=>{
 const a=ambiente();try{
  const id=receber(a,'antiga','Hoje estou sem sangramento.',contato,false);
  expect((await reconciliarMensagemCanalPersistida(a.db,a.acesso,{mensagemId:id,cadastros:cadastro()})).ok).toBe(true);
  const novo='outro-contato-sintetico';const id2=receber(a,'nova','Hoje tenho sangramento.',novo,false);
  const r=await reconciliarMensagemCanalPersistida(a.db,a.acesso,{mensagemId:id2,cadastros:cadastro(novo)});
  expect(r.ok).toBe(true);if(r.ok)expect(r.reconciliacao.conflitosRelato.length).toBeGreaterThan(0);
 }finally{a.db.close();}
});
it('reconciliação concorrente retorna o registro persistido vencedor',async()=>{
 const a=ambiente();try{
  const id=receber(a,'corrida');let liberar!:()=>void;let entrou!:()=>void;
  const espera=new Promise<void>(r=>{liberar=r;});const inicio=new Promise<void>(r=>{entrou=r;});
  const primeira=reconciliarMensagemCanalPersistida(a.db,a.acesso,{mensagemId:id,cadastros:cadastro(),rulesetAlarmes:regras('perdedor'),classificadorLlm:async()=>{entrou();await espera;return {};}});
  await inicio;
  const segunda=await reconciliarMensagemCanalPersistida(a.db,a.acesso,{mensagemId:id,cadastros:cadastro(),rulesetAlarmes:regras('vencedor')});
  liberar();const r=await primeira;expect(segunda.ok&&r.ok).toBe(true);
  if(r.ok){expect(r.replay).toBe(true);expect(r.reconciliacao).toEqual(lerReconciliacaoMensagemCanal(a.db,id));}
 }finally{a.db.close();}
});

it('identidade ausente nega envio antes de chamar transporte e audita motivo',async()=>{
 const a=autorizada(false);try{const r=await a.enviar('sem-identidade-local');expect(r.resultadoGateway).toMatchObject({decisao:'NEGADA',motivoCodigo:'DICIONARIO_PACIENTE_INDISPONIVEL'});expect(a.efeitos()).toBe(0);
 expect(a.db.prepare("SELECT COUNT(*) AS n FROM audit_event WHERE motivoCodigo='DICIONARIO_PACIENTE_INDISPONIVEL'").get()?.n).toBe(1);
 }finally{a.db.close();}
});
