import { useEffect, useRef, useState } from "react";
import type { PedidoLaudoAcesso, RespostaLaudoAcesso } from "../../contracts/api/laudoAcesso.js";
import type { PedidoBundle, PortaConsulta } from "../api/porta.js";

export function LaudoAcesso({ porta, contexto, aoPendente, aoSalvando }: {
  porta: PortaConsulta; contexto: PedidoBundle; aoPendente: (v: boolean) => void; aoSalvando: (v: boolean) => void;
}) {
  const [dados, setDados] = useState<RespostaLaudoAcesso | null>(null), [erro, setErro] = useState("");
  const [nome, setNome] = useState(""), [posologia, setPosologia] = useState(""), [duracao, setDuracao] = useState("");
  const [indicacao, setIndicacao] = useState(""), [fontes, setFontes] = useState<string[]>([]);
  const [conferido, setConferido] = useState(false), [ocupado, setOcupado] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const emCurso = useRef(false), geracao = useRef(0), pedidoId = useRef<string | null>(null);
  const chave = JSON.stringify(contexto);
  useEffect(() => { aoPendente(alterado); return () => aoPendente(false); }, [alterado, aoPendente]);
  useEffect(() => {
    const g = ++geracao.current, abort = new AbortController();
    setDados(null); setErro("");
    void porta.laudoAcesso?.({ acao: "BASE", contexto }, abort.signal).then(r => { if (g === geracao.current) setDados(r); }, () => {
      if (g === geracao.current) setErro("Não foi possível carregar a base do laudo.");
    });
    return () => { ++geracao.current; abort.abort(); aoSalvando(false); };
  }, [porta, chave, aoSalvando]);
  function editar() { pedidoId.current = null; setAlterado(true); setConferido(false); setDados(d => d ? { ...d, minuta: null, conteudoHash: null } : d); }
  async function executar(pedido: PedidoLaudoAcesso) {
    if (emCurso.current || !porta.laudoAcesso) return;
    emCurso.current = true; setOcupado(true); aoSalvando(true); setErro("");
    const g = geracao.current;
    try {
      const r = await porta.laudoAcesso(pedido);
      if (g === geracao.current) { setDados(r); if (pedido.acao !== "BASE") setAlterado(false); setConferido(false); }
    } catch { if (g === geracao.current) setErro("Não foi possível concluir. Confira a prescrição assinada, as fontes e se o prontuário mudou; recarregue a base."); }
    finally { emCurso.current = false; if (g === geracao.current) { setOcupado(false); aoSalvando(false); } }
  }
  return <section aria-label="Laudo de acesso ao tratamento">
    <h2>Laudo de acesso ao tratamento</h2>
    <p>Vinculado à prescrição assinada e às fontes confirmadas deste encontro. Registro regulatório, cobertura e estoque permanecem não verificados até conferência documental.</p>
    {erro && <p role="alert">{erro}</p>}
    {dados?.pendencias.map(p => <p key={p}>{p}</p>)}
    <button type="button" disabled={ocupado} onClick={() => void executar({ acao: "BASE", contexto })}>Recarregar base do laudo</button>
    <fieldset disabled={ocupado}><legend>Solicitação médica</legend>
      <label>Medicamento solicitado<input value={nome} onChange={e => { editar(); setNome(e.target.value); }} /></label>
      <label>Posologia planejada<input value={posologia} onChange={e => { editar(); setPosologia(e.target.value); }} /></label>
      <label>Duração prevista<input value={duracao} onChange={e => { editar(); setDuracao(e.target.value); }} /></label>
      <label>Indicação e justificativa médica<textarea value={indicacao} onChange={e => { editar(); setIndicacao(e.target.value); }} /></label>
      <fieldset><legend>Fontes que sustentam a justificativa</legend>
        {dados?.fontes.map(f => <label key={f.citacaoId}><input type="checkbox" checked={fontes.includes(f.citacaoId)} onChange={e => {
          editar(); setFontes(atual => e.target.checked ? [...atual, f.citacaoId] : atual.filter(id => id !== f.citacaoId));
        }} />{f.tituloOuDescricao} · {f.dataFonte}</label>)}
      </fieldset>
      <button type="button" disabled={!dados || dados.pendencias.length > 0 || !fontes.length || ![nome, posologia, duracao, indicacao].every(s => s.trim())}
        onClick={() => dados && void executar({ acao: "PREPARAR", contexto, baseHash: dados.baseHash, pedidoId: pedidoId.current ??= crypto.randomUUID(),
          medicamento: { nome, posologiaPlanejada: posologia, duracaoPrevista: duracao }, indicacao, citacoesIds: fontes })}>Preparar e salvar laudo</button>
    </fieldset>
    {dados?.minuta && <article><h3>{dados.minuta.revisao === "ASSINADO" ? "Laudo assinado" : "Laudo para conferência"}</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{dados.minuta.textoMinutaConsolidado}</pre>
      {dados.minuta.revisao !== "ASSINADO" && <><label><input type="checkbox" disabled={ocupado} checked={conferido} onChange={e => setConferido(e.target.checked)} />Conferi o conteúdo e as fontes deste laudo</label>
        <button type="button" disabled={ocupado || !conferido || !dados.conteudoHash} onClick={() => dados.minuta && dados.conteudoHash && void executar({
          acao: "ASSINAR", contexto, minutaId: dados.minuta.minutaId, conteudoHash: dados.conteudoHash,
        })}>Assinar laudo revisado</button></>}
    </article>}
    <h3>Histórico deste encontro</h3>
    {dados?.historico.map(m => <details key={`${m.minutaId}:${m.versao}`}><summary>{m.medicamentoSolicitado.nome} · {m.revisao} · {m.criadoEm}</summary>
      <button type="button" disabled={ocupado || alterado} onClick={() => void executar({ acao: "ABRIR", contexto, minutaId: m.minutaId })}>Abrir laudo salvo</button>
      <pre style={{ whiteSpace: "pre-wrap" }}>{m.textoMinutaConsolidado}</pre>
      <p>{m.assinadoPorCrm ? `CRM ${m.assinadoPorCrm} · ${m.assinadoEm}` : "Assinatura pendente"}</p>
    </details>)}
  </section>;
}
