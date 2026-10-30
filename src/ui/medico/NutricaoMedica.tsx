import { LIMITE_TEXTO_DOCUMENTO_MANUAL } from "../../contracts/api/flash.js";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { ApiConsultorioMedico, ContextoConsultorio, NutricaoMedicaResposta } from "../../contracts/api/consultorioMedico.js";
// @ts-expect-error folha CSS pura resolvida pelo Vite
import "./consultorio-medico.css";

export function NutricaoMedica({ api, contexto, aoUsarOrientacao, aoAlterarPendente }: {
  api: ApiConsultorioMedico; contexto: ContextoConsultorio; aoUsarOrientacao: (texto: string) => void | boolean | Promise<void | boolean>;
  aoAlterarPendente?: (pendente: boolean) => void;
}) {
  const [texto, setTexto] = useState(""), [resposta, setResposta] = useState<z.infer<typeof NutricaoMedicaResposta> | null>(null);
  const [ocupado, setOcupado] = useState(false), [carregando, setCarregando] = useState(true), [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState(""), [aviso, setAviso] = useState(""), [versao, setVersao] = useState(0);
  const geracao = useRef(0), emCurso = useRef(false), tentativa = useRef<{ fingerprint: string; operationId: string } | null>(null);
  const contextoChave = JSON.stringify(contexto), callbackPendente = useRef(aoAlterarPendente); callbackPendente.current = aoAlterarPendente;
  useEffect(() => { callbackPendente.current?.(pendente); }, [pendente]);
  useEffect(() => {
    const g = ++geracao.current, abort = new AbortController();
    setTexto(""); setResposta(null); setPendente(false); setErro(""); setAviso(""); setCarregando(true); setOcupado(false); emCurso.current = false; tentativa.current = null;
    void api.nutricao(contexto, abort.signal).then(r => { if (g === geracao.current) { setResposta(r); setTexto(r.rascunho?.texto ?? ""); } })
      .catch(e => { if (g === geracao.current && !abort.signal.aborted) setErro(e instanceof Error ? e.message : "Orientação indisponível."); })
      .finally(() => { if (g === geracao.current) setCarregando(false); });
    return () => { geracao.current++; abort.abort(); callbackPendente.current?.(false); };
  }, [api, contextoChave, versao]);
  const atual = resposta && JSON.stringify(resposta.contexto) === contextoChave ? resposta : null;
  async function salvar() {
    if (emCurso.current || carregando || !atual) return;
    const g = geracao.current, pedido = { contexto, expectedVersion: atual.rascunho?.versao ?? 0, texto }, fingerprint = JSON.stringify(pedido);
    if (tentativa.current?.fingerprint !== fingerprint) tentativa.current = { fingerprint, operationId: crypto.randomUUID() };
    emCurso.current = true; setOcupado(true); setErro("");
    try {
      const r = await api.salvarNutricao({ ...pedido, operationId: tentativa.current.operationId });
      if (g !== geracao.current) return;
      setResposta(r); setPendente(false); tentativa.current = null; setAviso("Orientação salva como rascunho, sem assinatura ou entrega ao paciente.");
    } catch (e) { if (g === geracao.current) setErro(`${e instanceof Error ? e.message : "Falha ao salvar"}. O texto foi preservado.`); }
    finally { if (g === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }
  return <section className="consultorio-medico" aria-label="Orientações dietéticas médicas" aria-busy={ocupado || carregando}>
    <header><h2>Nutrição · orientações dietéticas</h2><p>Texto do médico para este encontro. Nenhuma dieta, restrição ou suplemento é preenchido automaticamente.</p></header>
    {erro ? <p role="alert">{erro}</p> : null}{aviso ? <p role="status">{aviso}</p> : null}
    {carregando ? <p role="status">Recuperando orientação…</p> : <>
      <label>Orientação dietética para revisão<textarea aria-label="Orientação dietética para revisão" rows={12} maxLength={12000} value={texto} disabled={ocupado || !atual}
        onChange={e => { setTexto(e.target.value); setPendente(true); setAviso(""); }} /></label>
      {texto.length > LIMITE_TEXTO_DOCUMENTO_MANUAL ? <p role="alert">O rascunho foi preservado. Para preparar o documento, revise o texto até 8.000 caracteres; nada será truncado.</p> : null}
      {pendente ? <p role="status">Alterações ainda não salvas.</p> : null}
      <div className="medico-acoes"><button disabled={ocupado || !atual} onClick={() => void salvar()}>Salvar orientação dietética</button>
        <button disabled={ocupado || pendente || !atual?.rascunho || !texto.trim() || texto.length > LIMITE_TEXTO_DOCUMENTO_MANUAL} onClick={async () => { const aceito = await aoUsarOrientacao(texto); if(aceito === false)return; setAviso("Orientação enviada para revisão documental da consulta. Revise e assine o conteúdo exibido."); }}>Usar orientação na consulta</button>
        <button disabled={ocupado} onClick={() => setVersao(v => v + 1)}>Recuperar orientação salva</button></div>
      {atual?.rascunho ? <small>Versão {atual.rascunho.versao} · {atual.rascunho.autor} · {atual.rascunho.salvoEm} · RASCUNHO</small> : null}
    </>}
  </section>;
}
