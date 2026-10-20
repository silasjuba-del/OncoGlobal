import { g23ComandoDeepgram } from "../harness/gates.js";
import {randomBytes} from 'node:crypto';
import type {Server} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {DeepgramClient} from '@deepgram/sdk';
import {z} from 'zod';
import {DitadoPedido,type EventoDitado,type ContextoDitado} from '../../contracts/fase2/ditado.js';
import type {CofreDeepgram} from './cofreDeepgram.js';
type SessoesDitado={obter:(token:string)=>{medicoId:string}|null;consultaSelecionada:(token:string)=>{patientId:string;encounterId:string;tumorLotId?:string|null}|null};

export interface CanalVoz {
 enviar(audio:Uint8Array):void; finalizar():void; manter():void; fechar():void; pendentes():number;
}
export type ConectarVoz=(chave:string,signal:AbortSignal,eventos:{pronto:()=>void;mensagem:(m:unknown)=>void;erro:()=>void;fechado:()=>void})=>Promise<CanalVoz>;
/** Único adaptador de rede: chave no servidor, destino fixo e sem reconexão que possa duplicar palavras. */
export const conectarDeepgram:ConectarVoz=async(chave,signal,eventos)=>{
 const client=new DeepgramClient({apiKey:chave,reconnect:false});
 const socket=await client.listen.v1.connect({Authorization:`Token ${chave}`,model:'nova-3',language:'pt-BR',
  punctuate:'true',interim_results:'true',smart_format:'false',mip_opt_out:'true',reconnectAttempts:0,
  connectionTimeoutInSeconds:10,abortSignal:signal});
 socket.on('open',eventos.pronto);socket.on('message',eventos.mensagem);socket.on('error',eventos.erro);socket.on('close',eventos.fechado);
 if(signal.aborted){socket.close();throw Error('DITADO_CANCELADO');}
 socket.connect();
 return {enviar:audio=>socket.sendMedia(audio),finalizar:()=>socket.sendCloseStream({type:'CloseStream'}),
  manter:()=>socket.sendKeepAlive({type:'KeepAlive'}),fechar:()=>socket.close(),pendentes:()=>socket.socket.bufferedAmount};
};
const Resultado=z.object({type:z.literal('Results'),start:z.number(),duration:z.number(),is_final:z.boolean(),
 channel:z.object({alternatives:z.array(z.object({transcript:z.string().max(200_000),confidence:z.number().min(0).max(1).optional()}))})});
type Ticket={token:string;contexto:z.infer<typeof ContextoDitado>;expira:number;chave:string};

/** Credencial persistente exige cofre explícito; áudio nunca é gravado ou registrado em logs. */
export function criarDitado(sessoes:SessoesDitado,opcoes:{chave?:string;cofre?:CofreDeepgram|null;conectar?:ConectarVoz;agora?:()=>number}={}){
 const agora=opcoes.agora??Date.now,conectar=opcoes.conectar??conectarDeepgram;
 const chaves=new Map<string,string>(),tickets=new Map<string,Ticket>(),ativos=new Map<string,()=>void>();
 const wss=new WebSocketServer({noServer:true,maxPayload:128*1024,perMessageDeflate:false});
 let encerrado=false;
 const valido=(t:Ticket)=>{const c=sessoes.consultaSelecionada(t.token);return !!sessoes.obter(t.token)&&!!c&&c.patientId===t.contexto.patientId&&c.encounterId===t.contexto.encounterId&&(c.tumorLotId??null)===t.contexto.tumorLotId;};
 function limpar(){for(const [k,t] of tickets)if(t.expira<=agora()||!valido(t))tickets.delete(k);for(const k of chaves.keys())if(!sessoes.obter(k))chaves.delete(k);}
 const varrer=setInterval(limpar,10_000);varrer.unref();
 function cancelar(token:string){ativos.get(token)?.();for(const [k,t] of tickets)if(t.token===token)tickets.delete(k);}
 function rotear(raw:unknown,token:string):{status:number;body:unknown}{
  limpar();const p=DitadoPedido.safeParse(raw);
  const sessao=sessoes.obter(token);if(!sessao)return {status:401,body:{codigo:'SESSAO_INVALIDA'}};
  if(!p.success)return {status:400,body:{codigo:'PAYLOAD_INVALIDO'}};
  if(encerrado)return {status:503,body:{codigo:'DITADO_INDISPONIVEL'}};
  const persistir=p.data.acao==='SALVAR_CHAVE_ATUAL'||p.data.acao==='CONFIGURAR'&&p.data.persistir===true;
  if((persistir||p.data.acao==='ESQUECER_CHAVE_SALVA')&&!opcoes.cofre)return {status:503,body:{codigo:'COFRE_WINDOWS_INDISPONIVEL'}};
  const invalidarMedico=()=>{const tokens=new Set([...chaves.keys(),...ativos.keys(),...tickets.values()].map(t=>typeof t==='string'?t:t.token));
   for(const t of tokens)if(sessoes.obter(t)?.medicoId===sessao.medicoId){cancelar(t);chaves.delete(t);}};
  let salva:string|null=null,cofreIndisponivel=false;
  const lerSalva=()=>{try{return opcoes.cofre?.ler(sessao.medicoId)??null;}catch{cofreIndisponivel=true;return null;}};
  try{
   if(p.data.acao==='CONFIGURAR'){
    if(persistir){opcoes.cofre!.salvar(sessao.medicoId,p.data.chave);invalidarMedico();}
    else{cancelar(token);chaves.set(token,p.data.chave);}
   }
   if(p.data.acao==='SALVAR_CHAVE_ATUAL'){const atual=chaves.get(token)||lerSalva()||opcoes.chave;
    if(!atual)return {status:409,body:{codigo:'DEEPGRAM_CHAVE_AUSENTE'}};opcoes.cofre!.salvar(sessao.medicoId,atual);invalidarMedico();}
   if(p.data.acao==='ESQUECER_CHAVE_SALVA'){opcoes.cofre!.remover(sessao.medicoId);invalidarMedico();}
  }catch{return {status:503,body:{codigo:'COFRE_OPERACAO_FALHOU'}};}
  cofreIndisponivel=false;salva=lerSalva();
  // Falha de gravação/leitura posterior nunca é anunciada como salvamento concluído.
  if(persistir&&cofreIndisponivel)return {status:503,body:{codigo:'COFRE_OPERACAO_FALHOU'}};
  if(p.data.acao==='REMOVER_CHAVE'){cancelar(token);chaves.delete(token);}
  const chave=chaves.get(token)||salva||opcoes.chave;
  if(p.data.acao!=='INICIAR')return {status:200,body:{codigo:'DITADO_CONFIGURACAO',configurada:!!chave,salva:!!salva,
   origem:chaves.has(token)?'SESSAO':salva?'COFRE':opcoes.chave?'AMBIENTE':'AUSENTE',persistenciaDisponivel:!!opcoes.cofre,cofreIndisponivel,provedor:'DEEPGRAM',modelo:'nova-3',idioma:'pt-BR'}};
  if(!chave)return {status:409,body:{codigo:'DEEPGRAM_CHAVE_AUSENTE'}};
  const t:Ticket={token,contexto:p.data.contexto,expira:agora()+15_000,chave};
  if(!valido(t))return {status:409,body:{codigo:'CONTEXTO_CONSULTA_ALTERADO'}};
  if(ativos.has(token))return {status:409,body:{codigo:'DITADO_JA_EM_CURSO'}};
  cancelar(token);const ticket=randomBytes(32).toString('hex');tickets.set(ticket,t);
  return {status:200,body:{codigo:'DITADO_TICKET',ticket,caminho:'/consulta/ditado/stream',expiraEm:t.expira}};
 }
 function anexar(server:Server){
  server.on('upgrade',(req,socket,head)=>{
   limpar();const ticket=req.headers['sec-websocket-protocol'],t=typeof ticket==='string'?tickets.get(ticket):undefined;
   let origemOk=!req.headers.origin;
   try{if(req.headers.origin){const u=new URL(req.headers.origin);origemOk=['http:','https:'].includes(u.protocol)&&u.host===req.headers.host;}}catch{origemOk=false;}
   if(encerrado||req.url!=='/consulta/ditado/stream'||!t||!origemOk||!valido(t)||ativos.has(t.token)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
   tickets.delete(ticket as string);
   wss.handleUpgrade(req,socket,head,ws=>iniciar(ws,t));
  });
 }
 function iniciar(ws:WebSocket,t:Ticket){
  const abort=new AbortController();let canal:CanalVoz|undefined,pronto=false,terminando=false,fechado=false,bytes=0,letras=0,ultimoKeep=agora(),inicioAudio:number|null=null;
  const vistos=new Set<string>();let finalTimer:ReturnType<typeof setTimeout>|undefined;
  function enviar(e:EventoDitado){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(e));}
  function fechar(codigo?:string){if(fechado)return;fechado=true;clearInterval(vigia);clearTimeout(conexaoTimer);clearTimeout(finalTimer);abort.abort();canal?.fechar();ativos.delete(t.token);if(codigo)enviar({tipo:'ERRO',codigo});ws.close();const timer=setTimeout(()=>ws.terminate(),1000);timer.unref();}
  function guard(){if(inicioAudio !== null && !terminando && g23ComandoDeepgram((agora()-inicioAudio)/1000 || 0.001,15).decisao !== 'PASSA'){fechar('G23_COMANDO_CURTO_EXCEDIDO');return false;}if(!valido(t)){fechar('CONTEXTO_CONSULTA_ALTERADO');return false;}return !fechado;}
  const conexaoTimer=setTimeout(()=>fechar('DEEPGRAM_CONEXAO_EXPIRADA'),12_000);
  const inicio=agora();
  const vigia=setInterval(()=>{if(!guard())return;if(agora()-inicio>600_000){fechar('DITADO_LIMITE_DE_TEMPO');return;}
   if(pronto&&!terminando&&agora()-ultimoKeep>=4000){try{canal?.manter();ultimoKeep=agora();}catch{fechar('DEEPGRAM_CONEXAO_INTERROMPIDA');}}},250);
  ativos.set(t.token,()=>fechar('DITADO_CANCELADO'));
  ws.on('error',()=>fechar('DITADO_CONEXAO_INTERROMPIDA'));ws.on('close',()=>fechar());
  ws.on('message',(data,binary)=>{
   if(!guard())return;
   try{
    if(binary){const audio=Buffer.isBuffer(data)?data:Buffer.from(data as ArrayBuffer);bytes+=audio.byteLength;
     if(!pronto||terminando||!canal){fechar('DITADO_AUDIO_FORA_DE_ORDEM');return;}
     if(bytes>32*1024*1024||canal.pendentes()>512*1024){fechar('DITADO_LIMITE_DE_AUDIO');return;}canal.enviar(audio);
    }else if(data.toString()==='PARAR'&&pronto&&!terminando){terminando=true;finalTimer=setTimeout(()=>fechar('DEEPGRAM_FINALIZACAO_INCOMPLETA'),10_000);canal?.finalizar();}
    else fechar('DITADO_MENSAGEM_INVALIDA');
   }catch{fechar('DEEPGRAM_CONEXAO_INTERROMPIDA');}
  });
  void conectar(t.chave,abort.signal,{
   pronto:()=>{if(guard()){pronto=true;inicioAudio=agora();clearTimeout(conexaoTimer);enviar({tipo:'PRONTO'});}},
   erro:()=>fechar('DEEPGRAM_FALHA_DE_CONEXAO'),
   fechado:()=>{if(!guard())return;if(terminando){enviar({tipo:'CONCLUIDO'});fechar();}else fechar('DEEPGRAM_CONEXAO_INTERROMPIDA');},
   mensagem:m=>{if(!guard())return;const p=Resultado.safeParse(m);if(!p.success){if(m&&typeof m==='object'&&'type' in m&&m.type==='Error')fechar('DEEPGRAM_ERRO');return;}
    const r=p.data,a=r.channel.alternatives[0];if(!a?.transcript)return;const id=`${r.start}:${r.duration}`;
    if(r.is_final){if(vistos.has(id))return;vistos.add(id);letras+=a.transcript.length;if(letras>200_000){fechar('DITADO_LIMITE_DE_TEXTO');return;}}
    enviar({tipo:'TRECHO',id,texto:a.transcript,final:r.is_final,confianca:a.confidence??null});
   },
  }).then(c=>{canal=c;if(fechado)c.fechar();}).catch(()=>fechar('DEEPGRAM_FALHA_DE_CONEXAO'));
 }
 function fechar(){encerrado=true;clearInterval(varrer);for(const fim of [...ativos.values()])fim();for(const c of wss.clients)c.terminate();wss.close();tickets.clear();chaves.clear();}
 return {rotear,anexar,fechar,cancelar};
}
