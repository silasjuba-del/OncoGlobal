import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { criarPortaHttp, type OpcoesHttp } from "./api/http.js";
import type { PedidoBundle, PortaConsulta } from "./api/porta.js";
import { PainelOncoassist } from "./consulta/PainelOncoassist.js";

const agendaSchema = z.object({ itens: z.array(z.object({ patientId: z.string().min(1), nome: z.string(), horario: z.string() })) });
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
  const geracao = useRef(0);

  const limpar = useCallback(() => {
    geracao.current++;
    setSenha(""); setAutenticado(false); setAgenda([]); setSelecionado("");
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
      const consulta = consultaSchema.safeParse(await porta.carregarConsulta(patientId));
      if (atual !== geracao.current) return;
      if (!consulta.success || consulta.data.patientId !== patientId) {
        setMensagem("Consulta local indisponível para este paciente."); return;
      }
      setContexto(consulta.data);
    } catch {
      if (atual === geracao.current) setMensagem("Não foi possível abrir a consulta local.");
    } finally { if (atual === geracao.current) setOcupado(false); }
  }

  return <main aria-label="OncoAssist local" style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
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
      {ocupado ? <p role="status">Abrindo consulta…</p> : null}
      {contexto ? <PainelOncoassist key={`${contexto.patientId}:${contexto.encounterId}:${contexto.tumorLotId ?? ""}`}
        porta={porta} contexto={contexto} /> : null}
    </>}
  </main>;
}
