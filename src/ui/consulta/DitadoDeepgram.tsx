import {useEffect,useRef,useState} from 'react';
import {EventoDitado} from '../../contracts/fase2/ditado.js';
import {ErroPorta,type PortaConsulta,type PedidoBundle} from '../api/porta.js';
import {abrirCanalDitado,type CanalDitado} from '../api/ditado.js';

export function DitadoDeepgram({porta,contexto,desabilitado,aoTrecho,aoAtividade}:{porta:PortaConsulta;contexto:PedidoBundle;desabilitado:boolean;aoTrecho:(t:string)=>void;aoAtividade:(v:boolean)=>void}){
 const [configurada,setConfigurada]=useState(false),[chave,setChave]=useState(''),[mensagem,setMensagem]=useState(''),[parcial,setParcial]=useState('');
 const [estado,setEstado]=useState<'PARADO'|'CONECTANDO'|'DITANDO'|'FINALIZANDO'>('PARADO'),[configurando,setConfigurando]=useState(false);
 const geracao=useRef(0),limpar=useRef<()=>void>(()=>{}),parar=useRef<()=>void>(()=>{});
 const callbacks=useRef({aoTrecho,aoAtividade});callbacks.current={aoTrecho,aoAtividade};
 useEffect(()=>{const atual=++geracao.current,abort=new AbortController();
  void porta.ditado?.({acao:'STATUS'},abort.signal).then(r=>{if(atual===geracao.current&&r.codigo==='DITADO_CONFIGURACAO')setConfigurada(r.configurada);}).catch(()=>{});
  return()=>{geracao.current++;abort.abort();limpar.current();};
 },[porta]);
 async function configurar(remover=false){if(!porta.ditado)return;const atual=geracao.current;setConfigurando(true);setMensagem('');
  try{const r=await porta.ditado(remover?{acao:'REMOVER_CHAVE'}:{acao:'CONFIGURAR',chave});if(atual!==geracao.current)return;
   if(r.codigo==='DITADO_CONFIGURACAO'){setConfigurada(r.configurada);setChave('');setMensagem(remover?'Chave da sessão removida.':'Chave recebida pelo servidor. A conexão será verificada ao iniciar o ditado.');}
  }catch{if(atual===geracao.current)setMensagem('Não foi possível configurar a chave.');}
  finally{if(atual===geracao.current)setConfigurando(false);}
 }
 async function iniciar(){
  if(!porta.ditado||estado!=='PARADO'||desabilitado)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setMensagem('Este navegador não oferece captura de áudio. Use um navegador atualizado ou cole a transcrição.');return;}
  const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime){setMensagem('Formato de áudio indisponível neste navegador.');return;}
  const atual=++geracao.current,abort=new AbortController();let stream:MediaStream|undefined,ws:CanalDitado|undefined,recorder:MediaRecorder|undefined,concluido=false,finalizando=false;
  let prazo:ReturnType<typeof setTimeout>|undefined;const vistos=new Set<string>();
  const vigente=()=>geracao.current===atual;
  const recursos=()=>{clearTimeout(prazo);abort.abort();if(recorder&&recorder.state!=='inactive'){recorder.ondataavailable=null;recorder.onstop=null;recorder.stop();}stream?.getTracks().forEach(t=>t.stop());ws?.fechar();};
  const fim=(texto:string)=>{if(!vigente())return;geracao.current++;recursos();setEstado('PARADO');setParcial('');setMensagem(texto);callbacks.current.aoAtividade(false);};
  limpar.current=recursos;setEstado('CONECTANDO');setMensagem('');setParcial('');callbacks.current.aoAtividade(true);
  parar.current=()=>fim('Ditado cancelado. Os trechos já recebidos permanecem para revisão.');
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1},video:false});
   if(!vigente()){recursos();return;}
   const r=await porta.ditado({acao:'INICIAR',contexto:{patientId:contexto.patientId,encounterId:contexto.encounterId,tumorLotId:contexto.tumorLotId??null},autorizaEnvioAudio:true},abort.signal);
   if(!vigente()){recursos();return;}if(r.codigo!=='DITADO_TICKET')throw Error('DITADO_TICKET_INVALIDO');
   prazo=setTimeout(()=>fim('A conexão expirou. Verifique a chave Deepgram e tente novamente.'),15_000);
   ws=abrirCanalDitado(r.ticket,{
   erro:()=>fim('Falha na conexão de ditado. Os trechos recebidos permanecem disponíveis.'),
   fechado:()=>{if(vigente())fim(concluido?'Ditado concluído. Confira nomes, números e negações.':'Conexão interrompida; o final do ditado pode estar incompleto. Confira o texto.');},
   mensagem:mensagem=>{
    if(!vigente())return;let bruto:unknown;try{bruto=JSON.parse(mensagem);}catch{fim('Resposta de ditado inválida.');return;}
    const p=EventoDitado.safeParse(bruto);if(!p.success){fim('Resposta de ditado inválida.');return;}const evento=p.data;
    if(evento.tipo==='ERRO'){fim(`Ditado interrompido (${evento.codigo}). Confira o texto já recebido.`);return;}
    if(evento.tipo==='CONCLUIDO'){concluido=true;fim('Ditado concluído. Confira nomes, números e negações.');return;}
    if(evento.tipo==='TRECHO'){
     if(evento.final){if(!vistos.has(evento.id)){vistos.add(evento.id);callbacks.current.aoTrecho(evento.texto);}setParcial('');}
     else setParcial(evento.texto);return;
    }
    if(recorder)return;clearTimeout(prazo);
    try{
     recorder=new MediaRecorder(stream!,{mimeType:mime,audioBitsPerSecond:64_000});
     recorder.ondataavailable=e=>{if(!vigente()||!e.data.size)return;if(!ws?.aberto()||ws.pendentes()>512*1024){fim('Conexão lenta ou interrompida. Confira o final da transcrição.');return;}ws.enviar(e.data);};
     recorder.onerror=()=>fim('Falha no microfone. Confira o texto recebido.');
     recorder.onstop=()=>{stream?.getTracks().forEach(t=>t.stop());if(vigente()&&finalizando&&ws?.aberto()){ws.enviar('PARAR');prazo=setTimeout(()=>fim('Finalização incompleta. Confira o final da transcrição.'),12_000);}};
     recorder.start(250);setEstado('DITANDO');
     parar.current=()=>{if(finalizando)return;finalizando=true;setEstado('FINALIZANDO');recorder?.stop();};
    }catch{fim('Não foi possível iniciar o gravador de áudio.');}
   }});
  }catch(error){if(vigente())fim(error instanceof ErroPorta?`Ditado indisponível (${error.codigo}).`:'Microfone ou conexão indisponível. Verifique a permissão do navegador.');}
 }
 const ativo=estado!=='PARADO';
 return <div aria-label="Ditado Deepgram">
  <p>Deepgram · português brasileiro. Ao iniciar, o áudio será enviado à Deepgram. O texto permanece como rascunho para revisão.</p>
  <details><summary>Configurar chave Deepgram · {configurada?'configurada':'pendente'}</summary>
   <p>A chave inserida aqui fica na memória do servidor durante a sessão. Também é possível configurar DEEPGRAM_API_KEY no ambiente do servidor.</p>
   <label>Chave Deepgram <input type="password" autoComplete="off" value={chave} disabled={ativo||configurando} onChange={e=>setChave(e.target.value)}/></label>
   <button type="button" disabled={ativo||configurando||!chave.trim()||!porta.ditado} onClick={()=>void configurar()}>Usar chave nesta sessão</button>
   <button type="button" disabled={ativo||configurando||!porta.ditado} onClick={()=>void configurar(true)}>Remover chave desta sessão</button>
  </details>
  <button type="button" disabled={desabilitado||configurando||(!ativo&&(!configurada||!porta.ditado))||estado==='FINALIZANDO'} onClick={()=>ativo?parar.current():void iniciar()}>
   {estado==='CONECTANDO'?'Cancelar conexão':estado==='DITANDO'?'Parar ditado':estado==='FINALIZANDO'?'Finalizando ditado…':'Iniciar ditado Deepgram'}
  </button>
  {parcial?<p aria-label="Transcrição parcial">{parcial}</p>:null}
  {mensagem?<p role="status">{mensagem}</p>:null}
 </div>;
}
