import { useEffect,useRef,useState } from "react";
import type { EstadoDoencaPreparado,PedidoEstadoDoenca } from "../../contracts/fase2/estadoDoenca.js";
import { ErroPorta,type PedidoBundle,type PortaConsulta } from "../api/porta.js";
export function EstadoDoenca({porta,contexto,aoRegistrar}:{porta:PortaConsulta;contexto:PedidoBundle;aoRegistrar:()=>void}){
  const [estado,setEstado]=useState<PedidoEstadoDoenca["estado"]|"">(""),[data,setData]=useState(""),[fundamento,setFundamento]=useState("");
  const [previa,setPrevia]=useState<EstadoDoencaPreparado|null>(null),[ocupado,setOcupado]=useState(false),[mensagem,setMensagem]=useState("");
  const geracao=useRef(0),emCurso=useRef(false),abort=useRef<AbortController|null>(null);
  const chave=JSON.stringify([contexto.patientId,contexto.encounterId,contexto.tumorLotId]);
  useEffect(()=>{geracao.current++;setPrevia(null);setEstado("");setData("");setFundamento("");setMensagem("");setOcupado(false);emCurso.current=false;
    return()=>{geracao.current++;abort.current?.abort();};},[chave,porta]);
  async function executar(confirmar:boolean){
    if(emCurso.current||!contexto.tumorLotId||!estado||!data||!fundamento.trim())return;
    const atual=geracao.current;emCurso.current=true;setOcupado(true);setMensagem("");abort.current=new AbortController();
    try{
      if(confirmar){if(!previa||!porta.confirmarEstadoDoenca)return;
        await porta.confirmarEstadoDoenca({...contexto,draftId:previa.draftId,conteudoHash:previa.conteudoHash},abort.current.signal);
        if(atual!==geracao.current)return;setPrevia(null);setEstado("");setData("");setFundamento("");setMensagem("Registro médico confirmado e preservado no histórico.");aoRegistrar();
      }else{if(!porta.prepararEstadoDoenca)return;
        const r=await porta.prepararEstadoDoenca({...contexto,estado,data,fundamento},abort.current.signal);
        if(atual!==geracao.current)return;
        if(r.contexto.patientId!==contexto.patientId||r.contexto.encounterId!==contexto.encounterId||r.contexto.tumorLotId!==contexto.tumorLotId)throw Error("CONTEXTO_DIVERGENTE");setPrevia(r);}
    }catch(e){if(atual===geracao.current){setPrevia(null);setMensagem(e instanceof ErroPorta?`Registro pendente (${e.codigo}). Confira e prepare novamente.`:"Não foi possível registrar. Confira e prepare novamente.");}}
    finally{if(atual===geracao.current){emCurso.current=false;setOcupado(false);}}
  }
  return <details><summary>Registrar remissão ou recidiva</summary>
    <p>Declaração médica com data e fundamento. Nenhum estado é inferido de RECIST ou pCR.</p>
    {!contexto.tumorLotId?<p>Selecione um lote tumoral para registrar o estado da doença.</p>:null}
    <fieldset disabled={ocupado||!contexto.tumorLotId}><legend>Registro médico</legend>
      <label>Estado documentado <select aria-label="Estado documentado" value={estado} onChange={e=>{setEstado(e.target.value as typeof estado);setPrevia(null);}}>
        <option value="">Selecionar</option><option value="REMISSAO">Remissão</option><option value="RECIDIVA">Recidiva</option></select></label>
      <label>Data clínica <input aria-label="Data clínica do estado da doença" type="date" value={data} onChange={e=>{setData(e.target.value);setPrevia(null);}}/></label>
      <label>Fundamento e fonte consultada <textarea aria-label="Fundamento do estado da doença" maxLength={4000} value={fundamento} onChange={e=>{setFundamento(e.target.value);setPrevia(null);}}/></label>
      <button type="button" disabled={!estado||!data||!fundamento.trim()||!porta.prepararEstadoDoenca} onClick={()=>void executar(false)}>Preparar registro para revisão</button>
    </fieldset>
    {previa?<section aria-label="Prévia do estado da doença"><pre style={{whiteSpace:"pre-wrap"}}>{previa.texto}</pre>
      <button type="button" disabled={ocupado||!porta.confirmarEstadoDoenca} onClick={()=>void executar(true)}>Confirmar registro médico exibido</button></section>:null}
    {mensagem?<p role="status">{mensagem}</p>:null}
  </details>;
}
