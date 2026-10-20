import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ServidorDeps} from './rotas.js';
import {cadastrosCanal} from './canalOperacao.js';
import {receberEnvelopeWebhookCanal,verificarDesafioWebhookWhatsApp,LIMITE_BYTES_CORPO_WEBHOOK} from './canalEntrada.js';

function bytesCrus(req:IncomingMessage):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const chunks:Buffer[]=[];let tamanho=0,terminou=false;
  req.on('data',(chunk:Buffer)=>{if(terminou)return;tamanho+=chunk.length;if(tamanho>LIMITE_BYTES_CORPO_WEBHOOK){terminou=true;reject(new Error('CORPO_EXCESSIVO'));return;}chunks.push(chunk);});
  req.once('end',()=>{if(!terminou){terminou=true;resolve(Buffer.concat(chunks));}});
  req.once('error',()=>{if(!terminou){terminou=true;reject(new Error('CORPO_INVALIDO'));}});
  req.once('aborted',()=>{if(!terminou){terminou=true;reject(new Error('CORPO_INVALIDO'));}});
 });
}
/** GET challenge não recebe mensagens. POST usa HMAC, nunca o login médico, antes do parser JSON. */
export async function rotearWebhookCanal(deps:ServidorDeps,req:IncomingMessage,res:ServerResponse):Promise<boolean>{
 const url=new URL(req.url??'/','http://127.0.0.1');if(!url.pathname.startsWith('/canal/webhook/'))return false;
 const reply=(status:number,codigo:string)=>{deps.log({rota:'webhookCanal',status,codigo});res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({codigo}));};
 const contas=deps.canal?.contasWebhook??[];
 if(!contas.length){reply(503,'CANAL_NAO_CONFIGURADO');return true;}
 const keyId=url.pathname.slice('/canal/webhook/'.length),candidatas=contas.filter(c=>c.keyId===keyId);
 if(candidatas.length!==1){reply(404,'CONTA_NAO_CONFIGURADA');return true;}
 const conta=candidatas[0]!;
 if(req.method==='GET'){
  const query:Record<string,string|string[]>={};for(const chave of url.searchParams.keys()){const v=url.searchParams.getAll(chave);query[chave]=v.length===1?v[0]!:v;}
  const r=verificarDesafioWebhookWhatsApp(query,conta.verifyToken);
  if(!r.ok)reply(403,r.codigo);else{res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end(r.challenge);}return true;
 }
 if(req.method!=='POST'){reply(405,'METODO_NAO_PERMITIDO');return true;}
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')){reply(415,'CONTENT_TYPE_INVALIDO');return true;}
 try{
  const bytes=await bytesCrus(req);
  const assinaturas=req.rawHeaders.flatMap((h,i)=>i%2===0&&h.toLowerCase()==='x-hub-signature-256'?[req.rawHeaders[i+1]!]:[]);
  const r=receberEnvelopeWebhookCanal(deps.db,{bytes,assinatura:assinaturas.length===1?assinaturas[0]:assinaturas,keyId,verificadoEm:deps.agora()},
    {contasConfiguradas:contas,cadastros:cadastrosCanal(deps.db),quarentenarConflito:true,autorizarAckConflitoQuarentenado:false});
  if(r.ok&&r.ackAutorizado)reply(200,'INGRESSO_PERSISTIDO');
  else if(!r.ok){const codigo=r.codigo;reply(codigo==='ARMAZENAMENTO_INDISPONIVEL'?503:codigo==='CONFLITO_ENVELOPE'?409:codigo.startsWith('ASSINATURA')?401:400,codigo);}
  else reply(503,'ACK_NAO_AUTORIZADO');
 }catch(e){reply(e instanceof Error&&e.message==='CORPO_EXCESSIVO'?413:503,e instanceof Error&&e.message==='CORPO_EXCESSIVO'?'TAMANHO_EXCEDIDO':'ARMAZENAMENTO_INDISPONIVEL');}
 return true;
}
