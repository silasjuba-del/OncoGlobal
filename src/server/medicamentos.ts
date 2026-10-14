import {z} from 'zod';
import type {DatabaseSync} from 'node:sqlite';
import type {GerenciadorSessao} from './sessao.js';
import {Sessao,Instante} from '../contracts/base.js';
import {executarConfirmacao} from '../kernel/comandos/index.js';
import {listarEventos,salvarDraft,transacao} from '../kernel/comandos/portas.js';
import {dadosDoEvento,eventosVigentes} from '../kernel/projections/snapshot.js';
import {hashCanonico} from '../rules/conteudoCanonico.js';
import {dataCivilDoServico} from '../rules/tempoServico.js';
const Id=z.string().trim().min(1).max(200);
const Pedido=z.object({patientId:Id,encounterId:Id,tumorLotId:Id.nullable(),operationId:Id,medicamentos:z.array(z.string().trim().min(1).max(200)).max(100),listaAtualCompleta:z.literal(true)}).strict();
export interface DepsMedicamentos {db:DatabaseSync;sessoes:GerenciadorSessao;agora:()=>string;}
/** Lista inteira atestada pelo médico; nunca derivada de receita ou prosa. */
export function reconciliarMedicamentos(raw:unknown,token:string,deps:DepsMedicamentos):{status:number;body:{codigo:string;eventId?:string|null;refs?:string[]}}{
 const negar=(codigo:string,status=409,refs?:string[])=>({status,body:{codigo,...(refs?{refs}:{})}});
 const parsed=Pedido.safeParse(raw);if(!parsed.success)return negar('RECONCILIACAO_MEDICAMENTOS_INVALIDA',400);
 const p=parsed.data,em=deps.agora(),sessao=Sessao.safeParse(deps.sessoes.obter(token));
 if(!Instante.safeParse(em).success)return negar('RELOGIO_INVALIDO');
 if(!sessao.success||Date.parse(sessao.data.emitidaEm)>Date.parse(em)||Date.parse(sessao.data.expiraEm)<=Date.parse(em))return negar('SESSAO_INVALIDA',401);
 const selecionada=deps.sessoes.consultaSelecionada(token);
 if(!selecionada||selecionada.patientId!==p.patientId||selecionada.encounterId!==p.encounterId||(selecionada.tumorLotId??null)!==p.tumorLotId)return negar('CONSULTA_SELECIONADA_DIVERGENTE',403);
 const hash=hashCanonico(p),eventId=`med-reconciliado-${hashCanonico({operationId:p.operationId})}`,draftId=`draft-${eventId}`;
 try{return transacao(deps.db,()=>{
  const eventos=listarEventos(deps.db,p.patientId),replay=eventos.filter(e=>e.operationId===p.operationId);
  if(replay.length){const e=replay[0]!;
   if(replay.length!==1||e.tipo!=='FATO'||dadosDoEvento(e)?.campo!=='medicamentos'||e.fontes[0]?.contentHash!==hash||e.criadoPor.id!==sessao.data.medicoId||e.encounterId!==p.encounterId||e.tumorLotId!==p.tumorLotId)return negar('OPERATION_ID_CONFLITO');
   return {status:200,body:{codigo:'REPLAY',eventId:e.eventId}};
  }
  const anteriores=eventosVigentes(eventos).filter(e=>['CONFIRMADO','ASSINADO'].includes(e.revisao)&&/^FATO(?:@1)?$/.test(e.tipo)&&dadosDoEvento(e)?.campo==='medicamentos');
  if(anteriores.length>1)return negar('LISTA_MEDICAMENTOS_CONFLITANTE',409,anteriores.map(e=>e.eventId));
  const anterior=anteriores[0];const valorAnterior=anterior?dadosDoEvento(anterior)?.valor:undefined;
  if(anterior&&(!Array.isArray(valorAnterior)||valorAnterior.some(v=>typeof v!=='string'||!v.trim())))return negar('LISTA_MEDICAMENTOS_ANTERIOR_FORA_DO_CONTRATO',409,[anterior.eventId]);
  const payload={campo:'medicamentos',valor:p.medicamentos,listaAtualCompleta:true,escopo:'PACIENTE'};
  const data=dataCivilDoServico(em);if(data.estado!=='OK')throw new Error('RELOGIO_INVALIDO');
  const fonte={sourceId:`manual-${eventId}`,classe:'MANUAL' as const,localizador:null,dataClinica:data.dataCivil,dataCaptura:em,versao:'F1-MED-RECONC@1',contentHash:hash};
  salvarDraft(deps.db,{draftId,patientId:p.patientId,sourceId:fonte.sourceId,rawRef:`manual:${hash}`,payload:{...payload,contexto:{patientId:p.patientId,encounterId:p.encounterId,tumorLotId:p.tumorLotId}},diagnostics:[],revision:1,criadoEm:em});
  const r=executarConfirmacao(deps.db,{operationId:p.operationId,patientId:p.patientId,encounterId:p.encounterId,tumorLotId:p.tumorLotId,sessao:sessao.data,em,reviewDecisionId:`review-${eventId}`,registros:[{draftId,expectedRevision:1,eventId,tipo:'FATO',payload,fontes:[fonte],revisao:'CONFIRMADO',supersedesEventId:anterior?.eventId??null}]});
  if(r.estado==='NEGADA')throw new Error(r.motivo??'RECONCILIACAO_NEGADA');
  return {status:r.estado==='GRAVADA'?201:200,body:{codigo:r.estado,eventId:r.resultRef}};
 });}catch(error){return negar(error instanceof Error?error.message:'RECONCILIACAO_NEGADA');}
}
