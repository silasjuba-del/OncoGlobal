import { useEffect, useRef, useState } from 'react';
import { InvestigacaoConsultaVisao } from '../../contracts/api/investigacao.js';
import type { PedidoBundle, PortaConsulta } from '../api/porta.js';
/** Consulta explícita por clique; propostas são minutas, sem criar pedido ou assinatura. */
export function InvestigacaoMinima({porta,contexto,revisaoEsperada}:{porta:PortaConsulta;contexto:PedidoBundle;revisaoEsperada?:string}) {
 const [dados,setDados]=useState<InvestigacaoConsultaVisao|null>(null),[pendente,setPendente]=useState<string|null>(null),[ocupado,setOcupado]=useState(false),[aberto,setAberto]=useState(false);
 const revisao=useRef(0),controller=useRef<AbortController|null>(null);
 useEffect(()=>{revisao.current++;controller.current?.abort();setDados(null);setPendente(null);setOcupado(false);setAberto(false);return()=>{revisao.current++;controller.current?.abort();};},[contexto.patientId,contexto.encounterId,contexto.tumorLotId,revisaoEsperada]);
 async function carregar(){
  if(ocupado)return;
  setAberto(true);
  if(!porta.investigacao){setPendente('Investigação pendente: serviço ainda indisponível.');return;}
  const atual=++revisao.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setOcupado(true);setPendente(null);
  try{
   const bruto=await porta.investigacao(contexto,abort.signal),r=InvestigacaoConsultaVisao.safeParse(bruto);
   if(atual!==revisao.current)return;
   if(!r.success||revisaoEsperada&&r.data.revisao!==revisaoEsperada||r.data.contexto.patientId!==contexto.patientId||r.data.contexto.encounterId!==contexto.encounterId||r.data.contexto.tumorLotId!==contexto.tumorLotId){setDados(null);setPendente('Investigação pendente: contexto ou referências divergentes.');return;}
   setDados(r.data);
  }catch{if(atual===revisao.current)setPendente('Não foi possível consultar a investigação; nenhuma proposta foi executada.');}
  finally{if(atual===revisao.current)setOcupado(false);}
 }
 return <section aria-label="Investigação contextual" style={{fontSize:'1.125rem',lineHeight:1.6}}>
  <button type="button" aria-expanded={aberto} disabled={ocupado} onClick={()=>{if(aberto)setAberto(false);else void carregar();}}> {ocupado?'Consultando investigação…':'Investigação e exames'} </button>
  {aberto&&<div>{pendente&&<p role="alert">{pendente}</p>}{dados&&<>
   <p><strong>{dados.estado}</strong> · propostas exigem revisão médica e assinatura em fluxo próprio.</p>
   {[...dados.lacunas,...(dados.resultado?.lacunas??[])].map((l,i)=><p key={`${l.codigo}-${i}`} role="status">{l.codigo}: {l.texto}</p>)}
   {!!dados.resultado?.requisitos.length&&<table><caption>Requisitos do pack aprovado</caption><thead><tr><th>Exame</th><th>Contexto</th><th>Situação</th></tr></thead><tbody>{dados.resultado.requisitos.map(r=><tr key={r.id}><td>{r.exameCodigo}</td><td>{r.contexto}</td><td>{r.classificacao}</td></tr>)}</tbody></table>}
   {!!dados.resultado?.propostas.length&&<details><summary>Minutas de pedidos ({dados.resultado.propostas.length})</summary><ul>{dados.resultado.propostas.map((p,i)=><li key={`${p.exameCodigo}-${i}`}><strong>{p.exameCodigo}</strong> · {p.contexto}<p>{p.justificativa}</p><p>Código SUS: {p.codigoSus??'pendente'}. {p.pendencias.join('; ')}</p></li>)}</ul></details>}
  </>}</div>}
 </section>;
}
