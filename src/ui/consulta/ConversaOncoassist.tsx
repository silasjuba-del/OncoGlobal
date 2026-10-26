import { LIMITE_TEXTO_DOCUMENTO_MANUAL } from "../../contracts/api/flash.js";
import { useEffect, useRef, useState } from "react";
import type { ApiConversaOncoassist, ContextoConversa, FonteConversa, HistoricoConversa, PreferenciasConversa, TurnoConversa } from "../../contracts/api/conversaOncoassist.js";
// @ts-expect-error CSS resolved by Vite.
import "./conversa-oncoassist.css";

function urlBibliografica(url: string | null): string | null {
  if (!url) return null;
  try { const u = new URL(url); return ["http:", "https:"].includes(u.protocol) ? u.href : null; } catch { return null; }
}

export interface ConversaOncoassistProps {
  api: ApiConversaOncoassist;
  contexto: ContextoConversa;
  aoAbrirFonte?: (fonte: { draftId?: string; eventId?: string; sourceId?: string }) => void;
  aoUsarTexto?: (texto: string) => void | boolean | Promise<void | boolean>;
  aoDitar?: () => void;
  textoDitado?: { id: string; texto: string };
  aoAlterarPendente?: (pendente: boolean) => void;
  aoAtividade?: (ocupado: boolean) => void;
}
export function ConversaOncoassist({ api, contexto, aoAbrirFonte, aoUsarTexto, aoDitar, textoDitado, aoAlterarPendente, aoAtividade }: ConversaOncoassistProps) {
  const chave = JSON.stringify(contexto), geracao = useRef(0), controle = useRef<AbortController | null>(null), emCurso = useRef(false);
  const [base, setBase] = useState<HistoricoConversa | null>(null), [pergunta, setPergunta] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]), [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(""), [parcial, setParcial] = useState(""), [edicao, setEdicao] = useState("");
  const [resultado, setResultado] = useState<TurnoConversa | null>(null), [endpoint, setEndpoint] = useState("http://127.0.0.1:11434/v1");
  const [modelo, setModelo] = useState(""), [preferencias, setPreferencias] = useState<PreferenciasConversa>({ formato: "TOPICOS", extensao: "BREVE", incluirBiblioteca: false });
  const perguntaPersistida = useRef(""), ditadoRecebido = useRef(textoDitado?.id), avisos = useRef({ aoAlterarPendente, aoAtividade });
  avisos.current = { aoAlterarPendente, aoAtividade };
  const [transferido, setTransferido] = useState("");
  const [turnoAtivo, setTurnoAtivo] = useState<string | null>(null), [cancelando, setCancelando] = useState(false);
  const cancelamento = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!textoDitado || textoDitado.id === ditadoRecebido.current) return;
    ditadoRecebido.current = textoDitado.id;
    if (textoDitado.texto.trim()) setPergunta(atual => [atual, textoDitado.texto.trim()].filter(Boolean).join("\n"));
  }, [textoDitado]);
  useEffect(() => {
    avisos.current.aoAlterarPendente?.(pergunta.trim() !== perguntaPersistida.current.trim()
      || !!resultado && edicao !== resultado.texto && edicao !== transferido);
    avisos.current.aoAtividade?.(ocupado);
  }, [pergunta, resultado, edicao, transferido, ocupado]);
  useEffect(() => () => { avisos.current.aoAlterarPendente?.(false); avisos.current.aoAtividade?.(false); }, []);
  async function carregar(g: number, signal: AbortSignal) {
    const h = await api.historico(contexto, signal);
    if (g !== geracao.current || signal.aborted || JSON.stringify(h.contexto) !== chave) return;
    setBase(h); setPreferencias(h.configuracao.preferencias); setModelo(h.configuracao.modelo?.modelo ?? "");
    setEndpoint(h.configuracao.modelo?.endpoint ?? "http://127.0.0.1:11434/v1");
  }
  useEffect(() => {
    const g = ++geracao.current, abort = new AbortController(); controle.current?.abort(); controle.current = abort;
    cancelamento.current = null; setTurnoAtivo(null); setCancelando(false);
    emCurso.current = false; perguntaPersistida.current = ""; setTransferido(""); setOcupado(false); setBase(null); setResultado(null); setEdicao(""); setParcial(""); setErro(""); setSelecionadas([]); setPergunta("");
    void carregar(g, abort.signal).catch(() => { if (!abort.signal.aborted && g === geracao.current) setErro("Não foi possível recuperar a conversa. Tente novamente."); });
    return () => { abort.abort(); controle.current?.abort(); };
  }, [api, chave]);
  const atual = base && JSON.stringify(base.contexto) === chave ? base : null;
  const propostaEditada = !!resultado && edicao !== resultado.texto && edicao !== transferido;
  async function operar(acao: (g: number, signal: AbortSignal) => Promise<void>) {
    if (emCurso.current) return;
    const g = geracao.current, abort = new AbortController(); controle.current?.abort(); controle.current = abort;
    emCurso.current = true; setOcupado(true); setErro("");
    try { await acao(g, abort.signal); }
    catch (e) { if (!cancelamento.current && g === geracao.current) { setParcial(""); setErro(abort.signal.aborted ? "Transporte interrompido. Confira o estado da operação no histórico." : e instanceof Error ? e.message : "Conversa indisponível."); } }
    finally {
      await cancelamento.current;
      if (g === geracao.current) { emCurso.current = false; setOcupado(false); setTurnoAtivo(null); setCancelando(false); cancelamento.current = null; }
    }
  }
  function cancelarResposta() {
    if (!turnoAtivo || cancelamento.current) return;
    const g = geracao.current, abort = controle.current;
    setCancelando(true);
    cancelamento.current = (async () => {
      try {
        const r = await api.cancelar({ ...contexto, turnoId: turnoAtivo });
        if (r.turno.estado !== "CANCELADA") throw Error("Cancelamento não confirmado. Confira o histórico.");
        if (g === geracao.current) { setResultado(null); setParcial(""); setErro("Operação cancelada. A pergunta foi preservada; nenhuma proposta foi aceita."); }
      } catch (e) { if (g === geracao.current) setErro(e instanceof Error ? e.message : "Cancelamento não confirmado. Confira o histórico."); }
      finally { abort?.abort(); }
    })();
  }
  function responder(modo: "BRIEFING" | "MODELO_LOCAL") {
    if (propostaEditada) return;
    void operar(async (g, signal) => {
      setResultado(null); setEdicao(""); setParcial("");
      const resposta = await api.responder({ ...contexto, operationId: crypto.randomUUID(), pergunta: pergunta.trim() || "Organize as fontes e as pendências desta consulta.", fontesIds: selecionadas, modo }, signal, e => {
        if (g === geracao.current && !signal.aborted && e.tipo === "inicio") setTurnoAtivo(e.turnoId);
        if (g === geracao.current && !signal.aborted && e.tipo === "delta") setParcial(t => t + e.texto);
      });
      if (cancelamento.current) return;
      if (g !== geracao.current || signal.aborted || JSON.stringify(resposta.contexto) !== chave) return;
      if (resposta.turno.estado !== "CONCLUIDA") throw Error(resposta.turno.codigo ?? "Operação ainda em curso; consulte o histórico.");
      if (resposta.turno.validadeFontes !== "ATUAIS") throw Error("Fontes alteradas. Refaça a proposta sobre as fontes atuais antes de usá-la.");
      perguntaPersistida.current = pergunta;
      setResultado(resposta.turno); setEdicao(resposta.turno.texto); setParcial("");
      await carregar(g, signal);
    });
  }
  function abrir(f: FonteConversa) {
    if (f.tipo === "BIBLIOTECA") return;
    aoAbrirFonte?.({ ...(f.draftId ? { draftId: f.draftId } : {}), ...(f.eventId ? { eventId: f.eventId } : {}), ...(f.sourceId ? { sourceId: f.sourceId } : {}) });
  }
  return <section className="oa-conversa" aria-label="Conversa com OncoAssist" aria-busy={ocupado}>
    <header><div><span className="oa-conversa__marca">OncoAssist</span><h2>Conversa e evidências da consulta</h2></div>
      <p>Paciente {contexto.patientId} · Encontro {contexto.encounterId}{contexto.tumorLotId ? ` · Lote ${contexto.tumorLotId}` : ""}</p></header>
    <p>Propostas para revisão médica. O chat não assina documentos nem confirma fatos.</p>
    {!atual ? <button type="button" disabled={ocupado} onClick={() => void operar(carregar)}>Recuperar conversa</button> : <>
      <details><summary>Modelo local e preferências</summary>
        <p>{atual.configuracao.modelo ? `Modelo configurado: ${atual.configuracao.modelo.modelo} · execução local` : "Modelo local não configurado. O briefing documental continua disponível sem IA generativa."}</p>
        <label>Endpoint local<input value={endpoint} onChange={e => setEndpoint(e.target.value)} disabled={ocupado} /></label>
        <label>Modelo local<input value={modelo} onChange={e => setModelo(e.target.value)} disabled={ocupado} /></label>
        <label>Formato<select value={preferencias.formato} onChange={e => setPreferencias(p => ({ ...p, formato: e.target.value as PreferenciasConversa["formato"] }))}><option value="TOPICOS">Tópicos</option><option value="PROSA">Prosa</option></select></label>
        <label>Extensão<select value={preferencias.extensao} onChange={e => setPreferencias(p => ({ ...p, extensao: e.target.value as PreferenciasConversa["extensao"] }))}><option value="BREVE">Breve</option><option value="DETALHADA">Detalhada</option></select></label>
        <label><input type="checkbox" checked={preferencias.incluirBiblioteca} onChange={e => setPreferencias(p => ({ ...p, incluirBiblioteca: e.target.checked }))} />Incluir referências da biblioteca curada</label>
        <button type="button" disabled={ocupado} onClick={() => void operar(async (g, signal) => {
          await api.configurar({ ...contexto, expectedRevision: atual.configuracao.revision, preferencias, modelo: modelo.trim() ? { endpoint, modelo: modelo.trim() } : null }, signal);
          await carregar(g, signal);
        })}>Salvar preferências do assistente</button>
      </details>
      <details><summary>Fontes disponíveis ({atual.fontes.length})</summary><p>Sem seleção manual, o briefing usa até 12 fontes do contexto. A biblioteca não altera o corpus.</p>
        {atual.fontes.map(f => <article key={f.id} className="oa-conversa__fonte"><label><input type="checkbox" disabled={ocupado} checked={selecionadas.includes(f.id)}
          onChange={e => setSelecionadas(ids => e.target.checked ? [...ids, f.id] : ids.filter(id => id !== f.id))} />{f.titulo} · {f.tipo}</label>
          <small>{f.revisao} · {f.data ?? "Data não informada"}</small>
          {f.tipo !== "BIBLIOTECA" && aoAbrirFonte ? <button type="button" onClick={() => abrir(f)}>Abrir fonte original</button> : null}
          <details><summary>Trecho disponível</summary><p>{f.texto}</p>{urlBibliografica(f.url) ? <a href={urlBibliografica(f.url)!} target="_blank" rel="noopener noreferrer">Abrir referência bibliográfica</a> : null}</details></article>)}
      </details>
      <label>Pergunta ao OncoAssist<textarea aria-label="Pergunta ao OncoAssist" rows={4} value={pergunta} onChange={e => setPergunta(e.target.value)} maxLength={6000} disabled={ocupado} /></label>
      {propostaEditada ? <p role="status">Há uma proposta editada. Prepare o documento ou descarte explicitamente essa edição antes de pedir outra resposta.</p> : null}
      <div className="oa-conversa__acoes"><button type="button" disabled={ocupado || propostaEditada} onClick={() => responder("BRIEFING")}>Preparar briefing documental</button>
        <button type="button" disabled={ocupado || propostaEditada || !atual.configuracao.modelo || !pergunta.trim()} onClick={() => responder("MODELO_LOCAL")}>Perguntar ao modelo local</button>
        {aoDitar ? <button type="button" disabled={ocupado} onClick={aoDitar}>Ditar rascunho</button> : null}
        {ocupado ? <button type="button" disabled={!turnoAtivo || cancelando} onClick={cancelarResposta}>{cancelando ? "Confirmando cancelamento…" : "Cancelar resposta"}</button> : null}</div>
      {parcial ? <section aria-label="Resposta parcial não validada"><p role="status">Recebendo proposta — conteúdo parcial ainda não validado.</p><pre>{parcial}</pre></section> : null}
      {resultado ? <section aria-label="Proposta do OncoAssist"><p>{resultado.modo === "BRIEFING" ? "Briefing documental determinístico" : `Proposta do modelo local ${resultado.modelo}`} · revisão médica obrigatória</p>
        <label>Texto da proposta para revisão<textarea aria-label="Texto da proposta para revisão" rows={9} value={edicao} onChange={e => setEdicao(e.target.value)} /></label>
        {propostaEditada ? <button type="button" disabled={ocupado} onClick={() => setEdicao(resultado.texto)}>Descartar edição da proposta</button> : null}
        <ul>{resultado.citacoes.map((c, i) => { const f = resultado.fontes.find(f => f.id === c.fonteId); return <li key={`${c.fonteId}:${i}`}><strong>{f?.titulo}</strong><blockquote>{c.trecho}</blockquote>
          {f && f.tipo !== "BIBLIOTECA" && aoAbrirFonte ? <button type="button" onClick={() => abrir(f)}>Conferir evidência</button> : null}
          {f?.tipo === "BIBLIOTECA" && urlBibliografica(f.url) ? <a href={urlBibliografica(f.url)!} target="_blank" rel="noopener noreferrer">Conferir referência bibliográfica</a> : null}</li>; })}</ul>
        {edicao.length > LIMITE_TEXTO_DOCUMENTO_MANUAL ? <p role="alert">O documento aceita até 8.000 caracteres. Revise ou selecione um trecho; nada será cortado automaticamente.</p> : null}
        {aoUsarTexto ? <button type="button" disabled={ocupado || !edicao.trim() || edicao.length > LIMITE_TEXTO_DOCUMENTO_MANUAL} onClick={async () => {
          try { const aceito = await aoUsarTexto(edicao); if (aceito !== false) setTransferido(edicao); }
          catch { setErro("O documento não foi preparado; a edição foi preservada."); }
        }}>Preparar documento com texto revisado</button> : null}
      </section> : null}
      <details><summary>Histórico deste encontro ({atual.turnos.length} turnos recentes)</summary><p>Até 100 turnos recentes; registros anteriores permanecem armazenados localmente.</p>{atual.turnos.map(t => <article key={t.id} className="oa-conversa__turno"><strong>{t.pergunta}</strong><small>{t.criadoEm} · {t.estado} · {t.modo} · Fontes {t.validadeFontes === "ATUAIS" ? "atuais" : "alteradas; gerar nova proposta"}</small>
        {t.estado === "CONCLUIDA" ? <pre>{t.texto}</pre> : <p>{t.codigo ?? "Operação interrompida ou ainda em curso. Nenhuma proposta aceita."}</p>}
        {t.estado === "EM_CURSO" ? <button type="button" disabled={ocupado} onClick={() => void operar(async (g, signal) => {
          await api.cancelar({ ...contexto, turnoId: t.id }, signal); await carregar(g, signal);
        })}>Encerrar operação pendente</button> : null}
        <button type="button" disabled={ocupado} onClick={() => { setPergunta(t.pergunta); setSelecionadas(t.fontes.filter(f => atual.fontes.some(a => a.id === f.id)).map(f => f.id)); }}>Reutilizar pergunta como rascunho</button>
      </article>)}</details>
    </>}
    {erro ? <p role="alert">{erro}</p> : null}
  </section>;
}
