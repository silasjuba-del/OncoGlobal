import { ROTAS_HTTP } from "./rotas/catalogo.js";
import { relatosInfusaoPendentes } from './relatosInfusaoCanal.js';
import { lerEventosComIntegridade } from './leituras.js';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { Id, Sessao, Instante, type Fonte } from '../contracts/base.js';
import { validarPayloadEvento } from '../contracts/envelope.js';
import { AnotacaoEvolucao } from '../contracts/f1/anotacaoEvolucao.js';
import { Apac, SignatureReference, type ClinicalEvent } from '../contracts/operacao.js';
import { TreatmentAdministration } from '../contracts/clinico.js';
import { ConferenciaFarmacia, type PrescricaoAssinadaRef, type ReferenciaSigtap, type ContextoDutoServidor } from '../contracts/f1/dutos.js';
import { Tarefa } from '../contracts/f1/tarefa.js';
import { executarConfirmacao } from '../kernel/comandos/index.js';
import { listarEventos, salvarDraft, transacao } from '../kernel/comandos/portas.js';
import { dadosDoEvento, eventosVigentes } from '../kernel/projections/snapshot.js';
import { hashCanonico } from '../rules/conteudoCanonico.js';
import { dataCivilDoServico } from '../rules/tempoServico.js';
import { conferirPrescricao } from '../modules/farmacia/duto.js';
import { registrarAdministracao } from '../modules/salao/administracao.js';
import { validarMedidaAdministracao } from '../modules/salao/medidaAdministracao.js';
import { criarValidacaoPersistida } from '../modules/apac/validacaoPersistida.js';
import { antiglosa } from '../modules/apac/antiglosa.js';
import { RELEASES_SIGTAP_CONFERIDAS } from '../modules/apac/sigtap.js';
import { aceitarDecisaoChat } from '../modules/chat/decisao.js';
import { receberTarefa, concluirTarefa } from '../modules/agenda/tarefas.js';
import type { SettingsService } from '../kernel/config/settings.js';
import type { GerenciadorSessao } from './sessao.js';
import type { carregarCorpusServidor } from './corpus.js';

export interface DepsDutos { db: DatabaseSync; sessoes: GerenciadorSessao; agora: () => string; corpus?: ReturnType<typeof carregarCorpusServidor> | null; settings?: SettingsService | null; }
export interface ResultadoDuto { status: number; body: unknown; }
const ContextoPedido = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), operationId: Id }).strict();
const ReferenciaDocumento = z.object({ documentId: Id, documentVersion: z.number().int().positive() }).strict();
const Base = { contexto: ContextoPedido };
const RxPedido = z.object({ ...Base, prescricao: ReferenciaDocumento }).strict();
const FarmaciaPedido = RxPedido.extend({ acao: z.enum(['CONFERIR','PEDIR_CORRECAO']), motivo: z.string().trim().min(1).optional() }).strict();
const AdminPedido = RxPedido.extend({ administracao: TreatmentAdministration }).strict();
const ApacPedido = z.object({ ...Base, apacId: Id, apacVersao: z.number().int().positive() }).strict();
const ChatPedido = z.object({ ...Base, mensagemId: Id, decisao: z.object({ campo: Id, valor: z.unknown() }).strict().refine(v => Object.hasOwn(v, 'valor')) }).strict();
const RevisaoRelatoPedido=z.object({...Base,mensagemId:Id,payloadSha256:z.string().regex(/^[a-f0-9]{64}$/),decisao:z.string().trim().min(1)}).strict();
const TarefaPedido = z.object({ ...Base, tarefaId: Id }).strict();
const Rotas = new Set<string>(ROTAS_HTTP.filter(r=>r.grupo==="DUTOS").map(r=>r.url));
const negar = (codigo: string, status = 409): ResultadoDuto => ({ status, body: { codigo } });

export type DiagnosticoPrescricaoDuto = {ok:true;prescricao:PrescricaoAssinadaRef}|{ok:false;codigo:string};
/** Vigência clínica por identidade explícita: maior versão assinada válida do mesmo documento/contexto. */
export function verificarPrescricaoDuto(eventos: readonly ClinicalEvent[], contexto: {patientId:string;encounterId:string;tumorLotId:string|null}, ref: z.infer<typeof ReferenciaDocumento>): DiagnosticoPrescricaoDuto {
 const pedido=ReferenciaDocumento.safeParse({documentId:ref?.documentId,documentVersion:ref?.documentVersion});
 if(!pedido.success)return {ok:false,codigo:'REFERENCIA_PRESCRICAO_INVALIDA'};
 const docs=eventosVigentes(eventos).filter(e=>e.tipo==='DOCUMENTO'&&e.revisao==='ASSINADO'&&e.patientId===contexto.patientId&&e.encounterId===contexto.encounterId&&e.tumorLotId===contexto.tumorLotId);
 const grupo=docs.filter(e=>{const d=dadosDoEvento(e),corpo=d?.data,assinatura=d?.signature;
  return corpo&&typeof corpo==='object'&&!Array.isArray(corpo)&&(corpo as Record<string,unknown>).documentId===pedido.data.documentId
    ||assinatura&&typeof assinatura==='object'&&!Array.isArray(assinatura)&&(assinatura as Record<string,unknown>).documentId===pedido.data.documentId;});
 if(!grupo.length)return {ok:false,codigo:'PRESCRICAO_ASSINADA_VIGENTE_NAO_ENCONTRADA'};
 const candidatos:PrescricaoAssinadaRef[]=[];
 for(const e of grupo){
  const d=dadosDoEvento(e),corpo=d?.data,sig=SignatureReference.safeParse(d?.signature);
  if(!corpo||typeof corpo!=='object'||Array.isArray(corpo)||!sig.success||e.criadoPor.tipo!=='SESSAO')return {ok:false,codigo:'PRESCRICAO_ASSINATURA_INVALIDA'};
  const c=corpo as Record<string,unknown>,identidade=ReferenciaDocumento.safeParse({documentId:c.documentId,documentVersion:c.documentVersion});
  if(!identidade.success||identidade.data.documentId!==pedido.data.documentId||sig.data.documentId!==identidade.data.documentId||sig.data.documentVersion!==identidade.data.documentVersion
    ||sig.data.serverActorId!==e.criadoPor.id||sig.data.reviewDecisionId!==(e.payload as {reviewDecisionId?:unknown}).reviewDecisionId)
    return {ok:false,codigo:'PRESCRICAO_ASSINATURA_INVALIDA'};
  try{if(sig.data.documentHash!==hashCanonico(c))return {ok:false,codigo:'PRESCRICAO_HASH_INVALIDO'};}catch{return {ok:false,codigo:'PRESCRICAO_HASH_INVALIDO'};}
  if(!['PRESCRICAO','PRESCRICAO_QT','QT','TERAPIA_ALVO_IO','HORMONIOTERAPIA'].includes(String(c.tipoDocumento??c.tipo)))return {ok:false,codigo:'DOCUMENTO_NAO_E_PRESCRICAO'};
  candidatos.push({patientId:contexto.patientId,encounterId:contexto.encounterId,tumorLotId:contexto.tumorLotId,...identidade.data,documentHash:sig.data.documentHash,revisao:'ASSINADO'});
 }
 if(new Set(candidatos.map(c=>c.documentVersion)).size!==candidatos.length)return {ok:false,codigo:'PRESCRICAO_VERSAO_AMBIGUA'};
 const atual=candidatos.reduce((a,b)=>a.documentVersion>b.documentVersion?a:b);
 if(atual.documentVersion!==pedido.data.documentVersion)return {ok:false,codigo:'PRESCRICAO_VERSAO_DESATUALIZADA'};
 return {ok:true,prescricao:atual};
}
/** Compatibility: callers needing only a verified full reference retain the same interface. */
export function resolverPrescricaoDuto(eventos: readonly ClinicalEvent[], contexto: {patientId:string;encounterId:string;tumorLotId:string|null}, ref: z.infer<typeof ReferenciaDocumento>): PrescricaoAssinadaRef|null {
 const r=verificarPrescricaoDuto(eventos,contexto,ref);return r.ok?r.prescricao:null;
}
/** A versão e hash descrevem a tabela ativa realmente carregada e confrontada no boot. */
export function referenciaSigtapDuto(corpus: DepsDutos['corpus'], competencia: string): ReferenciaSigtap | null {
 const tabela=corpus?.sigtap[competencia];
 if(!tabela||corpus?.sigtapEstado!=='FONTE_OFICIAL_CONFERIDA')return null;
 const release=Object.entries(RELEASES_SIGTAP_CONFERIDAS).find(([,v])=>v.competencia===competencia);
 return release?{competencia,versao:release[0],hash:hashCanonico(tabela)}:null;
}

/** Roteador local: a sessão já resolvida é novamente vinculada ao token e ao encontro selecionado. */
function executarDuto(deps: DepsDutos, token: string, rota: string, entrada: unknown, sessaoResolvida: z.infer<typeof Sessao>): ResultadoDuto | null {
 if(!Rotas.has(rota))return null;
 const parsed=(rota==='/salao/revisar-relato-canal'?RevisaoRelatoPedido:rota==='/farmacia/enviar'?RxPedido:rota==='/farmacia/conferir'?FarmaciaPedido:rota==='/salao/registrar-administracao'?AdminPedido:rota==='/apac/validar-emissao'?ApacPedido:rota==='/chat/aceitar-decisao'?ChatPedido:TarefaPedido).safeParse(entrada);
 if(!parsed.success)return negar('DUTO_PEDIDO_INVALIDO',400);
 const em=deps.agora(); if(!Instante.safeParse(em).success)return negar('RELOGIO_INVALIDO');
 const sessao=deps.sessoes.obter(token), auth=Sessao.safeParse(sessao);
 if(!auth.success||hashCanonico(auth.data)!==hashCanonico(sessaoResolvida)||Date.parse(auth.data.emitidaEm)>Date.parse(em)||Date.parse(auth.data.expiraEm)<=Date.parse(em))return negar('SESSAO_INVALIDA',401);
 const pedido=parsed.data, c=pedido.contexto, selecionada=deps.sessoes.consultaSelecionada(token);
 const eventosGlobais=rota==='/salao/revisar-relato-canal'?lerEventosComIntegridade(deps.db).itens:null;
 const relatoAtual=eventosGlobais?(()=>{const p=RevisaoRelatoPedido.parse(entrada);return relatosInfusaoPendentes(deps.db,eventosGlobais,em)
   .find(m=>m.patientId===c.patientId&&m.mensagemId===p.mensagemId&&m.payloadSha256===p.payloadSha256);})():null;
 const mesmoContexto=!!selecionada&&selecionada.patientId===c.patientId&&selecionada.encounterId===c.encounterId&&(selecionada.tumorLotId??null)===c.tumorLotId;
 // A fila de relatos é global no consultório monousuário. Seu contexto é
 // explícito por operação e não muda o foco da triagem de outro paciente.
 // A mensagem/hash/vínculo serão novamente verificados no ramo dedicado.
 const contextoRevisaoConhecido=!!eventosGlobais&&c.tumorLotId===null&&eventosGlobais.some(e=>e.patientId===c.patientId
   &&e.encounterId===c.encounterId&&['CONFIRMADO','ASSINADO'].includes(e.revisao)&&Date.parse(e.criadoEm)<=Date.parse(em));
 if(rota==='/salao/revisar-relato-canal'){
  if(!contextoRevisaoConhecido)return negar('CONTEXTO_REVISAO_RELATO_INVALIDO',403);
 }else if(!mesmoContexto)return negar('CONSULTA_SELECIONADA_DIVERGENTE',403);
 const contexto:ContextoDutoServidor={patientId:c.patientId,encounterId:c.encounterId,tumorLotId:c.tumorLotId,atorId:auth.data.medicoId,em};
 const eventos=eventosGlobais?.filter(e=>e.patientId===c.patientId)??listarEventos(deps.db,c.patientId), vigentes=eventosVigentes(eventos).filter(e=>e.patientId===c.patientId&&e.encounterId===c.encounterId&&e.tumorLotId===c.tumorLotId&&['CONFIRMADO','ASSINADO'].includes(e.revisao));
 const requestHash=hashCanonico({rota,entrada});
 const replay=eventos.filter(e=>e.operationId===c.operationId);
 // Replay clínico por ID, sob a transação, independe do relógio de recebimento e da versão hoje vigente.
 // Continua exigindo sessão e consulta selecionada; nunca altera um evento histórico.
 if(rota==='/salao/registrar-administracao'){
  const p=AdminPedido.parse(entrada);
  const anteriores=listarEventos(deps.db,c.patientId).filter(e=>e.tipo==='TreatmentAdministration'&&dadosDoEvento(e)?.adminId===p.administracao.adminId);
  if(anteriores.length){
   const e=anteriores[0]!;
   if(anteriores.length!==1||e.patientId!==c.patientId||e.encounterId!==c.encounterId||e.tumorLotId!==c.tumorLotId
     ||!['CONFIRMADO','ASSINADO'].includes(e.revisao)||hashCanonico(dadosDoEvento(e))!==hashCanonico(p.administracao)
     ||hashCanonico(p.prescricao)!==hashCanonico(p.administracao.prescricaoRef)
     ||replay.some(r=>r.eventId!==e.eventId))return negar('ADMINISTRACAO_ID_CONFLITO');
   return {status:200,body:{codigo:'REPLAY',eventId:e.eventId}};
  }
 }
 const diagnostico='prescricao' in pedido?verificarPrescricaoDuto(eventos,contexto,pedido.prescricao):null;
 if(diagnostico&&!diagnostico.ok)return negar(diagnostico.codigo);
 const prescricao=diagnostico?.ok?diagnostico.prescricao:null;
 if(replay.length){
  if(replay.length!==1||replay[0]!.fontes[0]?.contentHash!==requestHash||replay[0]!.criadoPor.id!==auth.data.medicoId||replay[0]!.encounterId!==c.encounterId||replay[0]!.tumorLotId!==c.tumorLotId)return negar('OPERATION_ID_CONFLITO');
  return {status:200,body:{codigo:'REPLAY',eventId:replay[0]!.eventId}};
 }
 let tipo='FATO',payload:unknown,supersedesEventId:string|null=null;
 const fato=(campo:string)=>vigentes.filter(e=>e.tipo==='FATO'&&dadosDoEvento(e)?.campo===campo);
 if(rota==='/salao/revisar-relato-canal'){
  const p=RevisaoRelatoPedido.parse(entrada);
  if(!relatoAtual)return negar('RELATO_PENDENTE_NAO_ENCONTRADO');
  tipo='ReviewDecision';payload={campo:'revisaoRelatoInfusaoCanal',mensagemId:p.mensagemId,payloadSha256:p.payloadSha256,decisao:p.decisao,
    contatoId:relatoAtual.contatoId,canal:relatoAtual.canal};
 }else if(rota.startsWith('/farmacia/')){
  const anteriores=fato('farmacia.conferencia').flatMap(e=>{const p=ConferenciaFarmacia.safeParse(dadosDoEvento(e)?.valor);return p.success&&p.data.prescricao.documentId===prescricao!.documentId?[{e,registro:p.data}]:[];});
  if(anteriores.length>1)return negar('CONFERENCIA_FARMACIA_AMBIGUA');
  const anterior=anteriores.at(-1);
  if(rota==='/farmacia/enviar'){
   if(anterior&&anterior.registro.prescricao.documentVersion===prescricao!.documentVersion&&anterior.registro.prescricao.documentHash===prescricao!.documentHash)return negar('PRESCRICAO_JA_ENVIADA');
   payload={campo:'farmacia.conferencia',valor:{prescricao,estado:'ENVIADA',motivo:null,atorId:auth.data.medicoId,em}};
  }else{
   if(!anterior)return negar('ENVIO_FARMACIA_PENDENTE');
   const p=FarmaciaPedido.parse(entrada);const r=conferirPrescricao({prescricao,acao:p.acao,...(p.motivo?{motivo:p.motivo}:{}),anterior:anterior.registro},contexto);
   if(!r.ok)return negar(r.codigo);payload={campo:'farmacia.conferencia',valor:r.registro};
  }
  supersedesEventId=anterior?.e.eventId??null;
 }else if(rota==='/salao/registrar-administracao'){
  const p=AdminPedido.parse(entrada),r=registrarAdministracao({prescricao,administracao:p.administracao},contexto);
  if(!r.ok)return negar(r.codigo);
  const medida=validarMedidaAdministracao(p.administracao);if(!medida.ok)return negar(medida.codigo);
  const ciclos=vigentes.filter(e=>e.tipo==='Ciclo'&&dadosDoEvento(e)?.cicloId===p.administracao.cicloId);
  if(ciclos.length!==1)return negar('CICLO_CONFIRMADO_NAO_ENCONTRADO');
  const ciclo=dadosDoEvento(ciclos[0]!);
  const refCiclo=ciclo?.prescricaoRef as {documentId?:unknown;documentVersion?:unknown}|null;
  const itens=Array.isArray(ciclo?.itens)?ciclo.itens:[];
  const item=itens.find(i=>i&&typeof i==='object'&&i.item===p.administracao.item);
  if(refCiclo?.documentId!==prescricao!.documentId||refCiclo.documentVersion!==prescricao!.documentVersion||!item||item.droga!==p.administracao.droga)return negar('ADMINISTRACAO_ITEM_CICLO_DIVERGENTE');
  tipo=r.tipo;payload=r.dados;
 }else if(rota==='/apac/validar-emissao'){
  const p=ApacPedido.parse(entrada), candidatas=vigentes.filter(e=>e.tipo==='APAC').flatMap(e=>{const a=Apac.safeParse(dadosDoEvento(e));return a.success&&a.data.apacId===p.apacId?[a.data]:[];});
  if(candidatas.length!==1||candidatas[0]!.versao!==p.apacVersao)return negar('APAC_VIGENTE_NAO_ENCONTRADA');
  const apac=candidatas[0]!,rx=resolverPrescricaoDuto(eventos,contexto,apac.prescricaoAssinadaRef),sigtap=referenciaSigtapDuto(deps.corpus,apac.competencia),civil=dataCivilDoServico(em);
  if(!rx||!sigtap||civil.estado!=='OK'||!deps.corpus)return negar('PRESCRICAO_OU_SIGTAP_PENDENTE');
  const r=criarValidacaoPersistida({apac,prescricao:rx,sigtap,antiglosa:antiglosa(apac,{hoje:civil.dataCivil,sigtap:deps.corpus.sigtap,caixas:deps.corpus.caixasTodas,cnesConfigurado:deps.settings?.readProfile(auth.data).perfil.instituicao.cnes??''})},contexto);
  if(!r.ok)return negar(r.codigo);
  payload={campo:'apac.validacaoEmissao',valor:r.validacao};
  const anterior=fato('apac.validacaoEmissao').find(e=>(dadosDoEvento(e)?.valor as {apacId?:unknown})?.apacId===apac.apacId);supersedesEventId=anterior?.eventId??null;
 }else if(rota==='/chat/aceitar-decisao'){
  const p=ChatPedido.parse(entrada),mensagens=vigentes.filter(e=>e.tipo==='ChatMessage'&&dadosDoEvento(e)?.mensagemId===p.mensagemId);
  if(mensagens.length!==1)return negar('MENSAGEM_CHAT_NAO_ENCONTRADA');
  if(['farmacia.conferencia','apac.validacaoEmissao'].includes(p.decisao.campo))return negar('CAMPO_DE_DUTO_RESERVADO');
  const mensagem=mensagens[0]!,dadosMensagem=dadosDoEvento(mensagem);
  if(!validarPayloadEvento('ChatMessage',dadosMensagem).ok||dadosMensagem?.patientId!==c.patientId
    ||dadosMensagem.encounterId!==c.encounterId)return negar('MENSAGEM_CHAT_FORA_CONTEXTO');
  const r=aceitarDecisaoChat({mensagemId:p.mensagemId,decisao:p.decisao},contexto);if(!r.ok)return negar(r.codigo);
  // Reabrir a tela perde a chave local, mas não torna a mesma anotação uma nova decisão.
  const existente=vigentes.find(e=>{
   if(e.tipo!=='AnotacaoEvolucao'||e.criadoPor.tipo!=='SESSAO'||e.criadoPor.id!==auth.data.medicoId)return false;
   const n=AnotacaoEvolucao.safeParse(dadosDoEvento(e));return n.success&&n.data.atorId===auth.data.medicoId
    &&n.data.texto===r.dados.texto&&n.data.mensagemId===p.mensagemId&&n.data.origemMensagem.eventId===mensagem.eventId
    &&n.data.origemMensagem.contentHash===hashCanonico(mensagem)
    &&n.data.contexto.patientId===c.patientId&&n.data.contexto.encounterId===c.encounterId&&n.data.contexto.tumorLotId===c.tumorLotId;
  });
  if(existente)return {status:200,body:{codigo:'REPLAY',eventId:existente.eventId}};
  tipo=r.tipo;payload={...r.dados,contexto:r.contexto,origemMensagem:{eventId:mensagem.eventId,contentHash:hashCanonico(mensagem)}};
 }else{
  const p=TarefaPedido.parse(entrada),ts=vigentes.filter(e=>e.tipo==='Tarefa').flatMap(e=>{const t=Tarefa.safeParse(dadosDoEvento(e));return t.success&&t.data.tarefaId===p.tarefaId?[{e,t:t.data}]:[];});
  if(ts.length!==1)return negar('TAREFA_VIGENTE_NAO_ENCONTRADA');
  const r=rota==='/tarefas/receber'?receberTarefa(ts[0]!.t,contexto):concluirTarefa(ts[0]!.t,contexto);if(!r.ok)return negar(r.codigo);
  tipo='Tarefa';payload=r.tarefa;supersedesEventId=ts[0]!.e.eventId;
 }
 const key=createHash('sha256').update(c.operationId).digest('hex'),draftId=`duto-${key}`,eventId=`duto-event-${key}`;
 const fonte:Fonte={sourceId:`duto-${key}`,classe:'MANUAL',localizador:null,dataClinica:em.slice(0,10),dataCaptura:em,versao:'1',contentHash:requestHash};
 const draft=salvarDraft(deps.db,{draftId,patientId:c.patientId,sourceId:fonte.sourceId,rawRef:draftId,payload:{contexto,valor:payload},diagnostics:[],revision:0,criadoEm:em});
 try{
  const r=executarConfirmacao(deps.db, { autorizadoEm: deps.agora(), operationId:c.operationId,patientId:c.patientId,encounterId:c.encounterId,tumorLotId:c.tumorLotId,reviewDecisionId:`duto-review-${key}`,sessao:auth.data,em,
   registros:[{draftId:draft.draftId,expectedRevision:draft.revision,eventId,tipo,payload,fontes:tipo==='TreatmentAdministration'?[fonte,AdminPedido.parse(entrada).administracao.fonte]:[fonte],revisao:'CONFIRMADO',supersedesEventId}]});
  return r.estado==='NEGADA'?negar(r.motivo??'DUTO_COMANDO_NEGADO'):{status:200,body:{codigo:r.estado,eventId}};
 }catch{throw new Error('DUTO_COMANDO_NAO_CONFIRMADO');}
}

export function rotearDutos(deps: DepsDutos, token: string, rota: string, entrada: unknown, sessaoResolvida: z.infer<typeof Sessao>): ResultadoDuto | null {
 if(!Rotas.has(rota))return null;
 try { return transacao(deps.db,()=>executarDuto(deps,token,rota,entrada,sessaoResolvida)); }
 catch { return negar('DUTO_TRANSACAO_NAO_CONFIRMADA'); }
}
