import { useEffect, useRef, useState } from "react";
import { RevisaoClinicaResposta } from "../../contracts/fase2/revisaoClinica.js";
import { BLOCOS_TUMOR_PACK } from "../../contracts/fase2/tumorPack.js";
import type { PedidoBundle, PortaConsulta } from "../api/porta.js";
import { EstadoDoenca } from './EstadoDoenca.js';
import { LoteTumoralCompleto } from './LoteTumoralCompleto.js';
const ROTULOS_BLOCOS={identidade:"Identidade do tumor",diagnostico:"Diagnóstico",estadiamento:"Estadiamento",biomarcadores:"Biomarcadores",
  c1_lacunas:"Lacunas da primeira consulta",pre_qt:"Pré-QT",tratamento:"Tratamento",toxicidades:"Toxicidades e interações",resposta:"Critérios de resposta",
  seguimento:"Seguimento",documentos:"Documentos e orientações",fontes:"Fontes"};

export function RevisaoClinica({porta,contexto,versaoClinica,aoRegistrar=()=>{}}:{porta:PortaConsulta;contexto:PedidoBundle;versaoClinica:number;aoRegistrar?:()=>void}){
  const [dados,setDados]=useState<RevisaoClinicaResposta|null>(null),[selecao,setSelecao]=useState({chave:'',id:''});
  const [erro,setErro]=useState(""),[ocupado,setOcupado]=useState(false),geracao=useRef(0);
  const chave=JSON.stringify([contexto.patientId,contexto.encounterId,contexto.tumorLotId]);
  const packId=selecao.chave===chave?selecao.id:'';
  useEffect(()=>{
    const atual=++geracao.current,abort=new AbortController();setDados(null);setErro("");
    if(!porta.revisaoClinica){setErro("Revisão integrada ainda indisponível.");return;}
    setOcupado(true);
    void porta.revisaoClinica(contexto,packId||undefined,abort.signal).then(bruto=>{
      if(atual!==geracao.current)return;
      const r=RevisaoClinicaResposta.safeParse(bruto);
      if(!r.success||r.data.contexto.patientId!==contexto.patientId||r.data.contexto.encounterId!==contexto.encounterId||r.data.contexto.tumorLotId!==contexto.tumorLotId){setErro("Revisão com contexto divergente; reabra a consulta.");return;}
      setDados(r.data);
    }).catch(()=>{if(atual===geracao.current)setErro("Não foi possível carregar a revisão integrada.");})
      .finally(()=>{if(atual===geracao.current)setOcupado(false);});
    return()=>{geracao.current++;abort.abort();};
  },[porta,chave,packId,versaoClinica]);
  const atual=dados?.contexto.patientId===contexto.patientId&&dados.contexto.encounterId===contexto.encounterId&&dados.contexto.tumorLotId===contexto.tumorLotId?dados:null;
  return <section aria-label="Ficha e revisão clínica" aria-busy={ocupado}>
    <h2>Ficha e revisão clínica</h2>
    {ocupado?<p role="status">Conferindo dados e fontes…</p>:null}{erro?<p role="status">{erro}</p>:null}
    {atual?<>
      <table><caption>Dados mínimos da consulta</caption><thead><tr><th>Dado</th><th>Valor documentado</th><th>Situação e fonte</th></tr></thead>
        <tbody>{atual.ficha.map(f=><tr key={f.id}><th scope="row">{f.rotulo}</th><td>{f.valor===null?"Não consta":Array.isArray(f.valor)&&f.valor.length===0?"Nenhum — registrado explicitamente":typeof f.valor==="string"||typeof f.valor==="number"?String(f.valor):JSON.stringify(f.valor)}</td>
          <td>{f.estado}<details><summary>Conferir fonte</summary><p>{f.motivo}</p><p>Data clínica: {f.data??"não consta"}</p>
            <ul>{f.fontes.map((fonte,i)=><li key={i}>{fonte.sourceId}{fonte.localizador?` — ${fonte.localizador}`:""} · {fonte.dataClinica??'data não consta'} · versão {fonte.versao}</li>)}</ul></details></td></tr>)}</tbody></table>
      <details><summary>Pré-QT · {atual.preQt.estado}</summary><p>Completude documental e avaliações do esquema aguardam decisão médica.</p>
        <ul>{atual.preQt.pendencias.map((p,i)=><li key={i}>{p}</li>)}</ul></details>
      <details><summary>Resposta tumoral e patológica</summary><p>RECIST 1.1 calculado como proposta; conferir o critério aplicável ao tumor.</p>
        {atual.respostaTumoral.pendencias.map((p,i)=><p key={i}>{p}</p>)}
        {atual.respostaTumoral.series.map(s=><section key={s.eventId}><h4>Episódio {s.episodioId}</h4>
          <table><thead><tr><th>Data</th><th>Soma (mm)</th><th>Δ baseline</th><th>Δ nadir</th><th>Proposta</th></tr></thead>
            <tbody>{s.avaliacoes.map((a,i)=><tr key={`${a.data}-${i}`}><td>{a.data}</td><td>{a.somaMm}</td><td>{a.deltaBaselinePct}%</td><td>{a.deltaNadirPct}%</td><td>{a.categoria??"PENDENTE"} · {a.revisao}</td></tr>)}</tbody></table>
          <p>{s.pendencias.join("; ")}</p></section>)}
        <h4>Registros de resposta patológica (pCR)</h4>
        {atual.respostaTumoral.patologica.length?atual.respostaTumoral.patologica.map(p=><p key={p.fato.eventId}>
          {p.estado==='NEGADO'?'pCR negada':p.estado==='INCERTO'?'pCR incerta — A CONFERIR':'Registro de pCR'}
          {p.conflito?' · CONFLITO entre registros — A CONFERIR':''}
          {(p.qualificadores.negated===true||p.qualificadores.negado===true)?' · negação explícita na fonte':''}
          {p.estado==='INCERTO'?' · confirmação médica pendente':''}
          {' · '}{p.data??"Data não consta"}: {JSON.stringify(p.valor)} · fonte {p.fontes.map(f=>f.sourceId).join(", ")}
        </p>):<p>Não consta. Resposta radiológica não determina pCR.</p>}
      </details>
      <details><summary>Histórico de remissão e recidiva</summary>
        {atual.estadosDoenca.length?<ul>{atual.estadosDoenca.map(e=><li key={e.fato.eventId}>{e.data} · {e.estado}{e.conflito?" · A CONFERIR: registros divergentes nesta data":""}
          <p>{e.fundamento}</p><small>Fontes: {e.fontes.map(f=>f.sourceId).join(", ")}</small></li>)}</ul>:<p>Nenhum estado documentado neste lote.</p>}
      </details>
      <EstadoDoenca porta={porta} contexto={contexto} aoRegistrar={aoRegistrar}/>
      <label>Tipo de tumor — disparar pack completo <select aria-label="Pack para consulta documental" value={packId} onChange={e=>setSelecao({chave,id:e.target.value})}>
        <option value="">Selecionar pelo CID documentado</option>{atual.packs.map(p=><option key={p.id} value={p.id}>{p.titulo} · {p.estado}</option>)}</select></label>
      {atual.pendencias.map((p,i)=><p role="status" key={i}>{p}</p>)}
      {atual.pack?<div aria-label="Pack documental selecionado"><p><strong>{atual.pack.titulo}</strong> · {atual.pack.estado}</p>
        <p>Fonte: {atual.pack.original.arquivo} · versão {atual.pack.referencia.versao} · estado original: {atual.pack.original.estado}</p>
        {atual.pack.estado!=="ATIVO"?<p>Conteúdo consultável, com revisão clínica pendente para gerar requisitos e propostas.</p>:null}
        {atual.loteCompleto?<LoteTumoralCompleto key={atual.loteCompleto.original.sha256} lote={atual.loteCompleto}/>:BLOCOS_TUMOR_PACK.map(nome=><details key={nome}><summary>{ROTULOS_BLOCOS[nome]} · {atual.pack!.blocos[nome].estado}</summary>
          {atual.pack!.blocos[nome].itens.length?atual.pack!.blocos[nome].itens.map(item=><section key={item.localizador}>
            <h4>{item.localizador}</h4><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(item.conteudo,null,2)}</pre></section>):<p>Não consta neste pack.</p>}</details>)}
      </div>:null}
    </>:null}
  </section>;
}
