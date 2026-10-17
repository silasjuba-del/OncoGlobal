import { useEffect, useRef, useState } from 'react';
import { InvestigacaoConsultaVisao } from '../../contracts/api/investigacao.js';
import type { PedidoBundle, PortaConsulta } from '../api/porta.js';
/** Consulta explícita por clique; propostas são minutas, sem criar pedido ou assinatura. */
export type MinutaInvestigacao=NonNullable<InvestigacaoConsultaVisao['resultado']>['propostas'][number];
export function InvestigacaoMinima({porta,contexto,revisaoEsperada,aoPrepararPedido}:{porta:PortaConsulta;contexto:PedidoBundle;revisaoEsperada?:string;aoPrepararPedido?:(proposta:MinutaInvestigacao,revisao:string)=>void}) {
 const [dados,setDados]=useState<InvestigacaoConsultaVisao|null>(null),[pendente,setPendente]=useState<string|null>(null),[ocupado,setOcupado]=useState(false),[aberto,setAberto]=useState(false);
 const revisao=useRef(0),controller=useRef<AbortController|null>(null),emCurso=useRef(false);
 const portaDaResposta=useRef<PortaConsulta|null>(null);
 useEffect(()=>{revisao.current++;controller.current?.abort();setDados(null);setPendente(null);setOcupado(false);setAberto(false);emCurso.current=false;return()=>{revisao.current++;controller.current?.abort();};},[porta,contexto.patientId,contexto.encounterId,contexto.tumorLotId,revisaoEsperada]);
 async function carregar(){
  if(emCurso.current)return;
  setAberto(true);setDados(null);setPendente(null);
  if(!porta.investigacao){setPendente('Investigação pendente: serviço ainda indisponível.');return;}
  const atual=++revisao.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;emCurso.current=true;setOcupado(true);
  try{
   const bruto=await porta.investigacao(contexto,abort.signal),r=InvestigacaoConsultaVisao.safeParse(bruto);
   if(atual!==revisao.current)return;
   if(!r.success||revisaoEsperada&&r.data.revisao!==revisaoEsperada||r.data.contexto.patientId!==contexto.patientId||r.data.contexto.encounterId!==contexto.encounterId||r.data.contexto.tumorLotId!==contexto.tumorLotId){setDados(null);setPendente('Investigação pendente: contexto ou referências divergentes.');return;}
   portaDaResposta.current=porta;setDados(r.data);
  }catch{if(atual===revisao.current){setDados(null);setPendente('Não foi possível consultar a investigação; nenhuma proposta foi executada.');}}
  finally{if(atual===revisao.current){emCurso.current=false;setOcupado(false);}}
 }
 const atuais=dados&&portaDaResposta.current===porta&&dados.contexto.patientId===contexto.patientId
  &&dados.contexto.encounterId===contexto.encounterId&&dados.contexto.tumorLotId===contexto.tumorLotId
  &&(!revisaoEsperada||dados.revisao===revisaoEsperada)?dados:null;
 return <section aria-label="Investigação contextual" className="consulta-investigacao">
  <button type="button" aria-expanded={aberto} disabled={ocupado} onClick={()=>{if(aberto)setAberto(false);else void carregar();}}> {ocupado?'Consultando investigação…':'Investigação e exames'} </button>
  {aberto&&<div aria-busy={ocupado}>{pendente&&<p role="alert">{pendente}</p>}{atuais&&<>
   <p><strong>{atuais.estado}</strong> · propostas exigem revisão médica e assinatura em fluxo próprio.</p>
   {[...atuais.lacunas,...(atuais.resultado?.lacunas??[])].map((l,i)=><p key={`${l.codigo}-${i}`} role="status">{l.codigo}: {l.texto}</p>)}
   {!!atuais.resultado?.requisitos.length&&<table><caption>Requisitos do pack aprovado</caption><thead><tr><th>Exame</th><th>Contexto</th><th>Situação</th></tr></thead><tbody>{atuais.resultado.requisitos.map(r=><tr key={r.id}><td>{r.exameCodigo}</td><td>{r.contexto}</td><td>{r.classificacao}</td></tr>)}</tbody></table>}
   {!!atuais.resultado?.propostas.length&&<details><summary>Minutas de pedidos ({atuais.resultado.propostas.length})</summary><ul>{atuais.resultado.propostas.map((p,i)=><li key={`${p.exameCodigo}-${i}`}><strong>{p.exameCodigo}</strong> · {p.contexto}<p>{p.justificativa}</p><p>Código SUS: {p.codigoSus??'pendente'}. {p.pendencias.join('; ')}</p>
     {aoPrepararPedido&&atuais.revisao&&['LABORATORIO','IMAGEM'].includes(p.categoria??'')?<button type="button" onClick={()=>aoPrepararPedido(p,atuais.revisao!)}>Preparar pedido de {p.exameCodigo}</button>:<p>Categoria do pedido pendente de conferência.</p>}</li>)}</ul></details>}
  </>}</div>}
 </section>;
}
