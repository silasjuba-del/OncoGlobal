import { criarDocumentoMedicoProposto } from "./medico/documentoProposto.js";
import { CadastroMedico } from "./medico/CadastroMedico.js";
import { AgendaMedica } from "./medico/AgendaMedica.js";
import { PreConsultaMedica } from "./medico/PreConsultaMedica.js";
import { NutricaoMedica } from "./medico/NutricaoMedica.js";
import { DocumentosMedicos } from "./consulta/DocumentosMedicos.js";
import { ConversaOncoassist } from "./consulta/ConversaOncoassist.js";
import { DitadoDeepgram } from "./consulta/DitadoDeepgram.js";
import type { DocumentoManualFlash } from "../contracts/api/flash.js";
import type { FonteConversa } from "../contracts/api/conversaOncoassist.js";
import {RecuperarConfirmacoes} from "./consulta/RecuperarConfirmacoes.js";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { TumorLot } from '../contracts/clinico.js';
import { criarPortaHttp, type OpcoesHttp } from "./api/http.js";
import { criarChaves } from "./api/chaves.js";
import type { PedidoBundle, PortaConsulta } from "./api/porta.js";
import {ErroPorta} from './api/porta.js';
import {LotesPacienteResposta} from '../contracts/api/lotes.js';
import { ListaRascunhosPubMed } from "./consulta/ListaRascunhosPubMed.js";
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
import { PainelEstatistica } from "./estatistica/PainelEstatistica.js";
import { EstudosConsulta } from "./pesquisa/EstudosConsulta.js";
import type { VisaoEstatisticaServico, PeriodoClinicoEstatisticaServico } from "../contracts/api/estatisticaServico.js";
import { RevisaoClinica } from './consulta/RevisaoClinica.js';
import { contarClique, etapaDoClique, metricasVazias } from './consulta/metricasConsulta.js';
import {
  estadoInicialGruposConsulta,
  gravarCombinacao21st,
  lerCombinacao21st,
  type Combinacao21stId,
  type GrupoConsultaId,
} from "./oncochart/combinacoes21st.js";
import { MenuRapido21st, SecaoAcordeon21st } from "./oncochart/PainelCombinacoes21st.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./consulta/consulta-local.css";

const agendaSchema = z.object({ itens: z.array(z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), nome: z.string(), horario: z.string() })) });
const consultaSchema = z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), tumorLotId: z.string().nullable(),
  cabecalho:z.object({lotes:z.array(TumorLot)}).passthrough().optional() });

/** Explicit real-server view; never mounts the synthetic clinical chart. */
export function OncoassistLocal({ fabricaPorta = criarPortaHttp, perfil = "MEDICO" }: {
  perfil?: "MEDICO" | "LEGADO";
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
  const [aberturaFlash, setAberturaFlash] = useState<{ contexto: string; sequencia: number } | null>(null);
  const [metricas,setMetricas]=useState(metricasVazias);
  const [combo21st, setCombo21st] = useState<Combinacao21stId>(lerCombinacao21st);
  const [gruposAbertos, setGruposAbertos] = useState<Record<GrupoConsultaId, boolean>>(() => ({ ...estadoInicialGruposConsulta(), "consulta-fase2": false }));
  useEffect(() => { gravarCombinacao21st(combo21st); }, [combo21st]);
  const alternarGrupo = useCallback((id: GrupoConsultaId) => {
    setGruposAbertos((atual) => ({ ...atual, [id]: !atual[id] }));
  }, []);
  const focarGrupo = useCallback((id: GrupoConsultaId) => {
    setGruposAbertos({
      "consulta-fase2": id === "consulta-fase2",
      "consulta-documentos": id === "consulta-documentos",
      "consulta-revisao": id === "consulta-revisao",
      "consulta-medicamentos": id === "consulta-medicamentos",
      "consulta-sintese": id === "consulta-sintese",
    });
  }, []);
  const alternarTodosGrupos = useCallback((abrirTodos: boolean) => {
    setGruposAbertos({
      "consulta-fase2": abrirTodos,
      "consulta-documentos": abrirTodos,
      "consulta-revisao": abrirTodos,
      "consulta-medicamentos": abrirTodos,
      "consulta-sintese": abrirTodos,
    });
  }, []);
  const [transcricaoPendente,setTranscricaoPendente]=useState(false);
  const [transcricaoSalvando,setTranscricaoSalvando]=useState(false);
  const [prescricaoPendente,setPrescricaoPendente]=useState(false);
  const [prescricaoSalvando,setPrescricaoSalvando]=useState(false);
  const [apacPendente,setApacPendente]=useState(false);
  const [apacSalvando,setApacSalvando]=useState(false);
  const [estudoPendente,setEstudoPendente]=useState(false);
  const [estudoSalvando,setEstudoSalvando]=useState(false);
  const [cadastroPendente,setCadastroPendente]=useState(false);
  const [prePendente,setPrePendente]=useState(false), [nutricaoPendente,setNutricaoPendente]=useState(false);
  const [assistentePendente,setAssistentePendente]=useState(false), [assistenteOcupado,setAssistenteOcupado]=useState(false);
  const [documentalOcupado,setDocumentalOcupado]=useState(false),[transferindo,setTransferindo]=useState(false);
  const [flashPendente,setFlashPendente]=useState(false), [flashSalvando,setFlashSalvando]=useState(false);
  const [documentoProposto,setDocumentoProposto]=useState<(DocumentoManualFlash & {solicitacaoId:string;contextoChave:string}) | null>(null);
  const documentoVigente = useMemo(()=>{
    if(!documentoProposto || documentoProposto.contextoChave !== JSON.stringify(contexto)) return null;
    const {contextoChave:_contexto,...documento}=documentoProposto;return documento;
  },[documentoProposto,contexto]);
  const [fonteSolicitada,setFonteSolicitada]=useState<{draftId:string;solicitacaoId:string}|null>(null);
  const [evidencia,setEvidencia]=useState<FonteConversa|null>(null);
  const [ditadoAberto,setDitadoAberto]=useState(false), [textoDitado,setTextoDitado]=useState<{id:string;texto:string}|null>(null);
  useEffect(()=>{setDocumentoProposto(null);setFonteSolicitada(null);setEvidencia(null);setTextoDitado(null);setDitadoAberto(false);
    setCadastroPendente(false);setPrePendente(false);setNutricaoPendente(false);setAssistentePendente(false);setFlashPendente(false);
  },[contexto?.patientId,contexto?.encounterId,contexto?.tumorLotId]);
  const edicaoPendente = cadastroPendente || prePendente || nutricaoPendente || assistentePendente || flashPendente || transcricaoPendente || prescricaoPendente || apacPendente || estudoPendente;
  const salvamentoEmCurso = documentalOcupado || transferindo || flashSalvando || assistenteOcupado || transcricaoSalvando || prescricaoSalvando || apacSalvando || estudoSalvando;
  const removerProtecaoDocumento=useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!edicaoPendente && !salvamentoEmCurso) return;
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
  }, [edicaoPendente, salvamentoEmCurso]);
  const [mensagemSalvamento,setMensagemSalvamento]=useState("");
  useEffect(() => { if (!salvamentoEmCurso) setMensagemSalvamento(""); }, [salvamentoEmCurso]);
  const [navegacaoPendente,setNavegacaoPendente]=useState<(() => void) | null>(null);
  const dialogoNavegacao=useRef<HTMLDivElement>(null);
  const focoAnterior=useRef<HTMLElement|null>(null);
  const restaurarFoco=useRef(false);
  useEffect(()=>setMetricas(metricasVazias()),[contexto?.patientId,contexto?.encounterId,contexto?.tumorLotId]);
  const [mensagem, setMensagem] = useState("");
  const [tela, setTela] = useState<"consulta" | "salao" | "canal" | "apac" | "config" | "biblioteca" | "estatistica" | "estudos" | "agenda" | "preconsulta" | "documentos" | "oncoassist" | "nutricao">("consulta");
  const [estatistica, setEstatistica] = useState<VisaoEstatisticaServico | null>(null);
  const [periodoEstatistica, setPeriodoEstatistica] = useState<PeriodoClinicoEstatisticaServico | null>(null);
  const [estatisticaCarregando, setEstatisticaCarregando] = useState(false);
  const [estatisticaErro, setEstatisticaErro] = useState("");
  const geracao = useRef(0);
  const chaves = useMemo(() => criarChaves(), []);
  const contextoAtual=useRef(contexto); contextoAtual.current=contexto;
  const geracaoTela=geracao.current;
  const pacienteAtivo = agenda.find((item) => item.patientId === contexto?.patientId && item.encounterId === contexto?.encounterId);
  const ancorasConsulta = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const nav = ancorasConsulta.current;
    if (!nav) return;
    const enquadrarFoco = () => {
      const alvo = document.activeElement;
      if (!(alvo instanceof HTMLElement) || !nav.contains(alvo)) return;
      const faixa = nav.getBoundingClientRect(), link = alvo.getBoundingClientRect(), estilo = getComputedStyle(nav);
      const esquerda = faixa.left + (parseFloat(estilo.scrollPaddingInlineStart) || 0);
      const direita = faixa.right - (parseFloat(estilo.scrollPaddingInlineEnd) || 0);
      // Keep the current focus visible after resize; never move document scroll or focus.
      if (link.right > direita) nav.scrollLeft += Math.ceil(link.right - direita);
      else if (link.left < esquerda) nav.scrollLeft -= Math.ceil(esquerda - link.left);
    };
    nav.addEventListener("focusin", enquadrarFoco);
    window.addEventListener("resize", enquadrarFoco);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(enquadrarFoco) : null;
    observer?.observe(nav);
    return () => { observer?.disconnect(); nav.removeEventListener("focusin", enquadrarFoco);
      window.removeEventListener("resize", enquadrarFoco); };
  }, [tela, contexto?.patientId, contexto?.encounterId, contexto?.tumorLotId]);

  const limpar = useCallback(() => {
    removerProtecaoDocumento.current?.();
    geracao.current++;
    setSenha(""); setAutenticado(false); setAgenda([]); setSelecionado(""); setTela("consulta");
    setContexto(null); setLotes([]); setOcupado(false); setVersaoConsulta(0); setTranscricaoPendente(false);
    setTranscricaoSalvando(false); setMensagemSalvamento("");
    setPrescricaoPendente(false); setPrescricaoSalvando(false); setApacPendente(false); setApacSalvando(false);
    setEstatistica(null); setPeriodoEstatistica(null);
    setEstudoPendente(false); setEstudoSalvando(false);
    setNavegacaoPendente(null); restaurarFoco.current=false; setSessao((s) => s + 1);
  }, []);
  const expirar = useCallback(() => { limpar(); setMensagem("Sessão expirada. Entre novamente."); }, [limpar]);
  const porta = useMemo(() => fabricaPorta({ onSessaoExpirada: expirar }), [fabricaPorta, expirar, sessao]);
  const modoMedico = perfil === "MEDICO" && !!porta.consultorio;
  const transferenciaEmCurso = useRef(false);
  async function proporDocumento(texto: string, tipo: "ORIENTACOES" | "LAUDO"): Promise<boolean> {
    if (!contexto || transferenciaEmCurso.current) return false;
    const c = contexto, g = geracao.current;
    transferenciaEmCurso.current = true;setTransferindo(true);
    try {
      const documento = await criarDocumentoMedicoProposto(c, tipo, texto);
      if (g !== geracao.current || contextoAtual.current !== c) { setMensagem("Transferência cancelada porque o contexto mudou. Nenhum documento foi preparado no novo encontro.");return false; }
      setDocumentoProposto({...documento,solicitacaoId:crypto.randomUUID(),contextoChave:JSON.stringify(c)});
      setTela("consulta");return true;
    } catch {
      if(g===geracao.current)setMensagem("Não foi possível preparar o documento. Confira o texto: até 8.000 caracteres. A edição original foi preservada.");
      return false;
    } finally { transferenciaEmCurso.current = false;setTransferindo(false); }
  }
  function solicitarFonte(draftId: string) {
    solicitarNavegacaoVoluntaria(()=>{
      setFonteSolicitada({draftId,solicitacaoId:crypto.randomUUID()});setTela("consulta");
      setGruposAbertos(g=>({...g,"consulta-revisao":true}));
    });
  }
  async function abrirEvidencia(ref: {draftId?:string;eventId?:string;sourceId?:string}) {
    if (!contexto || !porta.assistente) return;
    const c = contexto, g = geracao.current;
    try {
      const h = await porta.assistente.historico(c);
      if (g !== geracao.current || contextoAtual.current !== c) return;
      const f = h.fontes.find(x => (ref.draftId && x.draftId === ref.draftId) || (ref.eventId && x.eventId === ref.eventId) || (ref.sourceId && x.sourceId === ref.sourceId));
      if (!f) throw Error("FONTE_NAO_VIGENTE");setEvidencia(f);
    } catch { if(g===geracao.current)setMensagem("A fonte não está disponível nesta revisão do encontro."); }
  }
  useEffect(() => () => { geracao.current++; }, []);
  useEffect(() => {
    if (!autenticado || tela !== "estatistica" || !porta.lerEstatisticaServico) return;
    const abort = new AbortController();
    let ativo = true;
    setEstatisticaCarregando(true); setEstatisticaErro(""); setEstatistica(null);
    void porta.lerEstatisticaServico(periodoEstatistica, abort.signal).then(dados => {
      if (ativo) setEstatistica(dados);
    }, () => { if (ativo) setEstatisticaErro("Não foi possível carregar os dados do serviço."); })
      .finally(() => { if (ativo) setEstatisticaCarregando(false); });
    return () => { ativo = false; abort.abort(); };
  }, [autenticado, tela, porta, periodoEstatistica]);

  function solicitarNavegacaoVoluntaria(navegar: () => void) {
    if (salvamentoEmCurso || transferenciaEmCurso.current) {
      setMensagemSalvamento(documentalOcupado || transferindo || assistenteOcupado || flashSalvando || transferenciaEmCurso.current ? "A operação atual está em andamento. Aguarde a conclusão antes de navegar." : estudoSalvando ? "O estudo está sendo salvo. Aguarde a conclusão antes de sair."
        : apacSalvando ? "A APAC está sendo processada. Aguarde a conclusão antes de sair."
        : prescricaoSalvando ? "A prescrição está sendo processada. Aguarde a conclusão antes de sair."
        : "A transcrição está sendo salva. Aguarde a conclusão antes de sair.");
      return;
    }
    if (!edicaoPendente) { navegar(); return; }
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    restaurarFoco.current=false;
    setNavegacaoPendente(() => navegar);
  }
  function navegarParaTela(proxima: "consulta" | "salao" | "canal" | "apac" | "config" | "biblioteca" | "estatistica" | "estudos" | "agenda" | "preconsulta" | "documentos" | "oncoassist" | "nutricao") {
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
    if (salvamentoEmCurso) return;
    const navegar=navegacaoPendente;
    // O descarte já foi confirmado no diálogo da aplicação. Uma saída de
    // documento síncrona (location.assign) não deve pedir confirmação de novo.
    removerProtecaoDocumento.current?.();
    setPrescricaoPendente(false); setApacPendente(false); setTranscricaoPendente(false);
    setEstudoPendente(false);setCadastroPendente(false);setPrePendente(false);setNutricaoPendente(false);setAssistentePendente(false);setFlashPendente(false);
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
      setAgenda(lista.data.itens); setAutenticado(true); if(modoMedico)setTela("agenda");
    } catch {
      if (atual === geracao.current) setMensagem("Não foi possível conectar ao servidor local.");
    } finally { if (atual === geracao.current) setOcupado(false); }
  }

  async function abrir(encounterId: string, entradaExplicita?: { patientId:string;encounterId:string;nome:string;horario:string }) {
    const entrada = entradaExplicita ?? agenda.find(item => item.encounterId === encounterId);
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

  return <main aria-label="OncoAssist local" className="oncoassist-local" data-combo-21st={combo21st} onClickCapture={event=>{
    // Deixa o evento do controle concluir antes de renderizar a telemetria local.
    // Atualização síncrona no capture restaura checked antes do onChange no navegador.
    const etapa=etapaDoClique(event.target),atual=geracao.current;
    if(etapa)setTimeout(()=>{if(atual===geracao.current)setMetricas(atuais=>contarClique(atuais,etapa));},0);
  }}>
    <header className="consulta-appbar"><div><h1>OncoAssist local</h1>
      <p>Documentos do servidor local. Sugestões aguardam revisão médica.</p></div>
      <div className="consulta-appbar-direita">
        <MenuRapido21st
          combinacao={combo21st}
          aoMudarCombinacao={setCombo21st}
          {...(autenticado && tela === "consulta" && contexto ? {
            gruposAbertos,
            aoAlternarTodosGrupos: alternarTodosGrupos,
            aoFocarGrupo: focarGrupo,
            metricas,
          } : {})}
        />
        {!modoMedico && <a href="/demonstracao.html" onClick={event=>{
          if (!edicaoPendente && !salvamentoEmCurso) return;
          event.preventDefault();
          solicitarNavegacaoVoluntaria(() => window.location.assign("/demonstracao.html"));
        }}>Voltar à demonstração</a>}
      </div></header>
    {mensagem ? <p role="status">{mensagem}</p> : null}
    {transcricaoSalvando ? <p role="status">Salvando transcrição. Aguarde a conclusão para navegar.</p> : null}
    {prescricaoSalvando ? <p role="status">Processando prescrição. Aguarde a conclusão para navegar.</p> : null}
    {apacSalvando ? <p role="status">A APAC está sendo processada. Aguarde a conclusão para navegar.</p> : null}
    {estudoSalvando ? <p role="status">Salvando estudo. Aguarde a conclusão para navegar.</p> : null}
    {mensagemSalvamento ? <p role="status">{mensagemSalvamento}</p> : null}
    {!autenticado ? <form onSubmit={(event) => void entrar(event)}>
      <label>Senha do servidor <input type="password" autoComplete="current-password" value={senha}
        minLength={12} maxLength={512} required disabled={ocupado} onChange={(e) => setSenha(e.target.value)} /></label>
      <button type="submit" disabled={ocupado || senha.length < 12}>{ocupado ? "Conectando…" : "Entrar"}</button>
    </form> : <>
      <div className="consulta-controles"><button type="button" disabled={transcricaoSalvando} onClick={() => solicitarNavegacaoVoluntaria(() => { limpar(); setMensagem(""); })}>Sair</button>
      {!modoMedico && (agenda.length === 0 ? <p>Nenhum paciente na agenda local de hoje.</p> : <label>Paciente da agenda
        <select aria-label="Paciente da agenda" value={selecionado} disabled={ocupado || transcricaoSalvando}
          onChange={(e) => solicitarPaciente(e.target.value)}>
          <option value="">Selecione um paciente</option>
          {agenda.map((p) => <option key={p.encounterId} value={p.encounterId}>{p.horario} — {p.nome}</option>)}
        </select>
      </label>)}
      {lotes.length?<label>Lote tumoral <select aria-label="Lote tumoral" value={contexto?.tumorLotId??''} disabled={ocupado || transcricaoSalvando}
        onChange={e=>solicitarLote(e.target.value)}>
        <option value="">Consulta sem lote selecionado</option>{lotes.map((l,i)=><option key={l.tumorLotId} value={l.tumorLotId}>
          {`Lote ${i+1} · ${l.cid.valor??'CID não informado'} · ${l.topografia.valor??l.tumorLotId}`}</option>)}
      </select></label>:null}
      {modoMedico && contexto ? <p aria-label="Contexto médico ativo">{pacienteAtivo?.nome ?? contexto.patientId} · encontro {contexto.encounterId}</p> : null}
      <nav aria-label="Áreas clínicas">
        {modoMedico && <>
          <button type="button" onClick={()=>navegarParaTela("agenda")}>Agenda e pacientes</button>
          <button type="button" disabled={!contexto} onClick={()=>navegarParaTela("preconsulta")}>Pré-consulta</button>
          <button type="button" disabled={!contexto} onClick={()=>navegarParaTela("documentos")}>Documentos e PDF</button>
          <button type="button" disabled={!contexto} onClick={()=>navegarParaTela("oncoassist")}>OncoAssist</button>
          <button type="button" disabled={!contexto} onClick={()=>navegarParaTela("nutricao")}>Orientações dietéticas</button>
        </>}
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("consulta")}>Consulta</button>
        {!modoMedico && <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("salao")}>Salão</button>}
        {!modoMedico && <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("canal")}>Canal</button>}
        {!modoMedico && <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("apac")}>APAC</button>}
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("config")}>Configurações Flash</button>
        <button type="button" disabled={ocupado || transcricaoSalvando} onClick={() => navegarParaTela("biblioteca")}>Biblioteca</button>
        {!modoMedico && porta.lerEstatisticaServico ? <button type="button" disabled={ocupado || salvamentoEmCurso}
          onClick={() => navegarParaTela("estatistica")}>Estatísticas</button> : null}
        {!modoMedico && porta.listarEstudosTrials ? <button type="button" disabled={ocupado || salvamentoEmCurso}
          onClick={() => navegarParaTela("estudos")}>Estudos clínicos</button> : null}
      </nav>
      </div>
      {ocupado ? <p role="status">Abrindo consulta…</p> : null}
      {modoMedico && tela === "agenda" && porta.consultorio && <AgendaMedica api={porta.consultorio} onSelecionar={(c,nome)=>solicitarNavegacaoVoluntaria(()=>{
        const entrada={patientId:c.patientId,encounterId:c.encounterId,nome:nome??c.patientId,horario:""};
        setAgenda(a=>[...a.filter(x=>x.encounterId!==c.encounterId),entrada]);setTela("consulta");void abrir(c.encounterId,entrada);
      })} />}
      {modoMedico && contexto && <>
        {tela === "preconsulta" && porta.consultorio && <><CadastroMedico api={porta.consultorio} contexto={contexto} aoAlterarPendente={setCadastroPendente}
          aoAtualizar={nome=>{setAgenda(a=>a.map(x=>x.patientId===contexto.patientId?{...x,nome}:x));setVersaoConsulta(v=>v+1);}} /><PreConsultaMedica api={porta.consultorio} contexto={contexto} aoRegistrar={()=>setVersaoConsulta(v=>v+1)} aoAlterarPendente={setPrePendente} /></>}
        {tela === "documentos" && porta.documental && <DocumentosMedicos api={porta.documental} contexto={contexto} aoAtividade={setDocumentalOcupado} aoSelecionarFonte={solicitarFonte} aoImportar={()=>setVersaoFontes(v=>v+1)} />}
        {tela === "nutricao" && porta.consultorio && <NutricaoMedica api={porta.consultorio} contexto={contexto} aoAlterarPendente={setNutricaoPendente} aoUsarOrientacao={t=>proporDocumento(t,"ORIENTACOES")} />}
        {tela === "oncoassist" && porta.assistente && <>
          <ConversaOncoassist api={porta.assistente} contexto={contexto} aoAbrirFonte={ref=>void abrirEvidencia(ref)} aoUsarTexto={t=>proporDocumento(t,"LAUDO")}
            aoDitar={()=>setDitadoAberto(v=>!v)} {...(textoDitado ? {textoDitado} : {})} aoAlterarPendente={setAssistentePendente} aoAtividade={setAssistenteOcupado} />
          {ditadoAberto && <DitadoDeepgram porta={porta} contexto={contexto} desabilitado={assistenteOcupado} aoAtividade={setTranscricaoSalvando}
            aoTrecho={texto=>setTextoDitado({id:crypto.randomUUID(),texto})} />}
          {evidencia && <section aria-label="Evidência clínica aberta"><h3>{evidencia.titulo}</h3><p>{evidencia.tipo} · {evidencia.data ?? "Data não informada"} · revisão {evidencia.revisao}</p>
            <pre style={{whiteSpace:"pre-wrap"}}>{evidencia.texto}</pre><p>Fonte: {evidencia.sourceId ?? evidencia.eventId ?? evidencia.id}</p>{evidencia.draftId && <button onClick={()=>solicitarFonte(evidencia.draftId!)}>Abrir fonte em revisão</button>}<button onClick={()=>setEvidencia(null)}>Fechar evidência</button></section>}
        </>}
      </>}
      {tela === "consulta" && contexto ? <div className="consulta-local" inert={ocupado} aria-busy={ocupado}
        key={`${contexto.patientId}:${contexto.encounterId}:${contexto.tumorLotId ?? ""}`}>
        <section className="consulta-identidade" aria-label="Identificação da consulta">
          <div className="consulta-identidade-linha"><strong>{pacienteAtivo?.nome ?? contexto.patientId}</strong>
            <span>{pacienteAtivo?.horario ? `Agenda ${pacienteAtivo.horario}` : "Consulta selecionada"}</span></div>
          <p className="consulta-identificadores">Paciente <b>{contexto.patientId}</b> · Encontro <b>{contexto.encounterId}</b>
            {contexto.tumorLotId ? <> · Lote <b>{contexto.tumorLotId}</b></> : " · Lote tumoral não vinculado"}</p>
          <nav ref={ancorasConsulta} aria-label="Navegar nesta consulta" className="consulta-ancoras" onClick={(e) => {
            const link = (e.target as HTMLElement | null)?.closest?.("a");
            const hash = link?.getAttribute("href")?.slice(1);
            if (hash && hash in gruposAbertos) {
              setGruposAbertos((atual) => ({ ...atual, [hash]: true }));
            }
          }}>
            <a href="#consulta-documentos">Documentos</a><a href="#consulta-revisao">Revisão da fonte</a>
            <a href="#consulta-fase2">Ficha e packs</a>
            <a href="#consulta-medicamentos">Medicamentos</a><a href="#consulta-sintese">Síntese proposta</a>
            <a href="#consulta-resumo">Visão integrada</a><a href="#consulta-conduta">Conduta e assinatura</a>
            <a href="#consulta-historico">Histórico</a>
          </nav>
        </section>
        <details><summary>Cliques por etapa nesta consulta</summary><ul>{Object.entries(metricas).map(([etapa,cliques])=><li key={etapa}>{etapa}: {cliques}</li>)}</ul></details>
        <ConsultaPersistida pedidoAberturaFlash={aberturaFlash?.contexto === JSON.stringify(contexto) ? aberturaFlash.sequencia : 0} versaoClinica={versaoConsulta} porta={porta} contexto={contexto}
          aoAlterarPrescricaoPendente={setPrescricaoPendente} aoAlterarPrescricaoSalvando={setPrescricaoSalvando}
          aoAlterarApacPendente={setApacPendente} aoAlterarApacSalvando={setApacSalvando}
          aoAtualizarClinico={() => setVersaoConsulta(v => v + 1)}
          {...(!modoMedico ? {aoAbrirApac:()=>navegarParaTela("apac"),aoAbrirCanal:()=>navegarParaTela("canal")} : {})}
          {...(documentoVigente ? {documentoProposto:documentoVigente} : {})} aoConsumirDocumentoProposto={id=>setDocumentoProposto(d=>d?.solicitacaoId===id?null:d)} {...(modoMedico ? {aoAlterarFlashPendente:setFlashPendente,aoAlterarFlashSalvando:setFlashSalvando} : {})} />
        <SecaoAcordeon21st
          id="consulta-fase2"
          key={`pack:${contexto.patientId}:${contexto.encounterId}:${contexto.tumorLotId}`}
          sobDemanda
          numero="01"
          titulo="Ficha clínica & Tumor-packs"
          resumo="Revisão estruturada do lote tumoral, estadiamento e diretrizes locais"
          aberto={gruposAbertos["consulta-fase2"]}
          aoAlternar={() => alternarGrupo("consulta-fase2")}
          aoFocarSomenteEste={() => focarGrupo("consulta-fase2")}
        >
          <RevisaoClinica porta={porta} contexto={contexto} versaoClinica={versaoConsulta} aoRegistrar={()=>setVersaoConsulta(v=>v+1)}/>
        </SecaoAcordeon21st>
        <SecaoAcordeon21st
          id="consulta-documentos"
          numero="02"
          titulo="Captura & Entrada única (PDF / Voz / Texto)"
          resumo="Upload de exames locais, transcrição e ditado em um só bloco"
          aberto={gruposAbertos["consulta-documentos"]}
          aoAlternar={() => alternarGrupo("consulta-documentos")}
          aoFocarSomenteEste={() => focarGrupo("consulta-documentos")}
        >
          <UploadDocumentoLocal porta={porta} contexto={contexto} aoSalvar={()=>setVersaoFontes(v=>v+1)}/>
          <TranscricaoLocal porta={porta} contexto={contexto} aoSalvar={()=>setVersaoFontes(v=>v+1)}
            aoAlterarPendente={setTranscricaoPendente} aoAlterarSalvamento={registrarSalvamentoTranscricao}/>
        </SecaoAcordeon21st>
        <SecaoAcordeon21st
          id="consulta-revisao"
          numero="03"
          titulo="Revisão de fontes & Alertas RADS"
          resumo="Conferência humana de achados extraídos, vínculo e emergências radiológicas"
          aberto={gruposAbertos["consulta-revisao"]}
          aoAlternar={() => alternarGrupo("consulta-revisao")}
          aoFocarSomenteEste={() => focarGrupo("consulta-revisao")}
        >
        <RevisaoExtracaoLocal key={versaoFontes} porta={porta} contexto={contexto} {...(fonteSolicitada ? {fonteSolicitada} : {})}
          aoFatosConfirmados={(confirmado)=>{
            const ativo=contextoAtual.current;
            if(geracao.current!==geracaoTela||!ativo||ativo.patientId!==confirmado.patientId||ativo.encounterId!==confirmado.encounterId
              ||ativo.tumorLotId!==confirmado.tumorLotId||!agenda.some(item=>item.patientId===ativo.patientId&&item.encounterId===ativo.encounterId))return;
            setVersaoConsulta(v=>v+1);
          }}
          {...(pacienteAtivo ? { patientLabel: pacienteAtivo.nome } : {})} />
        </SecaoAcordeon21st>
        <RecuperarConfirmacoes key={`recuperar:${contexto.patientId}:${contexto.encounterId}:${contexto.tumorLotId}`} porta={porta} contexto={contexto} aoAtualizar={()=>setVersaoConsulta(v=>v+1)}/>
        <PainelOncoassist key={`painel:${versaoConsulta}`} porta={porta} contexto={contexto} />
        <ListaRascunhosPubMed key={`pubmed:${versaoConsulta}`} porta={porta} />
        <SecaoAcordeon21st
          id="consulta-medicamentos"
          numero="04"
          titulo="Reconciliação de medicamentos"
          resumo="Confronto entre medicamentos em uso, prescrição e propostas"
          aberto={gruposAbertos["consulta-medicamentos"]}
          aoAlternar={() => alternarGrupo("consulta-medicamentos")}
          aoFocarSomenteEste={() => focarGrupo("consulta-medicamentos")}
        >
        <ReconciliarMedicamentos key={`medicamentos:${contexto.patientId}:${contexto.encounterId}:${contexto.tumorLotId}`} porta={porta} contexto={{...contexto,tumorLotId:contexto.tumorLotId??null}} aoFatosConfirmados={(confirmado)=>{
          const c=contextoAtual.current;
          if(geracao.current===geracaoTela&&c?.patientId===confirmado.patientId&&c.encounterId===confirmado.encounterId&&(c.tumorLotId??null)===(confirmado.tumorLotId??null)&&agenda.some(item=>item.patientId===c.patientId&&item.encounterId===c.encounterId))setVersaoConsulta(v=>v+1);
        }}/>
        </SecaoAcordeon21st>
        <SecaoAcordeon21st
          id="consulta-sintese"
          numero="05"
          titulo="Síntese clínica proposta"
          resumo="Retrato consolidado para apoio à evolução médica"
          aberto={gruposAbertos["consulta-sintese"]}
          aoAlternar={() => alternarGrupo("consulta-sintese")}
          aoFocarSomenteEste={() => focarGrupo("consulta-sintese")}
        >
        <SinteseProposta key={`sintese:${versaoConsulta}`} porta={porta} contexto={contexto} aoAbrirFlash={() => { setAberturaFlash(a => ({ contexto: JSON.stringify(contexto), sequencia: (a?.sequencia ?? 0) + 1 })); }}/>
        </SecaoAcordeon21st>
      </div> : null}
      {tela === "salao" ? <TelaSalao porta={porta} /> : null}
      {tela === "estudos" ? <EstudosConsulta key={`${contexto?.patientId}:${contexto?.encounterId}:${contexto?.tumorLotId}`}
        porta={porta} contexto={contexto}
        aoAlterarPendente={setEstudoPendente} aoAlterarSalvamento={setEstudoSalvando} /> : null}
      {tela === "estatistica" ? <section aria-label="Estatísticas do serviço local">
        {estatisticaErro ? <p role="alert">{estatisticaErro}</p> : null}
        {estatistica ? <PainelEstatistica dados={estatistica} ocupado={estatisticaCarregando} aoPeriodo={setPeriodoEstatistica} />
          : estatisticaCarregando ? <p role="status">Carregando estatísticas…</p> : null}
      </section> : null}
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
          <h2 id="transcricao-navegacao-titulo">{cadastroPendente || prePendente || nutricaoPendente || assistentePendente || flashPendente ? "Alterações não salvas" : apacPendente ? "APAC em edição" : estudoPendente ? "Estudo em edição"
            : prescricaoPendente ? "Prescrição em edição" : "Transcrição não salva"}</h2>
          {cadastroPendente ? <p>Há alterações cadastrais não salvas. Continue editando para revisar e salvar a correção.</p> : null}
          {prePendente ? <p>A pré-consulta contém texto ainda não salvo.</p> : null}
          {nutricaoPendente ? <p>A orientação dietética contém alterações ainda não salvas.</p> : null}
          {assistentePendente ? <p>Há uma pergunta ou proposta editada no OncoAssist que ainda não foi preparada como documento.</p> : null}
          {flashPendente ? <p>Os documentos da consulta têm alterações não salvas ou uma substituição pendente de revisão.</p> : null}
          {transcricaoPendente ? <><p>Há texto de transcrição nesta consulta que ainda não foi salvo.</p>
            <p>Para salvar, continue editando e use “Salvar transcrição para revisão clínica”.</p></> : null}
          {prescricaoPendente ? <p>A prescrição ainda não foi assinada. Continue editando para revisar e concluir.</p> : null}
          {apacPendente ? <p>A APAC tem alterações administrativas não salvas. Continue editando para preparar e salvar como rascunho.</p> : null}
          {estudoPendente ? <p>Há alterações no protocolo do estudo que ainda não foram salvas. Continue editando para concluir.</p> : null}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: ".75rem" }}>
            <button type="button" onClick={continuarEditando}>Continuar editando</button>
            <button type="button" onClick={descartarEContinuar}>Descartar e sair</button>
          </div>
        </div>
      </div> : null}
    </>}
  </main>;
}
