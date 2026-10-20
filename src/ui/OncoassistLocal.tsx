import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { TumorLot } from '../contracts/clinico.js';
import { criarPortaHttp, type OpcoesHttp } from "./api/http.js";
import { criarChaves } from "./api/chaves.js";
import type { PedidoBundle, PortaConsulta } from "./api/porta.js";
import {ErroPorta} from './api/porta.js';
import {LotesPacienteResposta} from '../contracts/api/lotes.js';
import { PainelOncoassist } from "./consulta/PainelOncoassist.js";
import { ReconciliarMedicamentos } from "./consulta/ReconciliarMedicamentos.js";
import { SinteseProposta } from "./consulta/SinteseProposta.js";
import { RevisaoExtracaoLocal } from "./consulta/RevisaoExtracaoLocal.js";
import { TelaSalao } from "./telas/TelaSalao.js";
import { CaixaCanal } from "./telas/canal/CaixaCanal.js";
import { ConsultaPersistida } from "./consulta/ConsultaPersistida.js";
import { TelaApacLote } from "./telas/apac/TelaApacLote.js";
import { Configuracoes } from "./oncochart/Configuracoes.js";
import { BibliotecaLocal } from "./biblioteca/BibliotecaLocal.js";
import { UploadDocumentoLocal } from "./consulta/UploadDocumentoLocal.js";
import { TranscricaoLocal } from "./consulta/TranscricaoLocal.js";
import { RevisaoClinica } from './consulta/RevisaoClinica.js';
import { contarClique, etapaDoClique, metricasVazias } from './consulta/metricasConsulta.js';
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./consulta/consulta-local.css";

const agendaSchema = z.object({ itens: z.array(z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), nome: z.string(), horario: z.string() })) });
const consultaSchema = z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), tumorLotId: z.string().nullable(),
  cabecalho:z.object({lotes:z.array(TumorLot)}).passthrough().optional() });

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
  const [lotes,setLotes]=useState<z.infer<typeof TumorLot>[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [versaoFontes,setVersaoFontes]=useState(0);
  const [versaoConsulta,setVersaoConsulta]=useState(0);
  const [metricas,setMetricas]=useState(metricasVazias);
  const [transcricaoPendente,setTranscricaoPendente]=useState(false);
  const [transcricaoSalvando,setTranscricaoSalvando]=useState(false);
  const removerProtecaoDocumento=useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!transcricaoPendente && !transcricaoSalvando) return;
    const proteger = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", proteger);
    const remover = () => {
      window.removeEventListener("beforeunload", proteger);
      if (removerProtecaoDocumento.current === remover) removerProtecaoDocumento.current = null;
    };
    removerProtecaoDocumento.current = remover;
    return remover;
  }, [transcricaoPendente, transcricaoSalvando]);
  const [mensagemSalvamento,setMensagemSalvamento]=useState("");
  const [navegacaoPendente,setNavegacaoPendente]=useState<(() => void) | null>(null);
  const dialogoNavegacao=useRef<HTMLDivElement>(null);
  const focoAnterior=useRef<HTMLElement|null>(null);
  const restaurarFoco=useRef(false);
  useEffect(()=>setMetricas(metricasVazias()),[contexto?.patientId,contexto?.encounterId,contexto?.tumorLotId]);
  const [mensagem, setMensagem] = useState("");
  const [tela, setTela] = useState<"consulta" | "salao" | "canal" | "apac" | "config" | "biblioteca">("consulta");
  const geracao = useRef(0);
  const chaves = useMemo(() => criarChaves(), []);
  const contextoAtual=useRef(contexto); contextoAtual.current=contexto;
  const geracaoTela=geracao.current;
  const pacienteAtivo = agenda.find((item) => item.patientId === contexto?.patientId && item.encounterId === contexto?.encounterId);

  const limpar = useCallback(() => {
    removerProtecaoDocumento.current?.();
    geracao.current++;
    setSenha(""); setAutenticado(false); setAgenda([]); setSelecionado(""); setTela("consulta");
    setContexto(null); setLotes([]); setOcupado(false); setVersaoConsulta(0); setTranscricaoPendente(false);
    setTranscricaoSalvando(false); setMensagemSalvamento("");
    setNavegacaoPendente(null); restaurarFoco.current=false; setSessao((s) => s + 1);
  }, []);
  const expirar = useCallback(() => { limpar(); setMensagem("Sessão expirada. Entre novamente."); }, [limpar]);
  const porta = useMemo(() => fabricaPorta({ onSessaoExpirada: expirar }), [fabricaPorta, expirar, sessao]);
  useEffect(() => () => { geracao.current++; }, []);

  function solicitarNavegacaoVoluntaria(navegar: () => void) {
    if (transcricaoSalvando) {
      setMensagemSalvamento("A transcrição está sendo salva. Aguarde a conclusão antes de sair.");
      return;
    }
    if (!transcricaoPendente) { navegar(); return; }
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    restaurarFoco.current=false;
    setNavegacaoPendente(() => navegar);
  }
  function navegarParaTela(proxima: "consulta" | "salao" | "canal" | "apac" | "config" | "biblioteca") {
    if (tela === proxima) return;
    solicitarNavegacaoVoluntaria(() => setTela(proxima));
  }
  function solicitarPaciente(encounterId: string) {
    if (encounterId === selecionado && contexto?.encounterId === encounterId) return;
    solicitarNavegacaoVoluntaria(() => void abrir(encounterId));
  }
  function solicitarLote(tumorLotId: string) {
    if (tumorLotId === (contexto?.tumorLotId ?? "")) return;
    solicitarNavegacaoVoluntaria(() => void selecionarLote(tumorLotId));
  }
  function continuarEditando() {
    restaurarFoco.current=true;
    setNavegacaoPendente(null);
  }
  function descartarEContinuar() {
    if (transcricaoSalvando) return;
    const navegar=navegacaoPendente;
    // O descarte já foi confirmado no diálogo da aplicação. Uma saída de
    // documento síncrona (location.assign) não deve pedir confirmação de novo.
    removerProtecaoDocumento.current?.();
    restaurarFoco.current=false;
    setNavegacaoPendente(null);
    navegar?.();
  }
  useEffect(() => {
    if (!navegacaoPendente) {
      if (restaurarFoco.current) {
        restaurarFoco.current=false;
        if (focoAnterior.current?.isConnected) focoAnterior.current.focus();
      }
      return;
    }
    dialogoNavegacao.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [navegacaoPendente]);
  function registrarSalvamentoTranscricao(salvando: boolean) {
    setTranscricaoSalvando(salvando);
    if (!salvando) setMensagemSalvamento("");
  }

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

  async function abrir(encounterId: string) {
    const entrada = agenda.find(item => item.encounterId === encounterId);
    const patientId = entrada?.patientId ?? "";
    const atual = ++geracao.current;
    setSelecionado(encounterId); setContexto(null); setLotes([]); setMensagem("");
    if (!patientId) return;
    setOcupado(true);
    try {
      try {
        const consulta = consultaSchema.safeParse(await porta.carregarConsulta(patientId, undefined, encounterId));
        if (atual !== geracao.current) return;
        if (consulta.success && consulta.data.patientId === patientId && consulta.data.encounterId === encounterId) {
          setLotes((consulta.data.cabecalho?.lotes??[]).filter(l=>l.patientId===patientId));
          setContexto({patientId:consulta.data.patientId,encounterId:consulta.data.encounterId,tumorLotId:consulta.data.tumorLotId}); return;
        }
      } catch { /* An active appointment can start a new encounter without prior clinical events. */ }
      if(atual!==geracao.current)return;
      const agendaEntry = entrada;
      if (!agendaEntry?.encounterId || !porta.selecionarContexto) {
        setMensagem("Consulta local indisponível para este paciente."); return;
      }
      if(porta.lotesPaciente){
        const resposta=await porta.lotesPaciente(patientId);if(atual!==geracao.current)return;
        const lista=LotesPacienteResposta.parse(resposta);if(lista.patientId!==patientId)throw Error('LOTES_FORA_DO_PACIENTE');
        setLotes(lista.lotes);
      }
      await porta.selecionarContexto({ patientId, encounterId: agendaEntry.encounterId, tumorLotId: null });
      if (atual !== geracao.current) return;
      setContexto({ patientId, encounterId: agendaEntry.encounterId, tumorLotId: null });
      setMensagem("Contexto da agenda selecionado. A revisão continua pendente até a decisão médica.");
    } catch {
      if (atual === geracao.current) setMensagem("Não foi possível abrir a consulta local.");
    } finally { if (atual === geracao.current) setOcupado(false); }
  }

  async function selecionarLote(tumorLotId:string){
    const entrada=agenda.find(e=>e.encounterId===selecionado);
    if(ocupado||!entrada||tumorLotId&&!lotes.some(l=>l.tumorLotId===tumorLotId&&l.patientId===entrada.patientId))return;
    const atual=++geracao.current;setContexto(null);setOcupado(true);setMensagem("");
    try{
      let carregada:unknown;
      try{carregada=await porta.carregarConsulta(entrada.patientId,tumorLotId||null,entrada.encounterId);}
      catch(erro){
        if(atual!==geracao.current)return;
        if(!(erro instanceof ErroPorta)||erro.codigo!=='CONSULTA_NAO_ENCONTRADA'||!porta.selecionarContexto)throw erro;
        const novo={patientId:entrada.patientId,encounterId:entrada.encounterId,tumorLotId:tumorLotId||null};
        await porta.selecionarContexto(novo);if(atual!==geracao.current)return;setContexto(novo);return;
      }
      const r=consultaSchema.safeParse(carregada);
      if(atual!==geracao.current)return;
      if(!r.success||r.data.patientId!==entrada.patientId||r.data.encounterId!==entrada.encounterId||r.data.tumorLotId!==(tumorLotId||null)){
        setMensagem("Não foi possível confirmar o lote desta consulta.");return;
      }
      setLotes((r.data.cabecalho?.lotes??[]).filter(l=>l.patientId===entrada.patientId));
      setContexto({patientId:r.data.patientId,encounterId:r.data.encounterId,tumorLotId:r.data.tumorLotId});
    }catch{if(atual===geracao.current)setMensagem("Não foi possível abrir o lote. Selecione novamente.");}
    finally{if(atual===geracao.current)setOcupado(false);}
  }

  return <main aria-label="OncoAssist local" className="oncoassist-local" onClickCapture={event=>{
    // Deixa o evento do controle concluir antes de renderizar a telemetria local.
    // Atualização síncrona no capture restaura checked antes do onChange no navegador.
    const etapa=etapaDoClique(event.target),atual=geracao.current;
    if(etapa)setTimeout(()=>{if(atual===geracao.current)setMetricas(atuais=>contarClique(atuais,etapa));},0);
  }}>
    <header className="consulta-appbar"><div><h1>OncoAssist local</h1>
      <p>Documentos do servidor local. Sugestões aguardam revisão médica.</p></div>
      <a href="/" onClick={event=>{
        if (!transcricaoPendente && !transcricaoSalvando) return;
        event.preventDefault();
        solicitarNavegacaoVoluntaria(() => window.location.assign("/"));
      }}>Voltar à demonstração</a></header>
    {mensagem ? <p role="status">{mensagem}</p> : null}
    {transcricaoSalvando ? <p role="status">Salvando transcrição. Aguarde a conclusão para navegar.</p> : null}
    {mensagemSalvamento ? <p role="status">{mensagemSalvamento}</p> : null}
    {!autenticado ? <form onSubmit={(event) => void entrar(event)}>
      <label>Senha do servidor <input type="password" autoComplete="current-password" value={senha}
        minLength={12} maxLength={512} required disabled={ocupado} onChange={(e) => setSenha(e.target.value)} /></label>
      <button type="submit" disabled={ocupado || senha.length < 12}>{ocupado ? "Conectando…" : "Entrar"}</button>
    </form> : <>
      <div className="consulta-controles"><button type="button" disabled={transcricaoSalvando} onClick={() => solicitarNavegacaoVoluntaria(() => { limpar(); setMensagem(""); })}>Sair</button>
      {agenda.length === 0 ? <p>Nenhum paciente na agenda local de hoje.</p> : <label>Paciente da agenda
        <select aria-label="Paciente da agenda" value={selecionado} disabled={ocupado || transcricaoSalvando}
          onChange={(e) => solicitarPaciente(e.target.value)}>
          <option value="">Selecione um paciente</option>
          {agenda.map((p) => <option key={p.encounterId} value={p.encounterId}>{p.horario} — {p.nome}</option>)}
        </select>
      </label>}
      {lotes.length?<label>Lote tumoral <select aria-label="Lote tumoral" value={contexto?.tumorLotId??''} disabled={ocupado || transcricaoSalvando}
        onChange={e=>solicitarLote(e.target.value)}>
        <option value="">Consulta sem lote selecionado</option>{lotes.map((l,i)=><option key={l.tumorLotId} value={l.tumorLotId}>
          {`Lote ${i+1} · ${l.cid.valor??'CID não informado'} · ${l.topografia.valor??l.tumorLotId}`}</option>)}
      </select></label>:null}
      <nav aria-label="Áreas clínicas">
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("consulta")}>Consulta</button>
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("salao")}>Salão</button>
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("canal")}>Canal</button>
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("apac")}>APAC</button>
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("config")}>Configurações Flash</button>
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("biblioteca")}>Biblioteca</button>
      </nav>
      </div>
      {ocupado ? <p role="status">Abrindo consulta…</p> : null}
      {tela === "consulta" && contexto ? <div className="consulta-local" key={`${contexto.patientId}:${contexto.encounterId}:${contexto.tumorLotId ?? ""}`}>
        <section className="consulta-identidade" aria-label="Identificação da consulta">
          <div className="consulta-identidade-linha"><strong>{pacienteAtivo?.nome ?? contexto.patientId}</strong>
            <span>{pacienteAtivo?.horario ? `Agenda ${pacienteAtivo.horario}` : "Consulta selecionada"}</span></div>
          <p className="consulta-identificadores">Paciente <b>{contexto.patientId}</b> · Encontro <b>{contexto.encounterId}</b>
            {contexto.tumorLotId ? <> · Lote <b>{contexto.tumorLotId}</b></> : " · Lote tumoral não vinculado"}</p>
          <nav aria-label="Navegar nesta consulta" className="consulta-ancoras">
            <a href="#consulta-documentos">Documentos</a><a href="#consulta-revisao">Revisão da fonte</a>
            <a href="#consulta-fase2">Ficha e packs</a>
            <a href="#consulta-medicamentos">Medicamentos</a><a href="#consulta-sintese">Síntese proposta</a>
            <a href="#consulta-resumo">Visão integrada</a><a href="#consulta-conduta">Conduta e assinatura</a>
            <a href="#consulta-historico">Histórico</a>
          </nav>
        </section>
        <details><summary>Cliques por etapa nesta consulta</summary><ul>{Object.entries(metricas).map(([etapa,cliques])=><li key={etapa}>{etapa}: {cliques}</li>)}</ul></details>
        <div id="consulta-fase2" className="consulta-secao" tabIndex={-1}>
          <RevisaoClinica porta={porta} contexto={contexto} versaoClinica={versaoConsulta} aoRegistrar={()=>setVersaoConsulta(v=>v+1)}/>
        </div>
        <div id="consulta-documentos" className="consulta-secao" tabIndex={-1}>
          <UploadDocumentoLocal porta={porta} contexto={contexto} aoSalvar={()=>setVersaoFontes(v=>v+1)}/>
          <TranscricaoLocal porta={porta} contexto={contexto} aoSalvar={()=>setVersaoFontes(v=>v+1)}
            aoAlterarPendente={setTranscricaoPendente} aoAlterarSalvamento={registrarSalvamentoTranscricao}/>
        </div>
        <div id="consulta-revisao" className="consulta-secao" tabIndex={-1}>
        <RevisaoExtracaoLocal key={versaoFontes} porta={porta} contexto={contexto}
          aoFatosConfirmados={(confirmado)=>{
            const ativo=contextoAtual.current;
            if(geracao.current!==geracaoTela||!ativo||ativo.patientId!==confirmado.patientId||ativo.encounterId!==confirmado.encounterId
              ||ativo.tumorLotId!==confirmado.tumorLotId||!agenda.some(item=>item.patientId===ativo.patientId&&item.encounterId===ativo.encounterId))return;
            setVersaoConsulta(v=>v+1);
          }}
          {...(pacienteAtivo ? { patientLabel: pacienteAtivo.nome } : {})} />
        </div>
        <PainelOncoassist key={`painel:${versaoConsulta}`} porta={porta} contexto={contexto} />
        <div id="consulta-medicamentos" className="consulta-secao" tabIndex={-1}>
        <ReconciliarMedicamentos porta={porta} contexto={{...contexto,tumorLotId:contexto.tumorLotId??null}} aoFatosConfirmados={(confirmado)=>{
          const c=contextoAtual.current;
          if(geracao.current===geracaoTela&&c?.patientId===confirmado.patientId&&c.encounterId===confirmado.encounterId&&(c.tumorLotId??null)===(confirmado.tumorLotId??null)&&agenda.some(item=>item.patientId===c.patientId&&item.encounterId===c.encounterId))setVersaoConsulta(v=>v+1);
        }}/>
        </div>
        <div id="consulta-sintese" className="consulta-secao" tabIndex={-1}>
        <SinteseProposta key={`sintese:${versaoConsulta}`} porta={porta} contexto={contexto}/>
        </div>
        <ConsultaPersistida versaoClinica={versaoConsulta} porta={porta} contexto={contexto}
          aoAbrirApac={() => navegarParaTela("apac")} />
      </div> : null}
      {tela === "salao" ? <TelaSalao porta={porta} /> : null}
      {tela === "apac" ? <TelaApacLote porta={porta} chaves={chaves} /> : null}
      {tela === "config" ? <Configuracoes somenteFlash incluirServico porta={porta} tema="dia"
        onTema={() => {}} onFechar={() => navegarParaTela("consulta")} /> : null}
      {tela === "biblioteca" ? (porta.biblioteca
        ? <BibliotecaLocal api={porta.biblioteca} />
        : <section aria-label="Biblioteca"><h2>Biblioteca indisponível</h2><p>O servidor local ainda não oferece a API autenticada da biblioteca.</p></section>) : null}
      {tela === "canal" ? <><p>Contexto ativo para vínculo: {pacienteAtivo
        ? `${pacienteAtivo.nome} · ${pacienteAtivo.patientId} · ${pacienteAtivo.encounterId}`
        : contexto ? `${contexto.patientId} · ${contexto.encounterId}` : "selecione na agenda"}</p>
        <CaixaCanal porta={porta} chaves={chaves} /></> : null}
      {navegacaoPendente ? <div className="transcricao-navegacao-fundo" style={{ position: "fixed", inset: 0, zIndex: 1000,
        display: "grid", placeItems: "center", padding: "1rem", background: "rgba(15, 23, 42, .56)" }}>
        <div ref={dialogoNavegacao} role="dialog" aria-modal="true" aria-labelledby="transcricao-navegacao-titulo"
          className="transcricao-navegacao-dialogo" tabIndex={-1} onKeyDown={event=>{
            if (event.key === "Escape") { event.preventDefault(); continuarEditando(); return; }
            if (event.key !== "Tab") return;
            const controles=Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex='-1'])"));
            if (!controles.length) { event.preventDefault(); event.currentTarget.focus(); return; }
            const primeiro=controles[0], ultimo=controles[controles.length-1];
            if (event.shiftKey && (document.activeElement===primeiro || document.activeElement===event.currentTarget)) {
              event.preventDefault(); ultimo?.focus();
            } else if (!event.shiftKey && (document.activeElement===ultimo || document.activeElement===event.currentTarget)) {
              event.preventDefault(); primeiro?.focus();
            }
          }} style={{ width: "min(32rem, 100%)", boxSizing: "border-box", padding: "1.25rem", borderRadius: ".75rem",
            background: "var(--consulta-surface, #fff)", color: "var(--consulta-text, #172033)", boxShadow: "0 20px 60px rgba(0,0,0,.28)" }}>
          <h2 id="transcricao-navegacao-titulo">Transcrição não salva</h2>
          <p>Há texto de transcrição nesta consulta que ainda não foi salvo.</p>
          <p>Para salvar, continue editando e use “Salvar transcrição para revisão clínica”.</p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: ".75rem" }}>
            <button type="button" onClick={continuarEditando}>Continuar editando</button>
            <button type="button" onClick={descartarEContinuar}>Descartar e sair</button>
          </div>
        </div>
      </div> : null}
    </>}
  </main>;
}
