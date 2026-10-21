import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import type {DatabaseSync} from 'node:sqlite';
import {ContaSaidaWhatsApp,criarTransporteWhatsApp,type TransporteCanal} from '../kernel/gateway/executores/canal.js';
import {listarEventos} from '../kernel/comandos/portas.js';
import {dadosDoEvento,eventosVigentes} from '../kernel/projections/snapshot.js';
import {projetarVinculosContato} from '../kernel/projections/vinculosContato.js';
import {Contato,Paciente} from '../contracts/clinico.js';
import {hashConteudoExibido} from './sessao.js';
import type {ContaWebhookConfigurada} from './canalEntrada.js';
import {consultarCaixaCanal,consultarHistoricoCanal,type AcessoCanal} from './canalEntrada.js';
import {lerEventosComIntegridade} from './leituras.js';
import type {ClinicalEvent} from '../contracts/operacao.js';
import type {MensagemCanalVisao} from '../contracts/api/porta.js';
import {classificarRemetente} from '../modules/canal/ingresso.js';
import {StatusReciboTecnico} from '../contracts/f2/canalEntrada.js';
import {lerReconciliacaoMensagemCanal} from './canalReconciliacao.js';
import {AutorizacaoRespostaCanalServidor} from '../contracts/f2/caixaRespostaCanal.js';

const Id=z.string().trim().min(1).max(250);
export const ConfiguracaoCanalLocal=z.object({contasWebhook:z.array(z.object({accountId:Id,phoneNumberId:z.string().regex(/^\d+$/).max(250).optional(),canal:z.literal('WHATSAPP_SERVICO'),keyId:Id.regex(/^[A-Za-z0-9_-]+$/),
  segredo:z.string().min(1).max(512),verifyToken:Id}).strict()).max(20),whatsappSaida:z.array(ContaSaidaWhatsApp).max(20).default([])}).strict()
 .superRefine((c,ctx)=>{for(const chave of ['keyId','accountId'] as const)if(new Set(c.contasWebhook.map(x=>x[chave])).size!==c.contasWebhook.length)ctx.addIssue({code:'custom',message:'Contas duplicadas'});
  const nativas=c.contasWebhook.flatMap(w=>w.phoneNumberId===undefined?[]:[w.phoneNumberId]);
  if(new Set(nativas).size!==nativas.length)ctx.addIssue({code:'custom',message:'Conta nativa duplicada'});
  if(c.whatsappSaida.some(s=>c.contasWebhook.some(w=>w.accountId===s.accountId&&w.phoneNumberId!==undefined&&w.phoneNumberId!==s.phoneNumberId)))ctx.addIssue({code:'custom',message:'Identificador nativo divergente entre ingresso e saída'});
  if(new Set(c.whatsappSaida.map(x=>x.accountId)).size!==c.whatsappSaida.length)ctx.addIssue({code:'custom',message:'Saída duplicada'});
  if(c.whatsappSaida.some(s=>!c.contasWebhook.some(w=>w.accountId===s.accountId)))ctx.addIssue({code:'custom',message:'Conta de saída sem ingresso'});});
export interface OperacaoCanal {contasWebhook:readonly ContaWebhookConfigurada[];transporteSaida?:TransporteCanal}
/** Configuração local deliberada do operador. Ausente/desconhecida: nenhuma saída é habilitada. */
export function carregarOperacaoCanal(root?:string):OperacaoCanal {
  if(!root||!existsSync(join(root,'canal.local.json')))return {contasWebhook:[]};
  try{const c=ConfiguracaoCanalLocal.parse(JSON.parse(readFileSync(join(root,'canal.local.json'),'utf8')));
    return {contasWebhook:c.contasWebhook,...(c.whatsappSaida.length?{transporteSaida:criarTransporteWhatsApp(c.whatsappSaida)}:{})};
  }catch{throw new Error('CONFIGURACAO_CANAL_INVALIDA');}
}
function pacienteDoEvento(evento:ClinicalEvent){
 if(!['Paciente','Paciente@1'].includes(evento.tipo)||!['CONFIRMADO','ASSINADO'].includes(evento.revisao))return null;
 const paciente=Paciente.safeParse(dadosDoEvento(evento));
 return paciente.success&&paciente.data.patientId===evento.patientId?paciente.data:null;
}
/** Somente contatos explicitamente vinculados no prontuário; nome e From não provam identidade. */
export function cadastrosCanal(db:DatabaseSync, snapshot?:readonly ClinicalEvent[]){
 const eventos=eventosVigentes(snapshot??lerEventosComIntegridade(db).itens);
 const pacientes=eventos.flatMap(e=>{const p=pacienteDoEvento(e);return p?[p]:[];});
 const contatos=eventos.filter(e=>e.tipo==='Contato'&&['CONFIRMADO','ASSINADO'].includes(e.revisao)).flatMap(event=>{const p=Contato.safeParse(dadosDoEvento(event));return p.success?[{event,value:p.data}]:[];});
 const projetados=projetarVinculosContato(contatos,eventos);
 return pacientes.map(p=>({patientId:p.patientId,nome:p.nome,chaveDemografica:null,identificadores:projetados.filter(c=>c.estadoVinculo==='VINCULADO'&&c.patientIdResolvido===p.patientId&&c.value.revogadoEm===null&&c.value.canal==='WHATSAPP_SERVICO')
   .map(c=>({tipo:'TELEFONE' as const,valor:c.value.endereco}))}));
}
export function contatoRevogadoCanal(db:DatabaseSync,endereco:string,snapshot?:readonly ClinicalEvent[]):boolean {
 return eventosVigentes(snapshot??lerEventosComIntegridade(db).itens).some(e=>{
  if(e.tipo!=='Contato'||!['CONFIRMADO','ASSINADO'].includes(e.revisao))return false;
  const c=Contato.safeParse(dadosDoEvento(e));return c.success&&c.data.endereco===endereco&&c.data.revogadoEm!==null;
 });
}
export function contextosCanal(db:DatabaseSync,patientId:string,snapshot?:readonly ClinicalEvent[]){
 const eventos=eventosVigentes(snapshot?snapshot.filter(e=>e.patientId===patientId):listarEventos(db,patientId)).filter(e=>['CONFIRMADO','ASSINADO'].includes(e.revisao));
 return [...new Map(eventos.map(e=>[JSON.stringify([e.encounterId,e.tumorLotId]),{patientId,encounterId:e.encounterId,tumorLotId:e.tumorLotId}])).values()];
}
export function vinculoAtualCanal(db:DatabaseSync,patientId:string,endereco:string):boolean {
 const v=classificarRemetente(endereco,'TELEFONE',cadastrosCanal(db));return v.classe==='CONHECIDO'&&v.patientId===patientId;
}
export function revisaoContextoCanal(db:DatabaseSync,c:{patientId:string;encounterId:string;tumorLotId:string|null}):string|null {
 const eventos=eventosVigentes(listarEventos(db,c.patientId));
 if(!eventos.some(e=>pacienteDoEvento(e)?.patientId===c.patientId))return null;
 if(!contextosCanal(db,c.patientId).some(e=>e.encounterId===c.encounterId&&e.tumorLotId===c.tumorLotId))return null;
 return hashConteudoExibido(eventos);
}
export function lerMensagensOperacionaisCanal(db:DatabaseSync,acesso:AcessoCanal,snapshot?:readonly ClinicalEvent[],
  historicoCompleto=false):MensagemCanalVisao[]{
 if(historicoCompleto&&snapshot)throw new Error('SNAPSHOT_PARCIAL_NAO_PERMITIDO');
 const caixa=historicoCompleto?consultarHistoricoCanal(db,acesso):consultarCaixaCanal(db,acesso);
 if(!caixa.ok)throw new Error(caixa.codigo);
 if(!caixa.mensagens.length)return [];
 const eventos=snapshot??lerEventosComIntegridade(db).itens;
 const cadastros=cadastrosCanal(db,eventos);
 const colunas=db.prepare('PRAGMA table_info(canal_resposta_envio)').all() as {name:string}[];
 const temRecibos=colunas.some(c=>c.name==='providerReceiptId');
 return caixa.mensagens.map(m=>{
  const reconciliacao=lerReconciliacaoMensagemCanal(db,m.mensagemId);
  const atual=m.canal==='WHATSAPP_SERVICO'?classificarRemetente(m.senderRef,'TELEFONE',cadastros):null;
  const revogado=contatoRevogadoCanal(db,m.senderRef,eventos);
  const conflito=atual?.classe==='AMBIGUO'||(m.vinculo.patientId&&atual?.patientId&&m.vinculo.patientId!==atual.patientId);
  const patientId=!revogado&&!conflito&&atual?.classe==='CONHECIDO'?atual.patientId:null;
  const paciente=patientId?cadastros.find(c=>c.patientId===patientId):null;
  const status=temRecibos?db.prepare(`SELECT t.statusRecibo FROM canal_recibo_tecnico t
    JOIN canal_resposta_envio e ON e.providerReceiptId=t.providerMessageId
    JOIN canal_mensagem origem ON origem.mensagemId=e.mensagemOrigemId AND origem.accountId=t.accountId
    WHERE e.mensagemOrigemId=? ORDER BY t.ocorreuEm DESC,CASE t.statusRecibo WHEN 'LIDA' THEN 4 WHEN 'ENTREGUE' THEN 3 WHEN 'FALHOU' THEN 2 ELSE 1 END DESC LIMIT 1`).get(m.mensagemId) as {statusRecibo:string}|undefined:undefined;
  const recibo=StatusReciboTecnico.safeParse(status?.statusRecibo);
  const envios=colunas.length?db.prepare(`SELECT a.autorizacaoJson FROM canal_resposta_envio e
    JOIN canal_resposta_autorizada a ON a.respostaId=e.respostaId AND a.versao=e.versao
    WHERE e.mensagemOrigemId=?`).all(m.mensagemId) as {autorizacaoJson:string}[]:[];
  const respondida=envios.some(e=>{
    try{const a=AutorizacaoRespostaCanalServidor.safeParse(JSON.parse(e.autorizacaoJson));
      return a.success&&a.data.mensagemOrigemId===m.mensagemId&&a.data.accountId===m.accountId
        &&a.data.canal===m.canal&&a.data.contexto.patientId===patientId
        &&a.data.destinatarioCanonico===m.senderRef&&a.data.tipoResposta!=='ACUSO_RECEBIMENTO_TECNICO';
    }catch{return false;}
  });
  return {mensagemId:m.mensagemId,texto:m.conteudo.tipo==='TEXT'?m.conteudo.texto:'Mídia recebida; aguarda leitura local.',em:m.providerSentAt??m.ingestedAt,
   redFlag:!!reconciliacao?.alarmes.alarmesAtivos.length,contatoId:m.senderRef,patientId:paciente?patientId:null,nomePaciente:paciente?.nome??null,
   candidatos:!paciente&&!revogado&&!conflito&&m.canal==='WHATSAPP_SERVICO'?cadastros.flatMap(c=>[...new Set(contextosCanal(db,c.patientId,eventos).map(ctx=>ctx.encounterId))].map(encounterId=>({patientId:c.patientId,nome:c.nome??c.patientId,encounterId,tumorLotId:null}))):[],
   estadoVinculo:revogado?'REVOGADO':conflito?'CONFLITO':paciente?'VINCULADO':'SEM_VINCULO',origemCanal:m.canal,pendenciaProcessamento:!reconciliacao,estadoConversa:respondida?'RESPONDIDA':'AGUARDA_MEDICO',reciboTecnico:recibo.success?recibo.data:envios.length?'ENVIADA':reconciliacao?'PROCESSADA':m.reciboTecnico,
   ...(paciente&&patientId?{contextosResposta:contextosCanal(db,patientId,eventos)}:{}),destinatarioExibido:m.senderRef,
   midia:m.conteudo.tipo==='MEDIA_UNPROCESSED'?{providerMediaId:m.conteudo.providerMediaId,mimeType:m.conteudo.mimeType,processamento:'NAO_PROCESSADA'}:null};
 });
}
