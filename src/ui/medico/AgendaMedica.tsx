import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AgendaMedicaResposta, ApiConsultorioMedico, ContextoConsultorio } from "../../contracts/api/consultorioMedico.js";
// @ts-expect-error folha CSS pura resolvida pelo Vite
import "./consultorio-medico.css";

const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
type Item = AgendaMedicaResposta["itens"][number];

export function AgendaMedica({ api, onSelecionar, aoAtualizar, aoAlterarPendente, aoAlterarSalvando }: {
  aoAlterarPendente?: (valor: boolean) => void; aoAlterarSalvando?: (valor: boolean) => void;
  api: ApiConsultorioMedico; onSelecionar: (contexto: ContextoConsultorio, nome?: string) => void; aoAtualizar?: () => void;
}) {
  const [inicio, setInicio] = useState(hojeLocal), [fim, setFim] = useState(hojeLocal);
  const [visao, setVisao] = useState<AgendaMedicaResposta | null>(null), [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(""), [ocupado, setOcupado] = useState(false), [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState(false), [patientId, setPatientId] = useState("");
  const [nome, setNome] = useState(""), [nascimento, setNascimento] = useState(""), [sexo, setSexo] = useState<"F" | "M" | "OUTRO" | "NAO_INFORMADO">("NAO_INFORMADO");
  const [tipoId, setTipoId] = useState<"PRONTUARIO" | "CPF" | "CNS">("PRONTUARIO"), [identificador, setIdentificador] = useState("");
  const [data, setData] = useState(hojeLocal), [horario, setHorario] = useState("09:00"), [tarefaRetornoId, setTarefaRetornoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Item | null>(null), [motivo, setMotivo] = useState("");
  const [pendenteCadastro, setPendenteCadastro] = useState(false), [pendenteAlteracao, setPendenteAlteracao] = useState(false);
  const pendente = pendenteCadastro || pendenteAlteracao;
  useEffect(() => { aoAlterarPendente?.(pendente); return () => aoAlterarPendente?.(false); }, [pendente, aoAlterarPendente]);
  useEffect(() => { aoAlterarSalvando?.(ocupado); return () => aoAlterarSalvando?.(false); }, [ocupado, aoAlterarSalvando]);
  const emCurso = useRef(false), geracao = useRef(0), tentativa = useRef<{ fingerprint: string; operationId: string } | null>(null);
  useEffect(() => {
    const g = ++geracao.current, abort = new AbortController();
    setErro("");
    void api.agenda({ inicio, fim }, abort.signal).then(r => { if (g === geracao.current) setVisao(r); })
      .catch(e => { if (g === geracao.current && !abort.signal.aborted) setErro(e instanceof Error ? e.message : "Agenda indisponível."); });
    return () => { geracao.current++; abort.abort(); };
  }, [api, inicio, fim, versao]);
  function chave(pedido: unknown) {
    const fingerprint = JSON.stringify(pedido);
    if (tentativa.current?.fingerprint !== fingerprint) tentativa.current = { fingerprint, operationId: crypto.randomUUID() };
    return tentativa.current.operationId;
  }
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (emCurso.current) return;
    const pedido = novo ? { paciente: { nome: nome.trim(), nascimento: nascimento || null, sexoCadastral: sexo,
      identificadores: identificador.trim() ? [{ tipo: tipoId, valor: identificador.trim() }] : [] }, data, horario }
      : { patientId, data, horario, ...(tarefaRetornoId ? { tarefaRetornoId } : {}) };
    if (novo ? !nome.trim() : !patientId) { setErro("Informe o paciente antes de agendar."); return; }
    emCurso.current = true; setOcupado(true); setErro(""); setAviso("");
    try {
      const operationId = chave(pedido);
      const r = pedido.paciente ? await api.cadastrar({ paciente: pedido.paciente, data, horario, operationId })
        : await api.agendar({ patientId, data, horario, operationId, ...(tarefaRetornoId ? { tarefaRetornoId } : {}) });
      setAviso("Paciente e encontro gravados. Abra a consulta quando desejar.");
      setPatientId(r.contexto.patientId); setNovo(false); setTarefaRetornoId(null); tentativa.current = null;
      setPendenteCadastro(false); setVersao(v => v + 1); aoAtualizar?.();
    } catch (e) { setErro(`${e instanceof Error ? e.message : "Operação não concluída"}. Os campos foram preservados.`); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  async function alterar(acao: "REMARCAR" | "CANCELAR") {
    if (!edicao || !motivo.trim() || emCurso.current) return;
    const pedido = { patientId: edicao.patientId, encounterId: edicao.encounterId, expectedEventId: edicao.eventId,
      acao, motivo: motivo.trim(), ...(acao === "REMARCAR" ? { data, horario } : {}) };
    emCurso.current = true; setOcupado(true); setErro(""); setAviso("");
    try {
      await api.alterarAgenda({ ...pedido, operationId: chave(pedido) });
      setAviso(acao === "REMARCAR" ? "Encontro remarcado; histórico preservado." : "Encontro cancelado; prontuário e histórico preservados.");
      setPendenteAlteracao(false); setEdicao(null); tentativa.current = null; setVersao(v => v + 1); aoAtualizar?.();
    } catch (e) { setErro(e instanceof Error ? e.message : "Operação não concluída."); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  return <section className="consultorio-medico" aria-label="Agenda médica">
    <header><h2>Agenda e pacientes</h2><p>Organize o atendimento sem alterar o conteúdo clínico dos encontros anteriores.</p></header>
    <div className="medico-campos"><label>Início da agenda<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
      <label>Fim da agenda<input type="date" value={fim} onChange={e => setFim(e.target.value)} /></label>
      <button type="button" onClick={() => setVersao(v => v + 1)}>Atualizar agenda</button></div>
    {erro ? <p role="alert">{erro}</p> : null}{aviso ? <p role="status">{aviso}</p> : null}
    <form onChange={e => { const campo = e.target.getAttribute("name") ?? "";
      if (edicao && ["data-encontro", "horario-encontro"].includes(campo)) setPendenteAlteracao(true); else setPendenteCadastro(true); }} onSubmit={salvar} aria-label="Cadastrar ou agendar paciente">
      <label><input type="checkbox" checked={novo} disabled={ocupado} onChange={e => { setNovo(e.target.checked); setTarefaRetornoId(null); }} />Cadastrar novo paciente</label>
      {novo ? <div className="medico-campos">
        <label>Nome do paciente<input required value={nome} disabled={ocupado} onChange={e => setNome(e.target.value)} /></label>
        <label>Nascimento<input type="date" value={nascimento} disabled={ocupado} onChange={e => setNascimento(e.target.value)} /></label>
        <label>Sexo cadastral<select value={sexo} disabled={ocupado} onChange={e => setSexo(e.target.value as typeof sexo)}>
          <option value="NAO_INFORMADO">Não informado</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="OUTRO">Outro</option></select></label>
        <label>Tipo de identificador<select value={tipoId} disabled={ocupado} onChange={e => setTipoId(e.target.value as typeof tipoId)}>
          <option>PRONTUARIO</option><option>CPF</option><option>CNS</option></select></label>
        <label>Identificador (opcional)<input value={identificador} disabled={ocupado} onChange={e => setIdentificador(e.target.value)} /></label>
        <p>Nome semelhante não une prontuários. Confira a identidade antes de cadastrar.</p>
      </div> : <label>Paciente para agendamento<select required value={patientId} disabled={ocupado} onChange={e => { setPatientId(e.target.value); setTarefaRetornoId(null); }}>
        <option value="">Selecione</option>{visao?.pacientes.map(p => <option key={p.patientId} value={p.patientId}>{p.nome} · {p.patientId}</option>)}</select></label>}
      <div className="medico-campos"><label>Data do encontro<input name="data-encontro" type="date" required value={data} disabled={ocupado} onChange={e => setData(e.target.value)} /></label>
        <label>Horário do encontro<input name="horario-encontro" type="time" required value={horario} disabled={ocupado} onChange={e => setHorario(e.target.value)} /></label></div>
      {tarefaRetornoId ? <p>Retorno selecionado: {tarefaRetornoId}. Confira a data e o horário.</p> : null}
      <button disabled={ocupado} type="submit">{novo ? "Cadastrar e agendar" : "Confirmar agendamento"}</button>
    </form>
    {edicao ? <section aria-label="Alterar encontro"><h3>Alterar encontro de {edicao.nome}</h3>
      <p>Atual: {edicao.data} às {edicao.horario}. Para remarcar, ajuste Data e Horário do encontro acima.</p>
      <label>Motivo da alteração<input value={motivo} disabled={ocupado} onChange={e => setMotivo(e.target.value)} /></label>
      <div className="medico-acoes"><button disabled={ocupado || !motivo.trim()} onClick={() => void alterar("REMARCAR")}>Confirmar remarcação</button>
        <button disabled={ocupado || !motivo.trim()} onClick={() => void alterar("CANCELAR")}>Confirmar cancelamento do encontro</button>
        <button disabled={ocupado} onClick={() => { setEdicao(null); setPendenteAlteracao(false); }}>Manter encontro</button></div></section> : null}
    <ul className="medico-lista">{visao?.itens.map(item => <li key={item.eventId}>
      <strong>{item.data} · {item.horario} · {item.nome}</strong><span>{item.cancelado ? `Cancelado: ${item.motivo}` : `Pré-consulta: ${item.preConsulta}`}</span>
      <div className="medico-acoes"><button disabled={ocupado} onClick={() => onSelecionar({ patientId: item.patientId, encounterId: item.encounterId, tumorLotId: null }, item.nome)}>Abrir consulta de {item.nome}</button>
        {!item.cancelado ? <button disabled={ocupado} onClick={() => { setPendenteAlteracao(true); setEdicao(item); setData(item.data); setHorario(item.horario); setMotivo(""); }}>Remarcar ou cancelar</button> : null}</div>
    </li>)}</ul>
    {visao && !visao.itens.length ? <p>Nenhum encontro neste intervalo.</p> : null}
    {visao?.retornos.length ? <section aria-label="Retornos a agendar"><h3>Retornos propostos em documentos</h3>
      <ul>{visao.retornos.map(t => <li key={t.tarefaId}>{visao.pacientes.find(p => p.patientId === t.patientId)?.nome ?? t.patientId} · {t.titulo} · {t.dataAlvo ?? "Data a definir"}
        <button disabled={ocupado} onClick={() => { setPendenteCadastro(true); setNovo(false); setPatientId(t.patientId); setTarefaRetornoId(t.tarefaId); if (t.dataAlvo) setData(t.dataAlvo); }}>Preparar agendamento do retorno</button></li>)}</ul></section> : null}
  </section>;
}
