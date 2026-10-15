import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { ApiBiblioteca, BibliotecaEstado, BibliotecaConsulta, ItemBibliotecaResposta, PacoteBibliotecaHttp } from "../../contracts/api/biblioteca.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./biblioteca.css";

const ERROS: Record<string, string> = {
  PACOTE_HASH_DIVERGENTE: "O hash do pacote mudou. Atualize a biblioteca e revise o conteúdo novamente.",
  SEM_ITEM_APROVADO: "A biblioteca não tem item revisado que possa ser ativado.",
  SEM_VERSAO_ANTERIOR_VALIDA: "Não há uma versão anterior válida para restaurar.",
  BIBLIOTECA_REVISAO_DIVERGENTE: "A versão ativa mudou. Atualize antes de continuar.",
  ALERTA_SEM_SCHEMA_EXECUTAVEL: "Este item textual não pode ser ativado como alerta clínico.",
  SERVIDOR_PENDENTE: "A biblioteca ainda não está disponível no servidor local.",
};
const mensagemErro = (erro: unknown) => {
  const codigo = erro instanceof Error ? erro.message : "BIBLIOTECA_INDISPONIVEL";
  return ERROS[codigo] ?? "Não foi possível concluir a operação. Atualize a biblioteca e tente novamente.";
};

export function BibliotecaLocal({ api }: { api: ApiBiblioteca }) {
  const [estado, setEstado] = useState<BibliotecaEstado | null>(null);
  const [selecionado, setSelecionado] = useState("");
  const [conteudoConferido, setConteudoConferido] = useState<Record<string, boolean>>({});
  const [itensExibidos, setItensExibidos] = useState<Record<string, boolean>>({});
  const [versaoRevisada, setVersaoRevisada] = useState(false);
  const [filtros, setFiltros] = useState({ tumor: "", histologia: "", estadio: "", biomarcador: "", linha: "" });
  const [consultados, setConsultados] = useState<BibliotecaConsulta["itens"]>([]);
  const [referenciaConsulta, setReferenciaConsulta] = useState<BibliotecaConsulta["referencia"]>(null);
  const [fezConsulta, setFezConsulta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  function limparConsulta() {
    setConsultados([]); setFezConsulta(false); setReferenciaConsulta(null);
  }

  async function carregar(id?: string) {
    setErro(""); setAviso(""); setOcupado(true);
    try {
      const novo = await api.estado(id);
      if (novo.ativa !== estado?.ativa || novo.referencia?.hash !== estado?.referencia?.hash) limparConsulta();
      const alvoId = id ?? selecionado ?? novo.ativa ?? "";
      const hashAnterior = estado?.pacotes.find((pacote) => pacote.pacoteId === alvoId)?.hash
        ?? (estado?.pacoteId === alvoId ? estado.hash : null);
      const hashNovo = novo.pacotes.find((pacote) => pacote.pacoteId === alvoId)?.hash
        ?? (novo.pacoteId === alvoId ? novo.hash : null);
      if (alvoId !== selecionado || hashAnterior !== hashNovo) {
        setConteudoConferido({}); setItensExibidos({});
      }
      setVersaoRevisada(false);
      setEstado(novo);
      if (id) setSelecionado(id);
      else if (!selecionado && novo.pacotes[0]) setSelecionado(novo.pacotes[0].pacoteId);
    } catch (e) { setEstado(null); limparConsulta(); setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }
  useEffect(() => { void carregar(); }, [api]);

  const pacoteAtual = estado?.pacotes.find((pacote) => pacote.pacoteId === selecionado);
  const itens = estado?.pacoteId === selecionado ? estado.itens : [];

  async function importar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!arquivo) return;
    setErro(""); setAviso(""); setOcupado(true);
    try {
      const payload = JSON.parse(await arquivo.text()) as PacoteBibliotecaHttp;
      if (!payload || typeof payload !== "object" || !payload.manifesto || !payload.arquivos || typeof payload.arquivos !== "object")
        throw new Error("ARQUIVO_PACOTE_INVALIDO");
      const resultado = await api.importar(payload);
      await carregar(resultado.pacoteId);
      setAviso("Pacote importado como RASCUNHO. Nenhum conteúdo foi aprovado ou ativado.");
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function curar(item: ItemBibliotecaResposta, destino: "CONSULTAVEL" | "OBSOLETO" = "CONSULTAVEL") {
    if (!estado?.hash || !conteudoConferido[item.id]) return;
    if (destino === "OBSOLETO" && !window.confirm(`Marcar “${item.titulo}” como OBSOLETO? O item deixará de aparecer nas consultas da biblioteca.`)) return;
    setErro(""); setOcupado(true);
    limparConsulta();
    try {
      await api.curar({ pacoteId: selecionado, itemId: item.id, expectedHash: estado.hash, estado: destino });
      await carregar(selecionado);
      setAviso(`Item “${item.titulo}” marcado como ${destino} após sua revisão.`);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function ativar() {
    if (!estado?.hash || !versaoRevisada || !pacoteAtual || !window.confirm(`Ativar ${pacoteAtual.pacoteId} (hash ${pacoteAtual.hash})? Confira a versão e os itens exibidos.`)) return;
    setErro(""); setOcupado(true);
    try {
      await api.ativar({ pacoteId: selecionado, expectedHash: estado.hash });
      await carregar(selecionado); setAviso(`Biblioteca ${selecionado} ativada.`);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function rollback() {
    const ativa = estado?.ativa, hash = estado?.pacotes.find((p) => p.pacoteId === ativa)?.hash;
    if (!ativa || !hash || !window.confirm(`Restaurar a versão anterior à ativa ${ativa}? O servidor verificará o hash ${hash}.`)) return;
    setErro(""); setOcupado(true);
    try {
      await api.rollback({ expectedAtiva: ativa, expectedHash: hash });
      await carregar(); setAviso("Versão anterior válida restaurada.");
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function consultar(event: FormEvent) {
    event.preventDefault(); setErro(""); setOcupado(true); limparConsulta();
    try {
      const resposta = await api.consultar({ filtros: Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor.trim())) as Partial<typeof filtros> });
      if (!resposta.referencia || resposta.referencia.hash !== estado?.referencia?.hash) {
        await carregar();
        throw new Error("BIBLIOTECA_REVISAO_DIVERGENTE");
      }
      setConsultados(resposta.itens);
      setReferenciaConsulta(resposta.referencia);
      setFezConsulta(true);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  return <section className="biblioteca-local" aria-labelledby="biblioteca-titulo">
    <header><div><h2 id="biblioteca-titulo">Biblioteca de conhecimento</h2>
      <p>Pacotes públicos versionados. Importar cria rascunho; curadoria e ativação exigem revisão humana.</p></div>
      <button type="button" disabled={ocupado || !estado?.ativa} onClick={() => void rollback()}>Restaurar versão anterior</button></header>
    {erro ? <p role="alert">{erro}</p> : null}
    {aviso ? <p role="status">{aviso}</p> : null}
    <div className="biblioteca-controles">
      <label>Importar pacote JSON local <input type="file" accept="application/json,.json" disabled={ocupado} onChange={(e) => void importar(e)} /></label>
      <button type="button" disabled={ocupado} onClick={() => void carregar()}>Atualizar lista</button>
      <label>Pacotes disponíveis <select value={selecionado} disabled={ocupado || !estado?.pacotes.length}
        onChange={(e) => { setSelecionado(e.target.value); setConteudoConferido({}); setItensExibidos({}); setVersaoRevisada(false); void carregar(e.target.value); }}>
        {!estado?.pacotes.length ? <option value="">Nenhum pacote</option> : null}
        {estado?.pacotes.map((p) => <option key={p.pacoteId} value={p.pacoteId}>{p.pacoteId}{p.ativo ? " · ATIVA" : ""}</option>)}
      </select></label>
    </div>
    {ocupado ? <p role="status">Carregando biblioteca…</p> : null}
    {pacoteAtual ? <section aria-label="Detalhes do pacote" className="biblioteca-pacote">
      <h3>{pacoteAtual.pacoteId}</h3><dl><dt>Versão ativa</dt><dd>{estado?.ativa ?? "Nenhuma"}</dd>
        <dt>Hash do pacote selecionado</dt><dd><code>{pacoteAtual.hash}</code></dd>
        <dt>Itens</dt><dd>{pacoteAtual.itens.length}</dd></dl>
      {estado?.pacoteId !== selecionado ? <button type="button" disabled={ocupado} onClick={() => void carregar(selecionado)}>Abrir para revisão</button> : null}
      {itens.map((item) => <article key={`${selecionado}:${estado?.hash}:${item.id}`} className="biblioteca-item">
        <h4>{item.titulo}</h4><p>{item.tipo} · Pilar {item.pilar} · versão {item.versao} · <strong>{item.estado}</strong></p>
        <p>Fonte: <a href={item.proveniencia.fonte} target="_blank" rel="noreferrer">{item.proveniencia.fonte}</a></p>
        <p>Publicado {item.proveniencia.publicadoEm} · recuperado {item.proveniencia.recuperadoEm} · licença {item.proveniencia.licenca}</p>
        <details onToggle={(e) => { if (e.currentTarget.open) setItensExibidos((antes) => ({ ...antes, [item.id]: true })); }}><summary>Exibir conteúdo e trecho da fonte</summary><h5>Conteúdo</h5><pre>{item.texto}</pre><h5>Trecho da fonte</h5><blockquote>{item.proveniencia.trecho}</blockquote>
          <p>Aplicabilidade: {Object.entries(item.aplicabilidade).map(([campo, valores]) => `${campo}: ${valores.length ? valores.join(", ") : "universal"}`).join(" · ")}</p>
          {item.curadoria ? <small>Curadoria por {item.curadoria.ator} · {item.curadoria.registradoEm ?? "data não informada"}</small> : null}
        </details>
        <label><input type="checkbox" disabled={!itensExibidos[item.id]} checked={Boolean(conteudoConferido[item.id])}
          onChange={(e) => setConteudoConferido((anterior) => ({ ...anterior, [item.id]: e.target.checked }))} /> Li e conferi o conteúdo e a fonte deste item.</label>
        {item.estado === "RASCUNHO" ? <button type="button" disabled={ocupado || !conteudoConferido[item.id]} onClick={() => void curar(item)}>Marcar CONSULTAVEL</button> : null}
        {item.estado === "CONSULTAVEL" || item.estado === "ALERTA" ? <button type="button" disabled={ocupado || !conteudoConferido[item.id]} onClick={() => void curar(item, "OBSOLETO")}>Marcar OBSOLETO</button> : null}
      </article>)}
      {itens.length ? <label><input type="checkbox" disabled={!itens.every((item) => conteudoConferido[item.id]) || itens.some((item) => item.estado === "RASCUNHO" || item.estado === "ALERTA")}
        checked={versaoRevisada} onChange={(e) => setVersaoRevisada(e.target.checked)} />
        Revisei a versão, o hash e os itens exibidos antes de ativar.</label> : null}
      <button type="button" disabled={ocupado || !versaoRevisada || !itens.some((item) => item.estado === "CONSULTAVEL") || pacoteAtual.ativo} onClick={() => void ativar()}>Ativar pacote revisado</button>
    </section> : <p>Selecione um pacote para ver seu conteúdo, as fontes e o estado de curadoria.</p>}
    <section aria-label="Consultar biblioteca"><h3>Consultar conteúdo ativo</h3>
      <form onSubmit={(e) => void consultar(e)}><div className="biblioteca-filtros">{Object.entries(filtros).map(([key, value]) => <label key={key}>{key}<input value={value} onChange={(e) => setFiltros((antes) => ({ ...antes, [key]: e.target.value }))} /></label>)}</div>
        <button type="submit" disabled={ocupado || !estado?.ativa}>Consultar</button></form>
      {referenciaConsulta ? <p>Resultados da biblioteca {referenciaConsulta.id} · versão {referenciaConsulta.versao}</p> : null}
      {consultados.map((item) => <article key={item.id}><h4>{item.titulo}</h4><p>{item.tipo} · {item.versao}</p><p>{item.texto}</p><p>Fonte: {item.proveniencia.fonte} · trecho: {item.proveniencia.trecho}</p></article>)}
      {fezConsulta && consultados.length === 0 ? <p>Nenhum resultado para estes filtros.</p> : null}
    </section>
  </section>;
}
