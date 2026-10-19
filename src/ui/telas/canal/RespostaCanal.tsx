import {useEffect,useRef,useState} from 'react';
import type {ChavesIntencao} from '../../api/chaves.js';
import {ErroPorta,type PortaConsulta} from '../../api/porta.js';
import type {RascunhoRespostaCanal} from '../../../contracts/f2/caixaRespostaCanal.js';
type Contexto={patientId:string;encounterId:string;tumorLotId:string|null};

/** Conteúdo preparado no servidor é exibido antes da confirmação e do envio explícitos. */
export function RespostaCanal({porta,chaves,mensagemId,patientId,redFlag,destinatario,encounterId=null,origemCanal='WHATSAPP_SERVICO',contextos=[],
 exigirCheckboxConfirmacao:_compatibilidade=false,aoEnviar}:{porta:PortaConsulta;chaves:ChavesIntencao;mensagemId:string;patientId:string|null;redFlag:boolean;
 destinatario?:string;encounterId?:string|null;origemCanal?:'WHATSAPP_SERVICO'|'WHATSAPP_PESSOAL'|'EMAIL'|'TELEFONE';contextos?:readonly Contexto[];exigirCheckboxConfirmacao?:boolean;aoEnviar?:()=>void}){
 const [texto,setTexto]=useState(''),[contexto,setContexto]=useState<Contexto|null>(null);
 const [previa,setPrevia]=useState<RascunhoRespostaCanal|null>(null),[confirmado,setConfirmado]=useState(false),[ocupado,setOcupado]=useState(false),[aviso,setAviso]=useState('');
 const identidade=JSON.stringify([mensagemId,patientId,destinatario,encounterId,origemCanal]);
 const seq=useRef(0),emVoo=useRef(false),respostaId=useRef(`resposta-${crypto.randomUUID()}`),versao=useRef(0);
 const identidadeAnterior=useRef(identidade);
 useEffect(()=>{if(identidadeAnterior.current!==identidade){identidadeAnterior.current=identidade;seq.current++;setTexto('');setPrevia(null);setConfirmado(false);setContexto(null);setAviso('');respostaId.current=`resposta-${crypto.randomUUID()}`;versao.current=0;}return()=>{seq.current++;};},[identidade]);
 function invalidar(){seq.current++;setPrevia(null);setConfirmado(false);setAviso('');}
 async function preparar(){
  if(emVoo.current||!texto.trim()||!contexto||contexto.patientId!==patientId)return;
  if(!porta.prepararRespostaCanal){setAviso('Preparação de resposta indisponível neste servidor.');return;}
  const numero=++seq.current;emVoo.current=true;setOcupado(true);setPrevia(null);setConfirmado(false);setAviso('');
  try{const p=await porta.prepararRespostaCanal({...contexto,respostaId:respostaId.current,versao:++versao.current,mensagemOrigemId:mensagemId,texto:texto.trim()});
   if(numero!==seq.current)return;
   if(p.respostaId!==respostaId.current||p.versao!==versao.current||p.mensagemOrigemId!==mensagemId||p.canal!==origemCanal||p.contexto.patientId!==patientId||p.contexto.encounterId!==contexto.encounterId||p.contexto.tumorLotId!==contexto.tumorLotId||p.texto!==texto.trim())throw new ErroPorta('PREVIA_FORA_DO_CONTEXTO');
   setPrevia(p);
  }catch(e){if(numero===seq.current)setAviso(e instanceof ErroPorta?`Resposta não preparada (${e.codigo}).`:'Não foi possível preparar a resposta.');}
  finally{emVoo.current=false;setOcupado(false);}
 }
 async function enviar(){
  if(emVoo.current||!previa||!confirmado||!porta.confirmarRespostaCanal)return;
  const numero=seq.current,p=previa;emVoo.current=true;setOcupado(true);setAviso('');
  try{
   const autorizada=await porta.confirmarRespostaCanal({respostaId:p.respostaId,versao:p.versao,comprovanteExibicao:{destinatario:p.destinatario,conteudoSha256:p.conteudoSha256,contexto:p.contexto}});
   if(numero!==seq.current)return;
   if(autorizada.respostaId!==p.respostaId||autorizada.versao!==p.versao)throw new ErroPorta('CONFIRMACAO_FORA_DO_CONTEXTO');
   const r=await porta.acao({verbo:p.canal==='EMAIL'?'ENVIAR_EMAIL':'ENVIAR_WHATSAPP',objeto:{tipo:'MENSAGEM_CANAL',id:p.respostaId,versao:p.versao},escopo:{patientId:p.contexto.patientId,encounterId:p.contexto.encounterId},destino:p.destinatario,
    idempotencyKey:chaves.novaChaveIntencao(`enviar:${p.respostaId}:${p.versao}`)});
   if(numero===seq.current)setAviso(r.decisao==='EXECUTADA'||r.decisao==='REPLAY'?'Resposta enviada; recibo registrado.':r.decisao==='OUTCOME_UNKNOWN'?'Resultado do envio incerto. Confira o recibo; não reenvie às cegas.':'Envio não realizado. Confira a configuração e a autorização.');
   if(numero===seq.current&&(r.decisao==='EXECUTADA'||r.decisao==='REPLAY'))aoEnviar?.();
  }catch(e){if(numero===seq.current)setAviso(e instanceof ErroPorta?`Envio não realizado (${e.codigo}).`:'Não foi possível confirmar o envio. Confira o recibo antes de tentar novamente.');}
  finally{emVoo.current=false;setOcupado(false);}
 }
 return <form aria-label={redFlag?'Resposta sem modelo aprovado':'Resposta do canal'} onSubmit={e=>{e.preventDefault();void preparar();}}>
  <small>Contato: {destinatario??'pendente'} · Paciente: {patientId??'não vinculado'}</small>
  {redFlag?<p>sem modelo aprovado</p>:null}
  <label>Encontro para a resposta<select aria-label="Encontro para a resposta" disabled={ocupado} value={contexto?JSON.stringify(contexto):''} onChange={e=>{invalidar();setContexto(e.target.value?JSON.parse(e.target.value) as Contexto:null);}}>
   <option value="">Selecione o encontro</option>{contextos.filter(c=>c.patientId===patientId).map(c=><option key={JSON.stringify(c)} value={JSON.stringify(c)}>{c.encounterId}{c.tumorLotId?` · ${c.tumorLotId}`:''}</option>)}
  </select></label>
  {!contextos.length?<p>Abra uma consulta válida antes de responder a esta mensagem.</p>:null}
  <label>Resposta<textarea aria-label="Texto da resposta" value={texto} disabled={ocupado} maxLength={10_000} onChange={e=>{invalidar();setTexto(e.target.value);}}/></label>
  <button type="submit" disabled={ocupado||!contexto||!texto.trim()}>Revisar resposta</button>
  {previa?<section aria-label="Resposta preparada para confirmação"><p>Canal: {previa.canal} · Destinatário: {previa.destinatario} · Paciente: {previa.contexto.patientId} · Encontro: {previa.contexto.encounterId} · Versão: {previa.versao}</p>
   <p>{previa.texto}</p><label><input type="checkbox" aria-label="Confirmo destinatário, conteúdo e contexto da resposta" checked={confirmado} disabled={ocupado} onChange={e=>setConfirmado(e.target.checked)}/>Confirmo destinatário, conteúdo e contexto</label>
   <button type="button" disabled={ocupado||!confirmado} onClick={()=>void enviar()}>Confirmar e enviar resposta</button></section>:null}
  {aviso?<p role="status">{aviso}</p>:null}
 </form>;
}
