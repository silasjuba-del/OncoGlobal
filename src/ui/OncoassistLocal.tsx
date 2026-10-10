import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { criarPortaHttp, type OpcoesHttp } from "./api/http.js";
import { criarChaves } from "./api/chaves.js";
import type { PedidoBundle, PortaConsulta } from "./api/porta.js";
import { PainelOncoassist } from "./consulta/PainelOncoassist.js";
import { RevisaoExtracaoLocal } from "./consulta/RevisaoExtracaoLocal.js";
import { TelaSalao } from "./telas/TelaSalao.js";
import { CaixaCanal } from "./telas/canal/CaixaCanal.js";
import { ConsultaPersistida } from "./consulta/ConsultaPersistida.js";
import { TelaApacLote } from "./telas/apac/TelaApacLote.js";
import { Configuracoes } from "./oncochart/Configuracoes.js";

const agendaSchema = z.object({ itens: z.array(z.object({ patientId: z.string().min(1), encounterId: z.string().min(1).optional(), nome: z.string(), horario: z.string() })) });
const consultaSchema = z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), tumorLotId: z.string().nullable() });

/** Explicit real-server view; never mounts the synthetic clinical chart. */
export function OncoassistLocal({ fabricaPorta = criarPortaHttp }: {
  fabricaPorta?: (opcoes: OpcoesHttp) => PortaConsulta;
}) {
  const [senha, setSenha] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [sessao, setSessao] = useState(0);
  const [agenda, setAgenda] = useState<z.infer<typeof agendaSchema>["itens"]>([]);
  const [selecionado, setSelecionado] = useState("");
  const [contexto, setContexto] = useState<PedidoBundle | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [tela, setTela] = useState<"consulta" | "salao" | "canal" | "apac" | "config">("consulta");
  const geracao = useRef(0);
  const chaves = useMemo(() => criarChaves(), []);
  const pacienteAtivo = agenda.find((item) => item.patientId === contexto?.patientId);

  const limpar = useCallback(() => {
    geracao.current++;
    setSenha(""); setAutenticado(false); setAgenda([]); setSelecionado(""); setTela("consulta");
    setContexto(null); setOcupado(false); setSessao((s) => s + 1);
  }, []);
  const expirar = useCallback(() => { limpar(); setMensagem("Sessão expirada. Entre novamente."); }, [limpar]);
  const porta = useMemo(() => fabricaPorta({ onSessaoExpirada: expirar }), [fabricaPorta, expirar, sessao]);
  useEffect(() => () => { geracao.current++; }, []);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    if (ocupado || senha.length < 12 || senha.length > 512) return;
    const atual = ++geracao.current;
    const segredo = senha;
    setSenha(""); setMensagem(""); setOcupado(true);
    try {
      const login = await porta.login(segredo);
      if (atual !== geracao.current) return;
      if (!login.ok) { setMensagem("Senha não aceita."); return; }
      const lista = agendaSchema.safeParse(await porta.agendaDoDia());
      if (atual !== geracao.current) return;
      if (!lista.success) { setMensagem("Não foi possível carregar a agenda local."); return; }
      setAgenda(lista.data.itens); setAutenticado(true);
    } catch {
      if (atual === geracao.current) setMensagem("Não foi possível conectar ao servidor local.");
    } finally { if (atual === geracao.current) setOcupado(false); }
  }

  async function abrir(patientId: string) {
    const atual = ++geracao.current;
    setSelecionado(patientId); setContexto(null); setMensagem("");
    if (!patientId) return;
    setOcupado(true);
    try {
      try {
        const consulta = consultaSchema.safeParse(await porta.carregarConsulta(patientId));
        if (atual !== geracao.current) return;
        if (consulta.success && consulta.data.patientId === patientId) {
          setContexto(consulta.data); return;
        }
      } catch { /* An active appointment can start a new encounter without prior clinical events. */ }
      const agendaEntry = agenda.find((item) => item.patientId === patientId);
      if (!agendaEntry?.encounterId || !porta.selecionarContexto) {
        setMensagem("Consulta local indisponível para este paciente."); return;
      }
      await porta.selecionarContexto({ patientId, encounterId: agendaEntry.encounterId, tumorLotId: null });
      if (atual !== geracao.current) return;
      setContexto({ patientId, encounterId: agendaEntry.encounterId, tumorLotId: null });
      setMensagem("Contexto da agenda selecionado. A revisão continua pendente até a decisão médica.");
    } catch {
      if (atual === geracao.current) setMensagem("Não foi possível abrir a consulta local.");
    } finally { if (atual === geracao.current) setOcupado(false); }
  }

  return <main aria-label="OncoAssist local" style={{ maxWidth: 1200, margin: "2rem auto", padding: "1rem" }}>
    <h1>OncoAssist local</h1>
    <p>Documentos do servidor local. Sugestões aguardam revisão médica.</p>
    <a href="/">Voltar à demonstração</a>
    {mensagem ? <p role="status">{mensagem}</p> : null}
    {!autenticado ? <form onSubmit={(event) => void entrar(event)}>
      <label>Senha do servidor <input type="password" autoComplete="current-password" value={senha}
        minLength={12} maxLength={512} required disabled={ocupado} onChange={(e) => setSenha(e.target.value)} /></label>
      <button type="submit" disabled={ocupado || senha.length < 12}>{ocupado ? "Conectando…" : "Entrar"}</button>
    </form> : <>
      <button type="button" onClick={() => { limpar(); setMensagem(""); }}>Sair</button>
      {agenda.length === 0 ? <p>Nenhum paciente na agenda local de hoje.</p> : <label>Paciente da agenda
        <select aria-label="Paciente da agenda" value={selecionado} disabled={ocupado}
          onChange={(e) => void abrir(e.target.value)}>
          <option value="">Selecione um paciente</option>
          {agenda.map((p) => <option key={p.patientId} value={p.patientId}>{p.horario} — {p.nome}</option>)}
        </select>
      </label>}
      <nav aria-label="Áreas clínicas">
        <button type="button" disabled={ocupado} onClick={() => setTela("consulta")}>Consulta</button>
        <button type="button" disabled={ocupado} onClick={() => setTela("salao")}>Salão</button>
        <button type="button" disabled={ocupado} onClick={() => setTela("canal")}>Canal</button>
        <button type="button" disabled={ocupado} onClick={() => setTela("apac")}>APAC</button>
        <button type="button" disabled={ocupado} onClick={() => setTela("config")}>Configurações Flash</button>
      </nav>
      {ocupado ? <p role="status">Abrindo consulta…</p> : null}
      {tela === "consulta" && contexto ? <div key={`${contexto.patientId}:${contexto.encounterId}:${contexto.tumorLotId ?? ""}`}>
        <RevisaoExtracaoLocal porta={porta} contexto={contexto}
          {...(pacienteAtivo ? { patientLabel: pacienteAtivo.nome } : {})} />
        <PainelOncoassist porta={porta} contexto={contexto} />
        <ConsultaPersistida porta={porta} contexto={contexto} aoAbrirApac={() => setTela("apac")} />
      </div> : null}
      {tela === "salao" ? <TelaSalao porta={porta} /> : null}
      {tela === "apac" ? <TelaApacLote porta={porta} chaves={chaves} /> : null}
      {tela === "config" ? <Configuracoes somenteFlash incluirServico porta={porta} tema="dia"
        onTema={() => {}} onFechar={() => setTela("consulta")} /> : null}
      {tela === "canal" ? <><p>Contexto ativo para vínculo: {pacienteAtivo
        ? `${pacienteAtivo.nome} · ${pacienteAtivo.patientId} · ${pacienteAtivo.encounterId}`
        : contexto ? `${contexto.patientId} · ${contexto.encounterId}` : "selecione na agenda"}</p>
        <CaixaCanal porta={porta} chaves={chaves} /></> : null}
    </>}
  </main>;
}
