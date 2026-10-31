import { useEffect, useRef, useState } from "react";
import type { PortaConsulta, PedidoBundle } from "../api/porta.js";
import type { PedidoResultadoExame, ResultadosPedidosResposta } from "../../contracts/api/resultadosPedidos.js";
import type { TarefaRetornoId, MarcacaoTarefasRetorno } from '../../contracts/api/tarefas.js';
export type { TarefaRetornoId, MarcacaoTarefasRetorno } from '../../contracts/api/tarefas.js';
import { COPY_PT_BR } from "../copy/pt-BR.js";

const C = COPY_PT_BR.flashRetorno;





/** Cartão "Tarefas do retorno". Controlado: não executa nada, só mostra e alterna marcações. */
export function TarefasRetorno({
  prazoDias,
  marcadas,
  modeloPadraoSalvo,
  onAlternar,
}: {
  prazoDias: number | null;
  marcadas: MarcacaoTarefasRetorno;
  modeloPadraoSalvo: boolean;
  onAlternar: (id: TarefaRetornoId) => void;
}) {
  const rotuloRetorno = prazoDias === null ? `${C.retorno} (prazo PENDENTE)` : `${C.retorno} (${prazoDias} dias)`;
  const linhas: readonly { id: Exclude<TarefaRetornoId, "retorno">; rotulo: string }[] = [
    { id: "laboratorio", rotulo: C.laboratorio },
    { id: "imagem", rotulo: C.imagem },
  ];
  return (
    <fieldset aria-label={C.tituloTarefas}>
      <legend>{C.tituloTarefas}</legend>
      {modeloPadraoSalvo ? null : <p role="note">{C.semModeloPadrao}</p>}
      <ul>
        <li data-tarefa="retorno">
          {rotuloRetorno} · {C.retornoSempre}
        </li>
        {linhas.map((l) => (
          <li key={l.id}>
            <label>
              <input type="checkbox" checked={marcadas[l.id]} onChange={() => onAlternar(l.id)} />
              {l.rotulo}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Acompanhamento longitudinal por pedido assinado; não interpreta resultados nem confirma fatos. */
export function ResultadosPedidosRetorno({porta,contexto,aoOcupado}:{porta:PortaConsulta;contexto:PedidoBundle;aoOcupado?:(v:boolean)=>void}) {
 const [dados,setDados]=useState<ResultadosPedidosResposta|null>(null),[erro,setErro]=useState(""),[ocupado,setOcupado]=useState(false);
 const [datas,setDatas]=useState<Record<string,string>>({}),[selecoes,setSelecoes]=useState<Record<string,string>>({});
 const respostaAtual=useRef(0);
 const geracao=useRef(0),emCurso=useRef(false),tentativa=useRef<{chave:string;id:string}|null>(null);
 const chave=JSON.stringify(contexto),callback=useRef(aoOcupado);callback.current=aoOcupado;
 useEffect(()=>{
  const g=++geracao.current,rid=++respostaAtual.current,abort=new AbortController();setDados(null);setDatas({});setSelecoes({});setErro("");tentativa.current=null;
  void porta.resultadosPedidos?.({acao:"LISTAR",contexto},abort.signal).then(r=>{if(g===geracao.current&&rid===respostaAtual.current)setDados(r);},()=>{if(g===geracao.current&&rid===respostaAtual.current)setErro("Não foi possível carregar os pedidos do retorno.");});
  return()=>{++geracao.current;abort.abort();callback.current?.(false);};
 },[porta,chave]);
 async function executar(pedido:PedidoResultadoExame){
  if(!porta.resultadosPedidos||emCurso.current)return;
  if(pedido.acao!=="LISTAR"){
   const {operationId:_id,...base}=pedido, fingerprint=JSON.stringify(base);
   if(tentativa.current?.chave!==fingerprint)tentativa.current={chave:fingerprint,id:crypto.randomUUID()};
   pedido={...pedido,operationId:tentativa.current.id};
  }
  const g=geracao.current,rid=++respostaAtual.current;emCurso.current=true;setOcupado(true);callback.current?.(true);setErro("");
  try{const r=await porta.resultadosPedidos(pedido);if(g===geracao.current&&rid===respostaAtual.current){setDados(r);tentativa.current=null;}}
  catch{if(g===geracao.current)setErro("Não foi possível atualizar. Confira o encontro, a versão do pedido e o documento do resultado; recarregue para conferir o estado.");}
  finally{emCurso.current=false;if(g===geracao.current){setOcupado(false);callback.current?.(false);}}
 }
 if(!porta.resultadosPedidos)return null;
 return <section aria-label="Pedidos e resultados do retorno"><h3>Pedidos e resultados do retorno</h3>
  <p>Solicitado, realizado, resultado disponível e vínculo revisado são estados distintos. A revisão do vínculo não confirma valores clínicos.</p>
  {erro&&<p role="alert">{erro}</p>}
  <button type="button" disabled={ocupado} onClick={()=>void executar({acao:"LISTAR",contexto})}>Recarregar pedidos e resultados</button>
  {!dados?.tarefas.length&&<p>Nenhum pedido assinado vinculado às tarefas deste paciente neste contexto.</p>}
  {dados?.tarefas.flatMap(t=>[...new Map(t.tarefa.pedidoRefs.map(p=>[`${p.documentId}@${p.documentVersion}`,p])).values()].map(p=>{
   const k=`${t.tarefa.tarefaId}:${p.documentId}:${p.documentVersion}`,doc=t.pedidos.find(d=>d.documentId===p.documentId&&d.documentVersion===p.documentVersion);
   const a=t.tarefa.acompanhamentoPedidos.find(r=>r.pedido.documentId===p.documentId&&r.pedido.documentVersion===p.documentVersion);
   const estado=a?.estado??"SOLICITADO",fonte=dados.fontes.find(f=>f.draftId===(selecoes[k]??a?.resultado?.draftId));
   const base={contexto,tarefaId:t.tarefa.tarefaId,pedido:p,expectedEventId:t.eventId,operationId:"pendente"};
   return <article key={k} aria-label={`Acompanhamento ${doc?.titulo??p.documentId}`}>
    <h4>{doc?.titulo??"Pedido em conferência: versão assinada indisponível"}</h4>
    <p>Estado do exame: <strong>{estado}</strong> · pedido versão {p.documentVersion} · assinatura {doc?.assinadoEm??"não confirmada"}</p>
    {doc&&<details><summary>Pedido assinado</summary><pre style={{whiteSpace:"pre-wrap"}}>{doc.texto}</pre></details>}
    <fieldset disabled={ocupado||!doc}>
    {estado==="SOLICITADO"&&<><label>Data de realização do exame<input type="date" value={datas[k]??""} onChange={e=>setDatas(ds=>({...ds,[k]:e.target.value}))}/></label>
     <button type="button" disabled={!datas[k]} onClick={()=>void executar({...base,acao:"REALIZADO",realizadoEm:datas[k]!})}>Registrar realização</button></>}
    {estado==="REALIZADO"&&<><label>Documento do resultado<select value={selecoes[k]??""} onChange={e=>setSelecoes(s=>({...s,[k]:e.target.value}))}><option value="">Selecione uma fonte deste encontro</option>
     {dados.fontes.filter(f=>f.encounterId===contexto.encounterId).map(f=><option key={f.draftId} value={f.draftId}>{f.sourceId} · versão {f.revision}</option>)}</select></label>
     <button type="button" disabled={!fonte} onClick={()=>{if(!fonte)return;const {texto:_t,registradoEm:_r,...ref}=fonte;void executar({...base,acao:"RESULTADO_DISPONIVEL",fonte:ref});}}>Vincular resultado disponível</button></>}
    {a?.resultado&&<p>Fonte: {a.resultado.sourceId} · versão {a.resultado.revision} · hash {a.resultado.hash}</p>}
    {fonte&&<details><summary>Conferir fonte do resultado</summary><pre style={{whiteSpace:"pre-wrap"}}>{fonte.texto}</pre></details>}
    {estado==="RESULTADO_DISPONIVEL"&&<button type="button" disabled={!fonte||fonte.hash!==a?.resultado?.hash} onClick={()=>a?.resultado&&void executar({...base,acao:"REVISADO",expectedFonteHash:a.resultado.hash})}>Confirmar vínculo revisado</button>}
    {estado==="REVISADO"&&<p>Revisado por {a?.revisadoPor} em {a?.revisadoEm}. Realizado em {a?.realizadoEm}.</p>}
    </fieldset>
   </article>;
  }))}
 </section>;
}
