import {useEffect,useRef,useState} from 'react';
import {ErroPorta,type PortaConsulta,type PedidoBundle} from '../api/porta.js';
/** Declaração manual da lista inteira. Checkbox nunca vem marcado por inferência. */
export function ReconciliarMedicamentos({porta,contexto,aoFatosConfirmados}:{porta:PortaConsulta;contexto:PedidoBundle;aoFatosConfirmados?:(ctx:PedidoBundle)=>void}){
 const [texto,setTexto]=useState(''),[completa,setCompleta]=useState(false),[ocupado,setOcupado]=useState(false),[mensagem,setMensagem]=useState('');
 const geracao=useRef(0),controller=useRef<AbortController|null>(null),operacao=useRef<string|null>(null),emCurso=useRef(false);
 const {patientId,encounterId,tumorLotId}=contexto;
 useEffect(()=>{geracao.current++;setTexto('');setCompleta(false);setMensagem('');setOcupado(false);operacao.current=null;emCurso.current=false;
  return()=>{geracao.current++;controller.current?.abort();};},[patientId,encounterId,tumorLotId,porta]);
 const alterar=()=>{operacao.current=null;setMensagem('');};
 async function confirmar(){if(!completa||!porta.reconciliarMedicamentos||emCurso.current)return;
  const atual=geracao.current;emCurso.current=true;setOcupado(true);setMensagem('');const abort=new AbortController();controller.current=abort;
  operacao.current??=`med-${crypto.randomUUID()}`;
  try{const r=await porta.reconciliarMedicamentos({patientId,encounterId,tumorLotId:tumorLotId??null,operationId:operacao.current,medicamentos:texto.split('\n').map(s=>s.trim()).filter(Boolean),listaAtualCompleta:true},abort.signal);
   if(atual!==geracao.current)return;
   if(r.codigo!=='GRAVADA'&&r.codigo!=='REPLAY')throw new ErroPorta('RECONCILIACAO_MEDICAMENTOS_NEGADA');
   setMensagem('Lista atual completa confirmada.');setCompleta(false);aoFatosConfirmados?.({...contexto});
  }catch(e){if(atual===geracao.current)setMensagem(e instanceof ErroPorta?`${e.codigo}${e.detalhe?` · Referências: ${e.detalhe}`:''}`:'Não foi possível confirmar a lista.');}
  finally{if(atual===geracao.current){emCurso.current=false;setOcupado(false);}}
 }
 return <section aria-label="Reconciliação de medicamentos"><h3>Medicamentos atuais</h3><p>Digite um nome por linha. Lista vazia confirmada significa nenhum medicamento informado pelo médico.</p>
  <label>Lista de medicamentos<textarea aria-label="Lista de medicamentos" value={texto} disabled={ocupado} onChange={e=>{setTexto(e.target.value);alterar();}}/></label>
  <label><input type="checkbox" checked={completa} disabled={ocupado} onChange={e=>{setCompleta(e.target.checked);alterar();}}/>Lista atual completa, inclusive se vazia</label>
  <button type="button" disabled={!completa||ocupado||!porta.reconciliarMedicamentos} onClick={()=>void confirmar()}>{ocupado?'Confirmando lista…':'Confirmar lista atual'}</button>
  {mensagem&&<p role="status">{mensagem}</p>}
 </section>;
}
