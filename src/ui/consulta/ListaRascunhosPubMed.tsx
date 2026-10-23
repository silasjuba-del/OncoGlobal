import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ListaRascunhosPubMedResposta, ReferenciaPubMed } from "../../contracts/leituraPubMed.js";
import { ErroPorta, type PortaConsulta } from "../api/porta.js";

/** Lista local e pesquisa bibliográfica. Não confirma fato, prescrição nem conduta. */
export function ListaRascunhosPubMed({ porta }: { porta: PortaConsulta }) {
  const listar = porta.listarRascunhosPubMed;
  const pesquisar = porta.pesquisarPubMed;
  const [lista, setLista] = useState<ListaRascunhosPubMedResposta | null>(null);
  const [falha, setFalha] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [avisoPesquisa, setAvisoPesquisa] = useState<string | null>(null);
  const geracao = useRef(0);
  const pesquisaAtual = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!listar) return;
    const atual = ++geracao.current;
    const controller = new AbortController();
    void listar(controller.signal).then((resposta) => {
      if (atual !== geracao.current || controller.signal.aborted) return;
      setLista(resposta);
      setFalha(false);
    }).catch(() => {
      if (atual === geracao.current && !controller.signal.aborted) setFalha(true);
    });
    return () => { geracao.current++; controller.abort(); pesquisaAtual.current?.abort(); };
  }, [listar]);

  async function buscar(event: FormEvent) {
    event.preventDefault();
    const texto = consulta.trim();
    if (!pesquisar || buscando || texto.length === 0) return;
    const controller = new AbortController();
    pesquisaAtual.current?.abort();
    pesquisaAtual.current = controller;
    setBuscando(true);
    setAvisoPesquisa(null);
    try {
      const resposta = await pesquisar(texto, controller.signal);
      if (controller.signal.aborted) return;
      setAvisoPesquisa(resposta.codigo === "REPLAY"
        ? "Esta pesquisa já estava salva neste computador. Não é fato do prontuário."
        : "Referências salvas neste computador. Não são fatos do prontuário.");
      if (!listar) return;
      const atual = ++geracao.current;
      try {
        const atualizada = await listar(controller.signal);
        if (atual !== geracao.current || controller.signal.aborted) return;
        setLista(atualizada);
        setFalha(false);
      } catch {
        if (atual === geracao.current && !controller.signal.aborted) setFalha(true);
      }
    } catch (erro) {
      if (!controller.signal.aborted) setAvisoPesquisa(mensagemPesquisa(erro));
    } finally {
      if (pesquisaAtual.current === controller) setBuscando(false);
    }
  }

  if (!listar && !pesquisar) return null;
  return <section aria-label="Referências bibliográficas locais">
    <h3>Referências bibliográficas locais</h3>
    <p>Rascunhos salvos neste computador. Não são fatos do prontuário.</p>
    {pesquisar ? <form onSubmit={(event) => void buscar(event)} aria-label="Pesquisa bibliográfica">
      <label>Consulta bibliográfica <input aria-label="Consulta bibliográfica" value={consulta} maxLength={500}
        onChange={(event) => setConsulta(event.target.value)} disabled={buscando} /></label>
      <button type="submit" className="oc-btn-secondary" disabled={buscando || consulta.trim().length === 0}>
        {buscando ? "Buscando…" : "Buscar referências"}
      </button>
    </form> : null}
    {avisoPesquisa ? <p role="status">{avisoPesquisa}</p> : null}
    {falha ? <p role="status">Não foi possível atualizar a lista. A leitura já aberta foi preservada e nada entrou no prontuário.</p> : null}
    {lista && lista.omitidos > 0 ? <p role="status">{lista.omitidos} {lista.omitidos === 1 ? "rascunho local não pôde ser lido" : "rascunhos locais não puderam ser lidos"}.</p> : null}
    {lista?.truncado ? <p role="status">A lista mostra as {lista.itens.length} pesquisas mais recentes.</p> : null}
    {lista && lista.itens.length === 0 && !falha ? <p>Nenhuma referência bibliográfica salva neste computador.</p> : null}
    {lista && lista.itens.length > 0 ? <ul>{lista.itens.map((item) => <li key={item.draftId}>
      <p>Pesquisa salva em {item.criadoEm}. Revisão {item.revision}.</p>
      {item.referencias.length === 0 ? <p>Esta pesquisa não devolveu referência.</p> : <ul>
        {item.referencias.map((ref) => <ReferenciaLocal key={`${item.draftId}:${ref.pmid}`} referencia={ref} />)}
      </ul>}
    </li>)}</ul> : null}
  </section>;
}

function mensagemPesquisa(erro: unknown): string {
  const codigo = erro instanceof ErroPorta ? erro.codigo : "";
  if (codigo === "READ_PHI_NAO_VALIDADA") return "A consulta contém um identificador conhecido. Nada foi enviado nem salvo.";
  if (codigo === "CONTEXTO_CONSULTA_NAO_SELECIONADO") return "Abra uma consulta antes de pesquisar. Nada foi salvo.";
  if (codigo === "READ_OPERACAO_DIVERGENTE") return "Esta pesquisa já foi usada com outra consulta. Nada novo foi salvo.";
  return "A pesquisa bibliográfica não foi concluída. A lista local foi preservada e nada entrou no prontuário.";
}

function ReferenciaLocal({ referencia }: { referencia: ReferenciaPubMed }) {
  const canonica = referencia.url === `https://pubmed.ncbi.nlm.nih.gov/${referencia.pmid}/`;
  return <li>
    {canonica ? <a href={referencia.url} target="_blank" rel="noreferrer">{referencia.titulo}</a> : referencia.titulo}
    <br />PMID {referencia.pmid} · {referencia.periodico} · {referencia.publicadoEm}
    <br />Metadado bibliográfico. Não é fato clínico.
  </li>;
}
