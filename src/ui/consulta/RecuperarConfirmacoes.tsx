import {useEffect,useRef,useState} from 'react';
import type {PortaConsulta,PedidoBundle} from '../api/porta.js';
import {ErroPorta} from '../api/porta.js';
import {pendente} from '../api/confirmacoesPendentes.js';
import type {ConfirmacaoPendente,RecuperacaoConfirmacao} from '../../contracts/api/recuperacaoConfirmacao.js';
/** A consulta de resultado nunca assina: uma intenção ainda não gravada exige nova exibição e clique. */
export function RecuperarConfirmacoes({porta,contexto,aoAtualizar}:{porta:PortaConsulta;contexto:PedidoBundle;aoAtualizar:()=>void}) {
 const [versao,setVersao]=useState(0),[mensagem,setMensagem]=useState(''),[ocupado,setOcupado]=useState(false);
 const [previa,setPrevia]=useState<{pendente:ConfirmacaoPendente;resposta:Extract<RecuperacaoConfirmacao,{estado:'PREVIA'}>}|null>(null);
 const geracao=useRef(0),emCurso=useRef(false);
 const ctx={...contexto,tumorLotId:contexto.tumorLotId??null};
 useEffect(()=>{const mudar=()=>setVersao(v=>v+1);window.addEventListener('confirmacoes-pendentes',mudar);
  return()=>window.removeEventListener('confirmacoes-pendentes',mudar);},[]);
 useEffect(()=>{geracao.current++;setPrevia(null);setMensagem('');setOcupado(false);emCurso.current=false;return()=>{geracao.current++;};},[porta,ctx.patientId,ctx.encounterId,ctx.tumorLotId]);
 let erroLocal='';let itens:ConfirmacaoPendente[]=[];
 try{itens=(['PRESCRICAO','APAC'] as const).flatMap(tipo=>{const p=pendente(tipo,ctx);return p?[p]:[];});}catch{erroLocal='Não foi possível acessar as confirmações pendentes desta aba.';}
 void versao;
 const previaAtual=previa&&previa.pendente.pedido.contexto.patientId===ctx.patientId
  &&previa.pendente.pedido.contexto.encounterId===ctx.encounterId&&previa.pendente.pedido.contexto.tumorLotId===ctx.tumorLotId?previa:null;
 async function recuperar(p:ConfirmacaoPendente,confirmar=false,cancelar=false){
  if(emCurso.current)return;const atual=geracao.current;emCurso.current=true;setOcupado(true);setMensagem('');
  try{
   if(confirmar){
    if(p.tipo==='PRESCRICAO')await porta.confirmarPrescricaoExecutavel!(p.pedido);else await porta.confirmarApacRascunho!(p.pedido);
    if(atual!==geracao.current)return;setPrevia(null);setMensagem('Confirmação reconciliada com o servidor.');aoAtualizar();
   }else{
    const r=await porta.recuperarConfirmacao!({...p,...(cancelar?{cancelar:true as const}:{})});if(atual!==geracao.current)return;
    if(r.estado==='CONFIRMADA'){setPrevia(null);setMensagem('O servidor já havia confirmado. Nenhum registro foi duplicado.');aoAtualizar();}
    else if(r.estado==='CANCELADA'){setPrevia(null);setMensagem('Intenção não confirmada cancelada no servidor. Uma tentativa tardia também será recusada.');aoAtualizar();}
    else setPrevia({pendente:p,resposta:r});
   }
  }catch(e){if(atual===geracao.current)setMensagem(e instanceof ErroPorta?e.codigo:'Resultado ainda desconhecido. Consulte novamente antes de criar outra intenção.');}
  finally{if(atual===geracao.current){emCurso.current=false;setOcupado(false);}}
 }
 if(!porta.recuperarConfirmacao||!itens.length&&!mensagem&&!erroLocal)return null;
 return <section aria-label="Recuperação de confirmações"><h3>Confirmação pendente de resposta</h3>
  <p>Confira o resultado no servidor antes de preparar outra prescrição ou APAC. A mesma chave foi preservada nesta aba após recarregar.</p>
  {itens.map(p=><div key={p.tipo}><button type="button" disabled={ocupado} onClick={()=>void recuperar(p)}>Conferir resultado · {p.tipo}</button> <button type="button" disabled={ocupado} onClick={()=>void recuperar(p,false,true)}>Cancelar somente se ainda não confirmada · {p.tipo}</button></div>)}
  {previaAtual&&<div><p>O servidor ainda não confirmou esta intenção. Revise novamente o conteúdo integral:</p><pre style={{whiteSpace:'pre-wrap'}}>{previaAtual.resposta.texto}</pre>
   {previaAtual.resposta.avisos.map((a,i)=><p key={i}>{a}</p>)}
   <button type="button" disabled={ocupado} onClick={()=>void recuperar(previaAtual.pendente,true)}>Revisei esta prévia · confirmar a mesma intenção</button></div>}
  {(mensagem||erroLocal)&&<p role="status">{mensagem||erroLocal}</p>}
 </section>;
}
