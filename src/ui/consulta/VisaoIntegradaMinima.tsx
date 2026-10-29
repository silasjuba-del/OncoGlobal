import { useId, useRef } from "react";
import { Retrato } from "../../contracts/f1/retrato.js";
import { VisaoIntegrada } from "../../contracts/f1/visaoIntegrada.js";
import { SetorClinico } from "../../contracts/f1/achadosSetor.js";
type ReferenciaFato = Retrato["fatos"][number]["ref"];

const labels: Record<string,string> = {LABORATORIO:"Laboratório",IMAGEM:"Imagem",PATOLOGIA:"Patologia",COMORBIDADES:"Comorbidades",INTERACOES:"Interações",TOXICIDADES:"Toxicidades",TRATAMENTO:"Tratamento"};
const canonical = (v: unknown): string => JSON.stringify(v, (_k,x: unknown) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))) : x);
/** Síntese factual e avaliação determinística; não executa confirmação ou ação clínica. */
export function VisaoIntegradaMinima({retrato,visao}: {retrato?:Retrato;visao?:VisaoIntegrada}) {
  const id = useId();
  const fontes = useRef<HTMLDetailsElement>(null);
  const rp = Retrato.safeParse(retrato), vp = VisaoIntegrada.safeParse(visao);
  if (!rp.success) return <section aria-label="Visão clínica integrada"><h3>Visão clínica integrada</h3><p>Resumo principal pendente: fatos confirmados indisponíveis.</p></section>;
  const r = rp.data;
  const refs = new Map(r.fatos.map(f=>[`${f.ref.eventId}@${f.ref.revisao}`,f]));
  const refExiste = (ref: ReferenciaFato) => refs.has(`${ref.eventId}@${ref.revisao}`);
  const resumoValido = r.resumo.every(frase=>frase.fatos.every(refExiste));
  const fatosValidos = r.fatos.every(f=>f.patientId===r.patientId && (f.escopo==="PACIENTE" || f.tumorLotId===r.tumorLotId));
  const v = vp.success ? vp.data : null;
  const correlacionada = v && v.correlacao.patientId===r.patientId && v.correlacao.encounterId===r.encounterId
    && v.correlacao.tumorLotId===r.tumorLotId && v.correlacao.revisaoFatos===r.revisao
    && canonical(v.correlacao.regras)===canonical(r.regras) && canonical(v.correlacao.biblioteca)===canonical(r.biblioteca)
    && [...v.achados,...v.lacunas].every(a=>a.fatos.every(refExiste));
  if (!resumoValido || !fatosValidos || (visao && !correlacionada)) return <section aria-label="Visão clínica integrada"><p role="alert">Visão integrada pendente: contexto, revisão ou referências divergentes. Reabra a consulta.</p></section>;
  const referencia = (ref: ReferenciaFato) => <a key={`${ref.eventId}@${ref.revisao}`} href={`#${id}-${encodeURIComponent(ref.eventId)}`}
    onClick={() => {if(fontes.current)fontes.current.open=true;}}
    style={{color:"#004e99",textDecoration:"underline",marginRight:"0.5rem"}}>{ref.eventId}</a>;
  const renderAchado = (a: NonNullable<typeof v>["achados"][number]) => <li key={a.id}><strong>{a.estado}</strong> · {a.texto}<div>{a.fatos.map(referencia)}</div></li>;
  return <section aria-label="Visão clínica integrada" style={{fontSize:"1.125rem",lineHeight:1.6,color:"#111",background:"#fff",padding:"1rem",border:"2px solid #444",borderRadius:"0.5rem"}}>
    <h3>Resumo clínico principal</h3>
    <p>Paciente {r.patientId} · consulta {r.encounterId} · tumor {r.tumorLotId ?? "não selecionado"}. Atualizado em {r.geradoEm}.</p>
    <details><summary>Revisão e fontes de conhecimento</summary><p>Revisão dos fatos: {r.revisao}</p><p>Projeção {r.versaoProjecao} · biblioteca {r.biblioteca.id} / {r.biblioteca.versao}</p></details>
    {!r.resumo.length ? <p>Resumo pendente: nenhum dado confirmado disponível para síntese factual.</p>
      : <ul>{r.resumo.map((s,i)=><li key={i}>{s.texto}<div>{s.fatos.map(referencia)}</div></li>)}</ul>}
    <h3>Avaliação integrada</h3>
    {!correlacionada || !v ? <p>Avaliação integrada pendente: setores ou regras indisponíveis.</p> : <>
      <p aria-label="Cobertura">{v.cobertura.setoresAvaliados.length} de {v.cobertura.setoresEsperados.length} setores avaliados · {v.cobertura.avaliados} avaliações · {v.cobertura.semRegraAprovada} sem regra aprovada.</p>
      <h4>Achados entre setores</h4>
      {v.achados.some(a=>a.setores.length>1) ? <ul>{v.achados.filter(a=>a.setores.length>1).map(renderAchado)}</ul> : <p>Nenhum achado transversal disponível. Isso não comprova ausência de risco.</p>}
      <details><summary>Lacunas · {v.lacunas.length} para conferir</summary>
      {!v.lacunas.length ? <p>Nenhuma lacuna registrada nesta avaliação.</p> : <ul>{v.lacunas.map((l,i)=><li key={`${l.codigo}-${i}`}>{labels[l.setor]}: {l.texto}<div>{l.fatos.map(referencia)}</div></li>)}</ul>}
      </details>
      {SetorClinico.options.map(setor=><details key={setor}><summary>{labels[setor]} · {v.cobertura.setoresAvaliados.includes(setor) ? "avaliado" : "pendente"}</summary>
        {!v.achados.some(a=>a.setores.includes(setor)) ? <p>Nenhum achado informado para este setor.</p> : <ul>{v.achados.filter(a=>a.setores.includes(setor)).map(renderAchado)}</ul>}
        {v.lacunas.filter(l=>l.setor===setor).map((l,i)=><p key={`${l.codigo}-${i}`}>{l.texto} {l.fatos.map(referencia)}</p>)}
      </details>)}
    </>}
    {!!r.integridade.length && <aside role="alert">Integridade pendente: {r.integridade.map(i=>`${i.eventoId}: ${i.motivo}`).join("; ")}</aside>}
    <details ref={fontes}><summary>Fatos e fontes citados</summary>{r.fatos.map(f=><article key={f.ref.eventId} id={`${id}-${encodeURIComponent(f.ref.eventId)}`} tabIndex={-1}>
      <h4>{f.campo ?? f.tipo} · {f.ref.eventId}</h4><p>Tempo clínico: {f.tempoClinico ?? "não informado"} · registro: {f.tempoRegistro}.</p>
      {!f.fontes.length ? <p>Fonte não informada; não sustenta avaliação clínica.</p> : f.fontes.map((fonte,i)=><p key={`${fonte.sourceId}-${i}`}>Fonte {fonte.sourceId} · {fonte.localizador ?? "localizador ausente"} · versão {fonte.versao} · data clínica {fonte.dataClinica ?? "não informada"}.</p>)}
      <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:"1rem"}}>{JSON.stringify(f.dados,null,2)}</pre>
    </article>)}</details>
  </section>;
}
