import { LIMITE_CAMPO_PRECONSULTA } from "../../contracts/api/consultorioMedico.js";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { ApiConsultorioMedico, ContextoConsultorio, EntradaPreConsultaMedica, PreConsultaMedicaResposta } from "../../contracts/api/consultorioMedico.js";
// @ts-expect-error folha CSS pura resolvida pelo Vite
import "./consultorio-medico.css";

const vazia = (): EntradaPreConsultaMedica => ({ queixa: "", historia: "", antecedentes: "", medicamentos: "", alergias: "",
  contextoPessoal: "", observacoes: "", pesoKg: null, alturaCm: null, origemPeso: "NAO_INFORMADO" });
const campos = { queixa: "Queixa principal", historia: "História e sintomas relatados", antecedentes: "Antecedentes relatados",
  medicamentos: "Medicamentos em uso relatados", alergias: "Alergias relatadas", contextoPessoal: "Contexto pessoal e familiar", observacoes: "Observações médicas" } as const;
type Resposta = z.infer<typeof PreConsultaMedicaResposta>;

export function PreConsultaMedica({ api, contexto, aoRegistrar, aoAlterarPendente }: {
  api: ApiConsultorioMedico; contexto: ContextoConsultorio; aoRegistrar?: () => void; aoAlterarPendente?: (pendente: boolean) => void;
}) {
  const [entrada, setEntrada] = useState(vazia), [resposta, setResposta] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [versao, setVersao] = useState(0), [pendente, setPendente] = useState(false);
  const contextoChave = JSON.stringify(contexto), geracao = useRef(0), emCurso = useRef(false);
  const callbackPendente = useRef(aoAlterarPendente); callbackPendente.current = aoAlterarPendente;
  const tentativa = useRef<{ fingerprint: string; operationId: string } | null>(null);
  useEffect(() => { callbackPendente.current?.(pendente); }, [pendente]);
  useEffect(() => {
    const g = ++geracao.current, abort = new AbortController();
    setCarregando(true); setResposta(null); setEntrada(vazia()); setErro(""); setAviso(""); setPendente(false); emCurso.current = false; setOcupado(false); tentativa.current = null;
    void api.preConsulta(contexto, abort.signal).then(r => {
      if (g === geracao.current) { setResposta(r); setEntrada(r.rascunho?.entrada ?? vazia()); }
    }).catch(e => { if (g === geracao.current && !abort.signal.aborted) setErro(e instanceof Error ? e.message : "Pré-consulta indisponível."); })
      .finally(() => { if (g === geracao.current) setCarregando(false); });
    return () => { geracao.current++; abort.abort(); callbackPendente.current?.(false); };
  }, [api, contextoChave, versao]);
  function editar(patch: Partial<EntradaPreConsultaMedica>) { setEntrada(atual => ({ ...atual, ...patch })); setPendente(true); setAviso(""); }
  const atual = resposta && JSON.stringify(resposta.contexto) === contextoChave ? resposta : null;
  async function salvar() {
    if (emCurso.current || carregando || !atual) return;
    const g = geracao.current, pedido = { contexto, expectedVersion: atual.rascunho?.versao ?? 0, entrada };
    const fingerprint = JSON.stringify(pedido);
    if (tentativa.current?.fingerprint !== fingerprint) tentativa.current = { fingerprint, operationId: crypto.randomUUID() };
    emCurso.current = true; setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await api.salvarPreConsulta({ ...pedido, operationId: tentativa.current.operationId });
      if (g !== geracao.current) return;
      setResposta(r); setPendente(false); tentativa.current = null; setAviso("Pré-consulta salva como rascunho. Nenhum diagnóstico ou documento foi assinado.");
    } catch (e) { if (g === geracao.current) setErro(`${e instanceof Error ? e.message : "Falha ao salvar"}. Sua edição permanece nesta tela.`); }
    finally { if (g === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }
  async function confirmar() {
    if (emCurso.current || pendente || !atual?.rascunho || atual.rascunho.confirmado) return;
    const g = geracao.current;
    emCurso.current = true; setOcupado(true); setErro("");
    try {
      await api.confirmarPreConsulta({ contexto, draftId: atual.rascunho.draftId, expectedVersion: atual.rascunho.versao, conteudoHash: atual.rascunho.conteudoHash });
      if (g !== geracao.current) return;
      setResposta({ ...atual, rascunho: { ...atual.rascunho, confirmado: true } });
      setAviso("Relato revisado registrado como anotação médica na evolução. Documentos ainda dependem de revisão e assinatura."); aoRegistrar?.();
    } catch (e) { if (g === geracao.current) setErro(e instanceof Error ? e.message : "Registro não confirmado."); }
    finally { if (g === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }
  return <section className="consultorio-medico" aria-label="Pré-consulta médica" aria-busy={ocupado || carregando}>
    <header><h2>Pré-consulta</h2><p>Registre o relato recebido e as observações do médico. Campo vazio permanece não informado; não significa negativa.</p></header>
    {erro ? <p role="alert">{erro}</p> : null}{aviso ? <p role="status">{aviso}</p> : null}
    {carregando ? <p role="status">Recuperando pré-consulta…</p> : <>
      <div className="medico-campos">{Object.entries(campos).map(([campo, rotulo]) => <label key={campo}>{rotulo}
        <small>{entrada[campo as keyof typeof campos].length}/{LIMITE_CAMPO_PRECONSULTA} caracteres</small>
        <textarea aria-label={rotulo} value={entrada[campo as keyof typeof campos]} disabled={ocupado || !atual} maxLength={LIMITE_CAMPO_PRECONSULTA} onChange={e => editar({ [campo]: e.target.value })} /></label>)}</div>
      <div className="medico-campos">
        <label>Peso em kg<input type="number" min="0.1" max="500" step="0.1" disabled={ocupado || !atual} value={entrada.pesoKg ?? ""}
          onChange={e => editar({ pesoKg: e.target.value ? Number(e.target.value) : null, origemPeso: e.target.value ? (entrada.origemPeso === "NAO_INFORMADO" ? "INFORMADO_PACIENTE" : entrada.origemPeso) : "NAO_INFORMADO" })} /></label>
        <label>Origem do peso<select value={entrada.origemPeso} disabled={ocupado || !atual || entrada.pesoKg === null} onChange={e => editar({ origemPeso: e.target.value as EntradaPreConsultaMedica["origemPeso"] })}>
          {entrada.pesoKg === null ? <option value="NAO_INFORMADO">Não informado</option> : null}<option value="INFORMADO_PACIENTE">Informado pelo paciente</option><option value="MEDIDO">Medido</option></select></label>
        <label>Altura em cm<input type="number" min="1" max="300" step="0.1" disabled={ocupado || !atual} value={entrada.alturaCm ?? ""}
          onChange={e => editar({ alturaCm: e.target.value ? Number(e.target.value) : null })} /></label>
      </div>
      <div className="medico-acoes"><button disabled={ocupado || !atual} onClick={() => void salvar()}>Salvar pré-consulta</button>
        <button disabled={ocupado} onClick={() => setVersao(v => v + 1)}>Recuperar versão salva</button></div>
      {pendente ? <p role="status">Há alterações locais não salvas.</p> : null}
      {atual?.rascunho && !pendente ? <section aria-label="Prévia do relato revisado"><h3>Versão {atual.rascunho.versao} · {atual.rascunho.autor}</h3>
        <pre>{atual.rascunho.texto}</pre><button disabled={ocupado || atual.rascunho.confirmado} onClick={() => void confirmar()}>
          {atual.rascunho.confirmado ? "Relato já registrado na evolução" : "Registrar relato revisado na evolução"}</button></section> : null}
    </>}
  </section>;
}
