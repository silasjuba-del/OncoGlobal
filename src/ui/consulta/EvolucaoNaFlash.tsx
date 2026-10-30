import { useEffect, useRef, useState } from "react";
import type { AtendimentoV6Resposta } from "../../contracts/api/atendimentoV6.js";
import type { PlanoFlash } from "../../contracts/api/flash.js";

type Referencia = NonNullable<PlanoFlash["evolucaoAtendimento"]>;
/** Seleção explícita; a assinatura sempre resolve novamente a fonte no servidor. */
export function EvolucaoNaFlash({ carregar, selecionada, aoSelecionar, ocupado }: {
 carregar: () => Promise<AtendimentoV6Resposta>; selecionada: Referencia | undefined;
 aoSelecionar: (ref: Referencia | undefined) => void; ocupado: boolean | undefined;
}) {
 const [dados, setDados] = useState<AtendimentoV6Resposta | null>(null);
 const [carregando, setCarregando] = useState(false), [erro, setErro] = useState("");
 const geracao = useRef(0), emCurso = useRef(false);
 useEffect(() => () => { geracao.current++; }, []);
 async function recuperar() {
  if (emCurso.current) return;
  const g = ++geracao.current; emCurso.current = true; setCarregando(true); setErro("");
  try { const r = await carregar(); if (g === geracao.current) setDados(r); }
  catch { if (g === geracao.current) { setDados(null); setErro("Não foi possível recuperar a evolução. A seleção salva foi preservada; tente novamente."); } }
  finally { if (g === geracao.current) { emCurso.current = false; setCarregando(false); } }
 }
 const r = dados?.rascunho, documento = r?.documentos.find(d => d.tipo === "EVOLUCAO");
 const atual = dados?.estadoRascunho === "ATUAL" && documento?.estado === "PRONTO_PARA_REVISAO";
 return <section aria-label="Evolução integrada à Flash">
  <h3>Evolução do atendimento</h3>
  <p>Prepare Hoje e Decisão no atendimento por diferenças. Aqui, confira a versão salva e escolha incluí-la no documento que será assinado.</p>
  <button type="button" disabled={ocupado || carregando} onClick={() => void recuperar()}>Conferir evolução salva</button>
  {selecionada && <p role="status">Evolução selecionada: versão {selecionada.versao}. Será conferida novamente antes da assinatura.
   <button type="button" disabled={ocupado} onClick={() => aoSelecionar(undefined)}>Retirar evolução da Flash</button></p>}
  {dados && !r && <p>Nenhuma evolução salva neste atendimento.</p>}
  {r && <details open={!selecionada}><summary>Texto e fontes da evolução salva</summary><p>Autor: {r.autor.medicoId} · Data clínica: {r.dataClinica ?? "não informada"} · Versão {r.versao}</p>
   {documento ? <><pre style={{ whiteSpace: "pre-wrap" }}>{documento.apresentacao?.textoClinico ?? documento.texto}</pre>
    <details><summary>Fontes e proveniência da evolução</summary><pre style={{ whiteSpace: "pre-wrap" }}>{documento.texto}</pre></details></> : <p>Esta versão não contém evolução. Selecione a saída Evolução no atendimento.</p>}
   {!atual && <p role="status">Evolução pendente ou desatualizada. Atualize a base e prepare novamente no atendimento por diferenças. {documento?.pendencias.join(" ")}</p>}
   <button type="button" disabled={ocupado || !atual || carregando} onClick={() => aoSelecionar({ id: r.id, versao: r.versao, conteudoHash: r.conteudoHash })}>Incluir esta evolução</button>
  </details>}
  {erro && <p role="alert">{erro}</p>}
 </section>;
}
