import { useEffect,useRef,useState } from "react";
import type { ChatSetorVisao,PortaConsulta,SetorChat } from "../api/porta.js";

type Contexto={patientId:string;encounterId:string;tumorLotId:string|null};
/** Aceite textual explícito; nunca envia campos clínicos ou comandos de prescrição. */
export function ChatAnotacao({porta,contexto,bloqueado,aoRegistrar}:{porta:PortaConsulta;contexto:Contexto;bloqueado:boolean;aoRegistrar:()=>Promise<void>}){
 const [setor,setSetor]=useState<SetorChat>('MEDICO'),[chat,setChat]=useState<ChatSetorVisao|null>(null);
 const [mensagem,setMensagem]=useState<string|null>(null),[texto,setTexto]=useState(''),[ocupado,setOcupado]=useState(false),[aviso,setAviso]=useState('');
 const geracao=useRef(0),trava=useRef(false),tentativa=useRef<{conteudo:string;id:string}|null>(null);
 useEffect(()=>{const g=++geracao.current;setChat(null);setMensagem(null);setTexto('');setAviso('');setOcupado(true);
  void porta.chatSetor(setor).then(r=>{if(g!==geracao.current)return;
   if(r.patientId!==contexto.patientId||r.encounterId!==contexto.encounterId||(r.tumorLotId??null)!==contexto.tumorLotId)throw Error('CONTEXTO_DIVERGENTE');
   setChat(r);
  }).catch(()=>{if(g===geracao.current)setAviso('Não foi possível carregar as mensagens deste atendimento.');})
   .finally(()=>{if(g===geracao.current)setOcupado(false);});
  return()=>{geracao.current++;};
 },[porta,setor,contexto.patientId,contexto.encounterId,contexto.tumorLotId]);
 async function registrar(){
  if(trava.current||ocupado||bloqueado||!mensagem||!texto.trim()||!porta.aceitarDecisaoChat)return;
  const conteudo=JSON.stringify({contexto,mensagem,texto});
  if(tentativa.current?.conteudo!==conteudo)tentativa.current={conteudo,id:crypto.randomUUID()};
  const g=geracao.current;trava.current=true;setOcupado(true);setAviso('');
  try{await porta.aceitarDecisaoChat({contexto:{...contexto,operationId:tentativa.current.id},mensagemId:mensagem,decisao:{campo:'observacao',valor:texto}});
   if(g!==geracao.current)return;
   setMensagem(null);setTexto('');setAviso('Anotação registrada na evolução. Prepare uma nova versão para incluí-la no documento.');
   await aoRegistrar();
  }catch{if(g===geracao.current)setAviso('Registro não confirmado. Seu texto foi preservado; tente novamente com a mesma anotação.');}
  finally{trava.current=false;if(g===geracao.current)setOcupado(false);}
 }
 return <section aria-label="Aceite do chat para evolução" className="atendimento-v6__documento atendimento-v6__chat" aria-busy={ocupado}>
  <header><h3>Chat do atendimento</h3>
  <label>Setor do chat <select value={setor} disabled={ocupado||bloqueado} onChange={e=>setSetor(e.target.value as SetorChat)}>
   <option value="MEDICO">Médico</option><option value="FARMACIA">Farmácia</option><option value="TRIAGEM">Triagem</option><option value="SECRETARIA">Secretaria</option>
  </select></label></header><p className="atendimento-v6__chat-ajuda">Revise e registre somente na evolução.</p>
  {chat?.mensagens.length===0?<p>Nenhuma mensagem neste setor e atendimento.</p>:null}
  {chat?.mensagens.map(m=><article className="atendimento-v6__chat-mensagem" key={m.mensagemId}><p><strong>{m.autor}</strong><br/>{m.texto}</p>
   {mensagem!==m.mensagemId?<button type="button" disabled={ocupado||bloqueado||mensagem!==null} onClick={()=>{setMensagem(m.mensagemId);setTexto(m.texto);setAviso('');}}>Revisar para evolução</button>:null}</article>)}
  {mensagem?<><div className="atendimento-v6__entrada atendimento-v6__chat-editor"><label>Anotação para evolução<textarea value={texto} rows={2} maxLength={12000} disabled={ocupado||bloqueado} onChange={e=>setTexto(e.target.value)}/></label></div><div className="atendimento-v6__acoes">
   <button type="button" className="atendimento-v6__principal" disabled={ocupado||bloqueado||!texto.trim()} onClick={()=>void registrar()}>Registrar na evolução</button>
   <button type="button" disabled={ocupado||bloqueado} onClick={()=>{setMensagem(null);setTexto('');}}>Cancelar</button></div></>:null}
  <p role="status">{aviso}</p>
 </section>;
}
