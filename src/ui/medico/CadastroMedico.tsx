import { useEffect, useRef, useState, type FormEvent } from "react";
import type { z } from "zod";
import type { ApiConsultorioMedico, CadastroPacienteMedicoResposta, ContextoConsultorio, DadosCadastroMedico } from "../../contracts/api/consultorioMedico.js";
// @ts-expect-error folha CSS pura resolvida pelo Vite
import "./consultorio-medico.css";

type Dados = z.infer<typeof DadosCadastroMedico>;
type Resposta = z.infer<typeof CadastroPacienteMedicoResposta>;
const vazio = (): Dados => ({ nome: "", nascimento: null, sexoCadastral: "NAO_INFORMADO", identificadores: [] });
const extrairDados = (r: Resposta): Dados => ({ nome: r.paciente.nome, nascimento: r.paciente.nascimento,
  sexoCadastral: r.paciente.sexoCadastral, identificadores: r.paciente.identificadores.map(i => ({ ...i })) });

export function CadastroMedico({ api, contexto, aoAtualizar, aoAlterarPendente }: {
  api: ApiConsultorioMedico; contexto: ContextoConsultorio; aoAtualizar?: (nome: string) => void;
  aoAlterarPendente?: (pendente: boolean) => void;
}) {
  const [resposta, setResposta] = useState<Resposta | null>(null), [dados, setDados] = useState(vazio);
  const [motivo, setMotivo] = useState(""), [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(true), [ocupado, setOcupado] = useState(false), [versao, setVersao] = useState(0), [pendente, setPendente] = useState(false);
  const geracao = useRef(0), emCurso = useRef(false), contextoChave = JSON.stringify(contexto);
  const callback = useRef(aoAlterarPendente); callback.current = aoAlterarPendente;
  const tentativa = useRef<{ fingerprint: string; operationId: string } | null>(null);
  const marcarPendente = (valor: boolean) => { setPendente(valor); callback.current?.(valor); };
  useEffect(() => {
    const g = ++geracao.current, abort = new AbortController();
    setResposta(null); setDados(vazio()); setMotivo(""); setErro(""); setAviso(""); setCarregando(true); setOcupado(false); emCurso.current = false; tentativa.current = null;
    setPendente(false); callback.current?.(false);
    void api.paciente(contexto, abort.signal).then(r => {
      if (g === geracao.current && JSON.stringify(r.contexto) === contextoChave) { setResposta(r); setDados(extrairDados(r)); }
    }).catch(e => { if (g === geracao.current && !abort.signal.aborted) setErro(e instanceof Error ? e.message : "Cadastro indisponível."); })
      .finally(() => { if (g === geracao.current) setCarregando(false); });
    return () => { geracao.current++; abort.abort(); callback.current?.(false); };
  }, [api, contextoChave, versao]);
  const atual = resposta && JSON.stringify(resposta.contexto) === contextoChave ? resposta : null;
  const editar = (patch: Partial<Dados>) => { setDados(d => ({ ...d, ...patch })); marcarPendente(true); setAviso(""); };
  async function confirmar(e: FormEvent) {
    e.preventDefault(); if (emCurso.current || carregando || !atual || !motivo.trim()) return;
    const g = geracao.current, pedido = { contexto, expectedEventId: atual.eventId, dados, motivo: motivo.trim() }, fingerprint = JSON.stringify(pedido);
    if (tentativa.current?.fingerprint !== fingerprint) tentativa.current = { fingerprint, operationId: crypto.randomUUID() };
    emCurso.current = true; setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await api.alterarPaciente({ ...pedido, operationId: tentativa.current.operationId });
      if (g !== geracao.current || JSON.stringify(r.contexto) !== contextoChave) return;
      setResposta(r); setDados(extrairDados(r)); setMotivo(""); marcarPendente(false); tentativa.current = null;
      setAviso("Cadastro corrigido com histórico. Documentos e assinaturas anteriores foram preservados."); aoAtualizar?.(r.paciente.nome);
    } catch (e) { if (g === geracao.current) setErro(`${e instanceof Error ? e.message : "Correção não confirmada"}. Os campos editados foram preservados.`); }
    finally { if (g === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }
  return <section className="consultorio-medico" aria-label="Cadastro médico do paciente" aria-busy={ocupado || carregando}>
    <header><h2>Cadastro do paciente</h2><p>A correção conserva a identidade do prontuário e o histórico cadastral. Não reescreve documentos assinados.</p></header>
    <p>Identidade do prontuário: <code>{contexto.patientId}</code></p>
    {erro ? <p role="alert">{erro}</p> : null}{aviso ? <p role="status">{aviso}</p> : null}
    {carregando ? <p role="status">Recuperando cadastro…</p> : <form onSubmit={confirmar} aria-label="Corrigir cadastro">
      <div className="medico-campos"><label>Nome cadastral<input required maxLength={300} value={dados.nome} disabled={ocupado || !atual} onChange={e => editar({ nome: e.target.value })} /></label>
        <label>Data de nascimento cadastral<input type="date" value={dados.nascimento ?? ""} disabled={ocupado || !atual} onChange={e => editar({ nascimento: e.target.value || null })} /></label>
        <label>Sexo cadastral do paciente<select value={dados.sexoCadastral} disabled={ocupado || !atual} onChange={e => editar({ sexoCadastral: e.target.value as Dados["sexoCadastral"] })}>
          <option value="NAO_INFORMADO">Não informado</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="OUTRO">Outro</option></select></label></div>
      <fieldset disabled={ocupado || !atual}><legend>Identificadores cadastrados</legend>
        {dados.identificadores.map((identificador, indice) => <div className="medico-campos" key={indice}>
          <label>Tipo do identificador {indice + 1}<select value={identificador.tipo} onChange={e => editar({ identificadores: dados.identificadores.map((i, n) => n === indice ? { ...i, tipo: e.target.value as typeof i.tipo } : i) })}>
            <option>PRONTUARIO</option><option>CPF</option><option>CNS</option></select></label>
          <label>Valor do identificador {indice + 1}<input required maxLength={120} value={identificador.valor} onChange={e => editar({ identificadores: dados.identificadores.map((i, n) => n === indice ? { ...i, valor: e.target.value } : i) })} /></label>
          <button type="button" onClick={() => editar({ identificadores: dados.identificadores.filter((_, n) => n !== indice) })}>Remover identificador {indice + 1}</button>
        </div>)}
        <button type="button" disabled={dados.identificadores.length >= 20} onClick={() => editar({ identificadores: [...dados.identificadores, { tipo: "PRONTUARIO", valor: "" }] })}>Adicionar identificador</button>
      </fieldset>
      <label>Motivo da correção cadastral<textarea required maxLength={1000} value={motivo} disabled={ocupado || !atual} onChange={e => { setMotivo(e.target.value); marcarPendente(true); }} /></label>
      {pendente ? <p role="status">Correção ainda não registrada.</p> : null}
      <div className="medico-acoes"><button disabled={ocupado || !atual || !motivo.trim()} type="submit">Confirmar correção cadastral</button>
        <button disabled={ocupado} type="button" onClick={() => setVersao(v => v + 1)}>Descartar edição e recuperar cadastro</button></div>
    </form>}
    {atual ? <details><summary>Histórico cadastral ({atual.historico.length})</summary><ul className="medico-lista">{atual.historico.map(h => <li key={h.eventId}>
      <strong>{h.paciente.nome}</strong><span>Nascimento: {h.paciente.nascimento ?? "Não informado"} · {h.paciente.sexoCadastral}</span>
      <span>{h.registradoEm} · Autor: {h.autor}</span><span>{h.motivo ?? "Cadastro inicial ou motivo não registrado na origem"}</span>
      <span>{h.paciente.identificadores.map(i => `${i.tipo}: ${i.valor}`).join(" · ") || "Sem identificadores informados"}</span>
    </li>)}</ul></details> : null}
  </section>;
}
