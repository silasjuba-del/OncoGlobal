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
import {consultarCaixaCanal,type AcessoCanal} from './canalEntrada.js';
import {lerEventosComIntegridade,lerPaciente} from './leituras.js';
import type {MensagemCanalVisao} from '../contracts/api/porta.js';
import {classificarRemetente} from '../modules/canal/ingresso.js';
import {StatusReciboTecnico} from '../contracts/f2/canalEntrada.js';

const Id=z.string().trim().min(1).max(250);
export const ConfiguracaoCanalLocal=z.object({contasWebhook:z.array(z.object({accountId:Id,canal:z.literal('WHATSAPP_SERVICO'),keyId:Id.regex(/^[A-Za-z0-9_-]+$/),
  segredo:z.string().min(1).max(512),verifyToken:Id}).strict()).max(20),whatsappSaida:z.array(ContaSaidaWhatsApp).max(20).default([])}).strict()
 .superRefine((c,ctx)=>{for(const chave of ['keyId','accountId'] as const)if(new Set(c.contasWebhook.map(x=>x[chave])).size!==c.contasWebhook.length)ctx.addIssue({code:'custom',message:'Contas duplicadas'});
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
/** Somente contatos explicitamente vinculados no prontuário; nome e From não provam identidade. */
export function cadastrosCanal(db:DatabaseSync){
 const eventos=eventosVigentes(lerEventosComIntegridade(db).itens);
 const pacientes=eventos.filter(e=>['CONFIRMADO','ASSINADO'].includes(e.revisao)&&e.tipo==='Paciente').flatMap(e=>{const p=Paciente.safeParse(dadosDoEvento(e));return p.success&&p.data.patientId===e.patientId?[p.data]:[];});
 const contatos=eventos.filter(e=>e.tipo==='Contato'&&['CONFIRMADO','ASSINADO'].includes(e.revisao)).flatMap(event=>{const p=Contato.safeParse(dadosDoEvento(event));return p.success?[{event,value:p.data}]:[];});
 const projetados=projetarVinculosContato(contatos,eventos);
 return pacientes.map(p=>({patientId:p.patientId,nome:p.nome,chaveDemografica:null,identificadores:projetados.filter(c=>c.estadoVinculo==='VINCULADO'&&c.patientIdResolvido===p.patientId&&c.value.revogadoEm===null&&c.value.canal==='WHATSAPP_SERVICO')
   .map(c=>({tipo:'TELEFONE' as const,valor:c.value.endereco}))}));
}
export function contextosCanal(db:DatabaseSync,patientId:string){
 const eventos=eventosVigentes(listarEventos(db,patientId)).filter(e=>['CONFIRMADO','ASSINADO'].includes(e.revisao));
 return [...new Map(eventos.map(e=>[JSON.stringify([e.encounterId,e.tumorLotId]),{patientId,encounterId:e.encounterId,tumorLotId:e.tumorLotId}])).values()];
}
export function vinculoAtualCanal(db:DatabaseSync,patientId:string,endereco:string):boolean {
 const v=classificarRemetente(endereco,'TELEFONE',cadastrosCanal(db));return v.classe==='CONHECIDO'&&v.patientId===patientId;
}
export function revisaoContextoCanal(db:DatabaseSync,c:{patientId:string;encounterId:string;tumorLotId:string|null}):string|null {
 const eventos=eventosVigentes(listarEventos(db,c.patientId));
 if(!eventos.some(e=>e.tipo==='Paciente'&&['CONFIRMADO','ASSINADO'].includes(e.revisao)))return null;
 if(!contextosCanal(db,c.patientId).some(e=>e.encounterId===c.encounterId&&e.tumorLotId===c.tumorLotId))return null;
 return hashConteudoExibido(eventos);
}
export function lerMensagensOperacionaisCanal(db:DatabaseSync,acesso:AcessoCanal):MensagemCanalVisao[]{
 const caixa=consultarCaixaCanal(db,acesso);if(!caixa.ok)throw new Error(caixa.codigo);
 const colunas=db.prepare('PRAGMA table_info(canal_resposta_envio)').all() as {name:string}[];
 const temRecibos=colunas.some(c=>c.name==='providerReceiptId');
 return caixa.mensagens.map(m=>{
  const patientId=m.vinculo.classe==='CONHECIDO'&&m.vinculo.patientId&&vinculoAtualCanal(db,m.vinculo.patientId,m.senderRef)?m.vinculo.patientId:null;
  const paciente=patientId?lerPaciente(db,patientId):null;
  const status=temRecibos?db.prepare(`SELECT t.statusRecibo FROM canal_recibo_tecnico t
    JOIN canal_resposta_envio e ON e.providerReceiptId=t.providerMessageId
    JOIN canal_mensagem origem ON origem.mensagemId=e.mensagemOrigemId AND origem.accountId=t.accountId
    WHERE e.mensagemOrigemId=? ORDER BY t.ocorreuEm DESC,CASE t.statusRecibo WHEN 'LIDA' THEN 4 WHEN 'ENTREGUE' THEN 3 WHEN 'FALHOU' THEN 2 ELSE 1 END DESC LIMIT 1`).get(m.mensagemId) as {statusRecibo:string}|undefined:undefined;
  const recibo=StatusReciboTecnico.safeParse(status?.statusRecibo);
  return {mensagemId:m.mensagemId,texto:m.conteudo.tipo==='TEXT'?m.conteudo.texto:'Mídia recebida; aguarda leitura local.',em:m.providerSentAt??m.ingestedAt,
   redFlag:false,contatoId:m.senderRef,patientId:paciente?patientId:null,nomePaciente:paciente?.nome??null,candidatos:[],
   estadoVinculo:paciente?'VINCULADO':'SEM_VINCULO',origemCanal:m.canal,pendenciaProcessamento:true,reciboTecnico:recibo.success?recibo.data:m.reciboTecnico,
   ...(paciente&&patientId?{contextosResposta:contextosCanal(db,patientId)}:{}),destinatarioExibido:m.senderRef,
   midia:m.conteudo.tipo==='MEDIA_UNPROCESSED'?{providerMediaId:m.conteudo.providerMediaId,mimeType:m.conteudo.mimeType,processamento:'NAO_PROCESSADA'}:null};
 });
}
