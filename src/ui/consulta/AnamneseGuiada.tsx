import { useEffect, useRef, useState } from "react";
import type { PedidoAnamneseGuiada, RespostaAnamneseGuiada } from "../../contracts/api/anamneseGuiada.js";
import type { PedidoBundle, PortaConsulta } from "../api/porta.js";
type Respostas = Extract<PedidoAnamneseGuiada, { acao: "COMPILAR" }>["respostas"];
export function AnamneseGuiada({ porta, contexto, aoPendente, aoSalvando }: {
  porta: PortaConsulta; contexto: PedidoBundle; aoPendente: (v: boolean) => void; aoSalvando: (v: boolean) => void;
}) {
  const [dados, setDados] = useState<RespostaAnamneseGuiada | null>(null), [erro, setErro] = useState("");
  const [pack, setPack] = useState(""), [tipo, setTipo] = useState<"PRIMEIRA_CONSULTA" | "PRE_CICLO_QT" | "SEGUIMENTO_POS_TRATAMENTO">("PRIMEIRA_CONSULTA");
  const [perguntas, setPerguntas] = useState(""), [roteiroId, setRoteiroId] = useState(""), [contatoId, setContatoId] = useState("");
  const [respostas, setRespostas] = useState<Respostas>([]), [ocupado, setOcupado] = useState(false);
  const [roteiroAlterado, setRoteiroAlterado] = useState(false), [respostasAlteradas, setRespostasAlteradas] = useState(false);
  const alterado = roteiroAlterado || respostasAlteradas;
  const geracao = useRef(0), emCurso = useRef(false), pedidoId = useRef<string | null>(null);
  const chave = JSON.stringify(contexto);
  useEffect(() => { aoPendente(alterado); return () => aoPendente(false); }, [alterado, aoPendente]);
  useEffect(() => {
    const g = ++geracao.current, abort = new AbortController(); setDados(null);
    void porta.anamneseGuiada?.({ acao: "BASE", contexto }, abort.signal).then(r => { if (geracao.current === g) setDados(r); }, () => { if (geracao.current === g) setErro("Não foi possível carregar a anamnese."); });
    return () => { ++geracao.current; abort.abort(); aoSalvando(false); };
  }, [porta, chave, aoSalvando]);
  const roteiro = dados?.roteiros.find(r => r.roteiroId === roteiroId);
  function editar(area: "roteiro" | "respostas") {
    if (area === "roteiro") setRoteiroAlterado(true);
    else { setRespostasAlteradas(true); pedidoId.current = null; }
  }
  async function executar(pedido: PedidoAnamneseGuiada) {
    if (emCurso.current || !porta.anamneseGuiada) return;
    emCurso.current = true; const g = geracao.current; setOcupado(true); aoSalvando(true); setErro("");
    try { const r = await porta.anamneseGuiada(pedido); if (g === geracao.current) { setDados(r); if (pedido.acao === "CONFERIR_ROTEIRO") setRoteiroAlterado(false);
      if (pedido.acao === "COMPILAR") setRespostasAlteradas(false); } }
    catch { if (g === geracao.current) setErro("Confira o vínculo, o consentimento do contato e as mensagens selecionadas. Nenhum relato foi confirmado como fato clínico."); }
    finally { emCurso.current = false; if (g === geracao.current) { setOcupado(false); aoSalvando(false); } }
  }
  function resposta(passoId: string, mensagemId: string, polaridade: Respostas[number]["polaridade"]) {
    editar("respostas"); setRespostas(anteriores => [...anteriores.filter(r => r.passoId !== passoId || r.mensagemId !== mensagemId), ...(mensagemId ? [{ passoId, mensagemId, polaridade }] : [])]);
  }
  return <section aria-label="Anamnese guiada"><h2>Anamnese guiada</h2>
    <p>Organiza mensagens já recebidas e vinculadas ao paciente, com consentimento vigente. Não envia perguntas automaticamente nem transforma relatos em fatos confirmados.</p>
    {erro && <p role="alert">{erro}</p>}
    <button type="button" disabled={ocupado} onClick={() => void executar({ acao: "BASE", contexto })}>Recarregar dados da anamnese</button>
    <fieldset disabled={ocupado}><legend>Roteiro de perguntas do médico</legend>
      <label>Tipo de tumor<select value={pack} onChange={e => { editar("roteiro"); setPack(e.target.value); }}><option value="">Selecione</option>{dados?.packs.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select></label>
      <label>Momento da consulta<select value={tipo} onChange={e => { editar("roteiro"); setTipo(e.target.value as typeof tipo); }}>
        <option value="PRIMEIRA_CONSULTA">Primeira consulta</option><option value="PRE_CICLO_QT">Retorno pré-ciclo</option><option value="SEGUIMENTO_POS_TRATAMENTO">Follow-up</option>
      </select></label>
      <label>Perguntas, uma por linha<textarea value={perguntas} onChange={e => { editar("roteiro"); setPerguntas(e.target.value); }} /></label>
      <button type="button" disabled={!pack || !perguntas.trim()} onClick={() => void executar({ acao: "CONFERIR_ROTEIRO", contexto, tumorPackId: pack,
        contextoClinico: tipo, perguntas: perguntas.split(/\r?\n/).map(p => p.trim()).filter(Boolean) })}>Conferir e salvar roteiro</button>
    </fieldset>
    <fieldset disabled={ocupado}><legend>Organizar respostas recebidas</legend>
      <label>Roteiro conferido<select value={roteiroId} onChange={e => { editar("respostas"); setRoteiroId(e.target.value); setRespostas([]); }}><option value="">Selecione</option>
        {dados?.roteiros.map(r => <option key={r.roteiroId} value={r.roteiroId}>{dados.packs.find(p => p.id === r.tumorPackId)?.titulo ?? r.tumorPackId} · {r.contextoClinico} · {r.aprovadoEm}</option>)}
      </select></label>
      <label>Contato vinculado<select value={contatoId} onChange={e => { editar("respostas"); setContatoId(e.target.value); setRespostas([]); }}><option value="">Selecione</option>
        {[...new Set(dados?.mensagens.map(m => m.contatoId) ?? [])].map((id, i) => <option key={id} value={id}>Contato vinculado {i + 1}</option>)}
      </select></label>
      {!dados?.mensagens.length && <p>Não há mensagens vinculadas com consentimento vigente. Confira os vínculos e consentimentos na área Canal.</p>}
      {roteiro?.passos.map(p => <fieldset key={p.passoId}><legend>{p.perguntaCanonica}</legend>
        <label>Acrescentar mensagem de origem<select value="" onChange={e => resposta(p.passoId, e.target.value, "INCERTO_DUVIDA")}><option value="">Selecione uma resposta</option>
          {dados?.mensagens.filter(m => m.contatoId === contatoId && !respostas.some(r => r.passoId === p.passoId && r.mensagemId === m.mensagemId)).map(m => <option key={m.mensagemId} value={m.mensagemId}>{m.em} · {m.texto.slice(0, 160)}</option>)}
        </select></label>
        {respostas.filter(r => r.passoId === p.passoId).map(atual => <div key={atual.mensagemId}>
          <p>{dados?.mensagens.find(m => m.mensagemId === atual.mensagemId)?.texto}</p>
          <label>Sentido do relato<select value={atual.polaridade} onChange={e => resposta(p.passoId, atual.mensagemId, e.target.value as Respostas[number]["polaridade"])}>
            <option value="INCERTO_DUVIDA">Incerto / dúvida</option><option value="AFIRMADO">Afirmado</option><option value="NEGADO">Negado</option><option value="NAO_RESPONDIDO">Não respondido</option>
          </select></label>
          <button type="button" onClick={() => { editar("respostas"); setRespostas(rs => rs.filter(r => r !== atual)); }}>Retirar seleção desta mensagem</button>
        </div>)}
      </fieldset>)}
      <button type="button" disabled={!roteiro || !contatoId || !dados?.mensagens.some(m => m.contatoId === contatoId)} onClick={() => void executar({ acao: "COMPILAR", contexto, roteiroId, contatoId,
        pedidoId: pedidoId.current ??= crypto.randomUUID(), respostas })}>Preparar e salvar resumo da anamnese</button>
    </fieldset>
    <h3>Resumos deste encontro</h3>
    {dados?.historico.map(r => <article key={r.sessaoAnamneseId}>
      <p>{r.geradoEm} · Relato para revisão médica</p>
      {[...r.alertasEscalonamentoMedico, ...(r.alertasInformadosNaoVerificados ?? [])].map((a, i) => <p role="alert" key={i}>{a}</p>)}
      {r.itensColetados.map((i, index) => <p key={`${i.passoId}:${index}`}>{i.dominioClinico}: {i.resumoItem} · {i.polaridade}</p>)}
      {[...r.lacunasExplicitas, ...r.incertezasExplicitas, ...r.negacoesPreservadas].map((p, i) => <p key={i}>{p}</p>)}
    </article>)}
  </section>;
}
