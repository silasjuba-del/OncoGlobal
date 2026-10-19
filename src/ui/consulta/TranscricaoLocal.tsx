import { useEffect, useRef, useState } from "react";
import { ErroPorta, type PedidoBundle, type PortaConsulta } from "../api/porta.js";
import { DitadoDeepgram } from './DitadoDeepgram.js';

/** Transcrição é fonte bruta revisável; nunca executa comandos ditados. */
export function TranscricaoLocal({ porta, contexto, aoSalvar }: {
  porta: PortaConsulta; contexto: PedidoBundle; aoSalvar: () => void;
}) {
  const [texto, setTexto] = useState(""), [capturado, setCapturado] = useState("");
  const [revisado, setRevisado] = useState(false), [ditando, setDitando] = useState(false);
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  const geracao = useRef(0), emCurso = useRef(false), abort = useRef<AbortController | null>(null);
  const identidade = useRef<{ texto: string; recordingId: string; sourceId: string } | null>(null);
  const chave = JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId]);
  useEffect(() => {
    geracao.current++; setTexto(""); setCapturado(""); setRevisado(false); setDitando(false);
    setOcupado(false); setMensagem(""); emCurso.current = false; identidade.current = null;
    return () => { geracao.current++; abort.current?.abort(); };
  }, [chave]);
  async function salvar() {
    if (!porta.importarTranscricaoLocal || !revisado || ditando || !texto.trim() || texto.length > 200_000 || emCurso.current) return;
    const atual = geracao.current; emCurso.current = true; setOcupado(true); setMensagem("");
    abort.current = new AbortController();
    if (identidade.current?.texto !== texto) identidade.current = { texto, recordingId: crypto.randomUUID(), sourceId: crypto.randomUUID() };
    try {
      await porta.importarTranscricaoLocal({ contexto, recordingId: identidade.current.recordingId, sourceId: identidade.current.sourceId,
        sourceType: "medical_note", rawTranscript: texto, captureMethod: capturado ? "DEEPGRAM_CLOUD" : "PASTED_TEXT",
        capturedTranscript: capturado || texto }, abort.current.signal);
      if (atual !== geracao.current) return;
      setMensagem("Rascunho salvo. Confira a fonte, vincule o paciente e revise os fatos na seção de revisão.");
      setTexto(""); setCapturado(""); setRevisado(false); identidade.current = null; aoSalvar();
    } catch (error) {
      if (atual === geracao.current) setMensagem(error instanceof ErroPorta ? `Transcrição pendente (${error.detalhe ?? error.codigo}).`
        : "Não foi possível salvar. O texto continua disponível para revisão.");
    } finally { if (atual === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }
  return <section aria-label="Transcrição local">
    <h3>Ditar ou colar transcrição</h3>
    <DitadoDeepgram key={chave} porta={porta} contexto={contexto} desabilitado={ocupado} aoAtividade={setDitando} aoTrecho={trecho => {
      setCapturado(anterior => anterior ? `${anterior}\n${trecho}` : trecho);
      setTexto(anterior => anterior ? `${anterior}\n${trecho}` : trecho); setRevisado(false); setMensagem("");
    }} />
    <label>Texto para revisar <textarea aria-label="Texto da transcrição" value={texto} maxLength={200_000} disabled={ocupado || ditando}
      onChange={event => { setTexto(event.target.value); setRevisado(false); setMensagem(""); }} /></label>
    {capturado ? <details><summary>Transcrição original do ditado</summary><pre>{capturado}</pre></details> : null}
    <label><input type="checkbox" checked={revisado} disabled={ocupado || ditando || !texto.trim()}
      onChange={event => setRevisado(event.target.checked)} />Revisei o texto para salvar como rascunho</label>
    <button type="button" disabled={ocupado || ditando || !revisado || !texto.trim() || !porta.importarTranscricaoLocal}
      onClick={() => void salvar()}>Salvar transcrição para revisão clínica</button>
    {mensagem ? <p role="status">{mensagem}</p> : null}
  </section>;
}
