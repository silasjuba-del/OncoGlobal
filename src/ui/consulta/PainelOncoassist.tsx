import { useEffect, useRef, useState } from "react";
import { PainelSkillsClinicas } from "./PainelSkillsClinicas.js";
import { ErroPorta, type PortaConsulta, type PedidoBundle } from "../api/porta.js";
import {
  classificarCapacidade, classificarFontes, mensagemCapacidade, mensagemResultadoTecnico, rotuloCategoria,
  rotuloCodigoCognitivoNaoVerificado, rotuloStatusExtracaoCognitiva,
  type EstadoOncoassist, type FontesOncoassist, type RespostaOncoassist, type HistoricoOncoassist,
  type PaginaExtracoesCognitivas, type ResultadoCognitivoOncoassist,
} from "../api/oncoassist.js";

/** Organização documental proposta; não confirma fatos nem altera o prontuário. */
export function PainelOncoassist({ porta, contexto }: { porta: PortaConsulta; contexto: PedidoBundle }) {
  const [estado, setEstado] = useState<EstadoOncoassist | null>(null);
  const [fontes, setFontes] = useState<FontesOncoassist["fontes"]>([]);
  const [fontesSemVinculo, setFontesSemVinculo] = useState<FontesOncoassist["fontesSemVinculo"]>([]);
  const [selecionada, setSelecionada] = useState("");
  const [resultado, setResultado] = useState<RespostaOncoassist | null>(null);
  const [historico, setHistorico] = useState<HistoricoOncoassist["propostas"]>([]);
  const [extracoes, setExtracoes] = useState<PaginaExtracoesCognitivas["itens"]>([]);
  const [proximoCursor, setProximoCursor] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<ResultadoCognitivoOncoassist | null>(null);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [falhaRelatorio, setFalhaRelatorio] = useState(false);
  const [falhaPagina, setFalhaPagina] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [canceladoLocal, setCanceladoLocal] = useState(false);
  const [falhaConsulta, setFalhaConsulta] = useState(false);
  const [contextoAlterado, setContextoAlterado] = useState(false);
  const geracao = useRef(0);
  const classificacao = useRef(0);
  const leituraCognitiva = useRef(0);
  const requisicao = useRef<AbortController | null>(null);
  const leituraReq = useRef<AbortController | null>(null);
  const { patientId, encounterId, tumorLotId } = contexto;
  const portaOncoassist = !!(porta.oncoassistStatus && porta.oncoassistFontes && porta.oncoassistClassificar);
  const capacidade = classificarCapacidade(estado, portaOncoassist);
  const situacaoFontes = capacidade === "PRONTO" ? classificarFontes(fontes, fontesSemVinculo) : null;
  const prontoParaClassificar = capacidade === "PRONTO" && situacaoFontes === null && fontes.length > 0;

  useEffect(() => {
    const atual = ++geracao.current;
    const controller = new AbortController();
    requisicao.current?.abort();
    requisicao.current = null;
    setEstado(null); setFontes([]); setFontesSemVinculo([]); setSelecionada("");
    setResultado(null); setFalhaConsulta(false); setContextoAlterado(false);
    setHistorico([]); setExtracoes([]); setProximoCursor(null); setRelatorio(null);
    setAbrindoId(null); setFalhaRelatorio(false); setFalhaPagina(false);
    setCanceladoLocal(false); setExecutando(false);
    if (!porta.oncoassistStatus && !porta.oncoassistHistorico) {
      setEstado({ status: "PENDENTE" }); return;
    }
    void (async () => {
      try {
        const [status, lista, memoria] = await Promise.all([
          porta.oncoassistStatus?.(controller.signal) ?? { status: "PENDENTE" as const },
          porta.oncoassistFontes?.({ patientId, encounterId, tumorLotId }, controller.signal)
            ?? { fontes: [], fontesSemVinculo: [] },
          porta.oncoassistHistorico?.({ patientId, encounterId, tumorLotId }, controller.signal),
        ]);
        if (atual !== geracao.current) return;
        setEstado(status);
        aplicarMemoria(memoria);
        setFontes(lista.fontes);
        setFontesSemVinculo(lista.fontesSemVinculo ?? []);
        setSelecionada(lista.fontes[0]?.draftId ?? "");
      } catch (erro) {
        if (atual === geracao.current) {
          setFalhaConsulta(true);
          setContextoAlterado(erro instanceof ErroPorta && erro.codigo === "CONTEXTO_CONSULTA_ALTERADO");
        }
      }
    })();
    return () => { geracao.current++; controller.abort(); requisicao.current?.abort(); leituraReq.current?.abort(); };
  }, [porta, patientId, encounterId, tumorLotId, portaOncoassist]);

  function aplicarMemoria(memoria: HistoricoOncoassist | undefined) {
    setHistorico(memoria?.propostas ?? []);
    setExtracoes(memoria?.extracoesCognitivas?.itens ?? []);
    setProximoCursor(memoria?.extracoesCognitivas?.proximoCursor ?? null);
    setFalhaPagina(false);
  }

  function interromper() {
    classificacao.current++;
    requisicao.current?.abort();
    requisicao.current = null;
    setExecutando(false);
    setCanceladoLocal(true);
    setResultado(null);
  }

  function classificacaoAtiva(contextoGeracao: number, classificacaoId: number) {
    return contextoGeracao === geracao.current && classificacaoId === classificacao.current;
  }

  async function classificar() {
    if (executando || !selecionada || !porta.oncoassistClassificar) return;
    const contextoGeracao = geracao.current;
    const classificacaoId = ++classificacao.current;
    const controller = new AbortController();
    requisicao.current = controller;
    setExecutando(true); setFalhaConsulta(false); setContextoAlterado(false);
    setCanceladoLocal(false); setResultado(null);
    try {
      const resposta = await porta.oncoassistClassificar(
        { patientId, encounterId, tumorLotId, draftId: selecionada,
          // Adaptadores antigos seguem o contrato legado; a porta HTTP OA02 declara histórico.
          ...(porta.oncoassistHistorico ? { operationId: crypto.randomUUID() } : {}) }, controller.signal);
      if (classificacaoAtiva(contextoGeracao, classificacaoId) && !controller.signal.aborted) {
        if (porta.oncoassistHistorico) {
          const memoria = await porta.oncoassistHistorico({ patientId, encounterId, tumorLotId }, controller.signal);
          if (!classificacaoAtiva(contextoGeracao, classificacaoId) || controller.signal.aborted) return;
          aplicarMemoria(memoria);
          if (resposta.status === "PROPOSTA") {
            // A fonte pode mudar entre classificar e ler o histórico. Só a mesma
            // proposta persistida e ainda válida pode aparecer como resultado atual.
            const propostaId = resposta.auditoria?.propostaId;
            const correspondencias = propostaId
              ? memoria.propostas.filter(item => item.auditoria.propostaId === propostaId) : [];
            const proposta = correspondencias.length === 1 ? correspondencias[0] : undefined;
            setResultado(proposta?.validade === "ATUAL" && proposta.estado === "CONCLUIDA"
              && proposta.auditoria.patientId === patientId && proposta.auditoria.encounterId === encounterId
              && proposta.auditoria.tumorLotId === (tumorLotId ?? null) && proposta.auditoria.draftId === selecionada
              && proposta.resposta?.status === "PROPOSTA" && proposta.resposta.auditoria?.propostaId === propostaId
              ? proposta.resposta : null);
          } else setResultado(resposta);
        } else setResultado(resposta);
      }
    } catch (error) {
      if (!classificacaoAtiva(contextoGeracao, classificacaoId)) return;
      if (controller.signal.aborted) {
        setCanceladoLocal(true);
        return;
      }
      setFalhaConsulta(true);
      setResultado(null); setHistorico([]); setExtracoes([]); setProximoCursor(null); setRelatorio(null);
      setContextoAlterado(error instanceof ErroPorta && ["FONTE_ALTERADA", "CONTEXTO_CONSULTA_ALTERADO"].includes(error.codigo));
    } finally {
      if (classificacaoAtiva(contextoGeracao, classificacaoId)) {
        setExecutando(false);
        if (requisicao.current === controller) requisicao.current = null;
      }
    }
  }

  async function abrirExtracao(draftId: string) {
    if (abrindoId || !porta.oncoassistResultadoCognitivo) return;
    const contextoGeracao = geracao.current;
    const leituraId = ++leituraCognitiva.current;
    const controller = new AbortController();
    leituraReq.current?.abort();
    leituraReq.current = controller;
    setAbrindoId(draftId); setFalhaRelatorio(false); setRelatorio(null);
    try {
      const resposta = await porta.oncoassistResultadoCognitivo(
        { patientId, encounterId, tumorLotId, draftId }, controller.signal);
      if (!leituraAtiva(contextoGeracao, leituraId) || controller.signal.aborted) return;
      if (resposta.draftId !== draftId || resposta.criaEventoClinico !== false) {
        setFalhaRelatorio(true);
        return;
      }
      setRelatorio(resposta);
    } catch {
      if (leituraAtiva(contextoGeracao, leituraId) && !controller.signal.aborted) setFalhaRelatorio(true);
    } finally {
      if (leituraAtiva(contextoGeracao, leituraId)) {
        setAbrindoId(null);
        if (leituraReq.current === controller) leituraReq.current = null;
      }
    }
  }

  function leituraAtiva(contextoGeracao: number, leituraId: number) {
    return contextoGeracao === geracao.current && leituraId === leituraCognitiva.current;
  }

  async function carregarExtracoesAnteriores() {
    if (!proximoCursor || !porta.oncoassistHistorico || abrindoId) return;
    const contextoGeracao = geracao.current;
    const controller = new AbortController();
    setFalhaPagina(false);
    try {
      const memoria = await porta.oncoassistHistorico(
        { patientId, encounterId, tumorLotId, cursorExtracoes: proximoCursor }, controller.signal);
      if (contextoGeracao !== geracao.current || controller.signal.aborted) return;
      const pagina = memoria.extracoesCognitivas;
      if (!pagina) { setFalhaPagina(true); return; }
      setExtracoes(atual => {
        const ids = new Set(atual.map(item => item.draftId));
        return [...atual, ...pagina.itens.filter(item => !ids.has(item.draftId))];
      });
      setProximoCursor(pagina.proximoCursor);
    } catch {
      if (contextoGeracao === geracao.current) setFalhaPagina(true);
    }
  }

  const estadoPainel = contextoAlterado ? "CONTEXTO_ALTERADO"
    : falhaConsulta ? "FALHA_CONSULTA"
      : canceladoLocal && !resultado ? "CANCELADO"
        : executando ? "EXECUTANDO"
          : situacaoFontes ?? capacidade;
  const mensagemSituacao = mensagemCapacidade(estadoPainel, estado?.motivo);
  const mensagemResultado = resultado ? mensagemResultadoTecnico(resultado) : null;

  return <section aria-label="OncoAssist — documentos">
    <h3>OncoAssist</h3>
    <PainelSkillsClinicas key={`${patientId}:${encounterId}:${tumorLotId ?? ""}`} porta={porta} contexto={contexto} />
    {mensagemSituacao ? <p role="status">{mensagemSituacao}</p> : null}
    {prontoParaClassificar ? <>
      <label>Documento <select aria-label="Documento para o OncoAssist" value={selecionada} disabled={executando}
        onChange={(event) => { setSelecionada(event.target.value); setResultado(null); setCanceladoLocal(false); }}>
        {fontes.map((fonte) => <option key={fonte.draftId} value={fonte.draftId}>{fonte.rotulo}</option>)}
      </select></label>
      <button type="button" className="oc-btn-primary" disabled={executando || !selecionada} onClick={() => void classificar()}>
        {executando ? "Organizando…" : "Sugerir classificação"}
      </button>
      {executando ? <button type="button" className="oc-btn-secondary" onClick={interromper}>Interromper</button> : null}
    </> : null}
    {mensagemResultado ? <p role="status">{mensagemResultado}</p> : null}
    {historico.length > 0 ? <section aria-label="Histórico de propostas documentais">
      <h4>Propostas documentais salvas</h4>
      <p>Revisão médica obrigatória. Estas sugestões não são fatos do prontuário.</p>
      <ul>{historico.map((item) => <li key={item.auditoria.propostaId}>
        Revisão {item.auditoria.propostaRevision}: {item.resposta ? rotuloCategoria(item.resposta)
          ?? mensagemResultadoTecnico(item.resposta) : "Operação pendente — sem resultado; não será reexecutada ao reabrir."}
        {" · "}{item.auditoria.capturadoEm}{" · Fonte "}{item.auditoria.sourceId}
        {" · "}{item.validade === "FONTE_ALTERADA" ? "Fonte alterada — somente histórico."
          : "Fonte preservada."}
        <br />Pol&#237;tica capturada: {item.auditoria.politicaVersao || "n\u00e3o informada"} &mdash; {
          item.validadePolitica === "MESMA_VERSAO" ? "mesma vers\u00e3o"
            : item.validadePolitica === "VERSAO_DIFERENTE" ? "vers\u00e3o diferente" : "n\u00e3o verific\u00e1vel"}
        <br />Mecanismo capturado: {item.auditoria.mecanismo || "n\u00e3o informado"}
        <br />Modelo capturado: {item.resposta?.status === "PROPOSTA" ? item.resposta.modelo || "n\u00e3o informado" : "n\u00e3o informado"}
        <br />Provedor capturado: {item.auditoria.provedor || "n\u00e3o informado"}
        <br />A mesma pol&#237;tica n&#227;o verifica a vers&#227;o do modelo.
      </li>)}</ul>
    </section> : null}
    {extracoes.length > 0 ? <section aria-label="Extrações cognitivas salvas">
      <h4>Extrações cognitivas salvas</h4>
      <p>Revisão médica obrigatória. Estas extrações não entram no prontuário.</p>
      <ul>{extracoes.map((item) => <li key={item.draftId}>
        {rotuloStatusExtracaoCognitiva(item.status)}
        {" · "}{item.criadoEm}{" · Fonte "}{item.sourceId}
        {" · "}{item.alegacoes} alegações propostas{" · "}{item.pendencias} pendências
        {" · "}{item.validadeFonte === "FONTE_ALTERADA" ? "Fonte alterada — somente histórico." : "Fonte preservada."}
        {" · "}{item.validadeContexto === "CONTEXTO_ALTERADO" ? "Consulta alterada — somente histórico." : "Consulta preservada."}
        {" · "}{item.validadePolitica === "MESMA_VERSAO" ? "Mesma política." : "Política não verificável."}
        {porta.oncoassistResultadoCognitivo ? <><br /><button type="button" className="oc-btn-secondary"
          aria-label={`Abrir conferência ${item.draftId}`} disabled={abrindoId !== null}
          onClick={() => void abrirExtracao(item.draftId)}>
          {abrindoId === item.draftId ? "Abrindo conferência…" : "Abrir conferência"}
        </button></> : null}
      </li>)}</ul>
      {proximoCursor ? <button type="button" className="oc-btn-secondary" disabled={abrindoId !== null}
        onClick={() => void carregarExtracoesAnteriores()}>Carregar extrações anteriores</button> : null}
      {falhaPagina ? <p role="status">Não foi possível carregar extrações anteriores. A lista já aberta foi preservada.</p> : null}
      {falhaRelatorio ? <p role="status">Não foi possível abrir a conferência. A lista foi preservada e nada entrou no prontuário.</p> : null}
      {relatorio ? <ConferenciaCognitiva resultado={relatorio} /> : null}
    </section> : null}
  </section>;
}

function ConferenciaCognitiva({ resultado }: { resultado: ResultadoCognitivoOncoassist }) {
  const cognitivo = resultado.cognitivo;
  const historicoSomente = resultado.validadeFonte === "FONTE_ALTERADA" || resultado.validadeContexto === "CONTEXTO_ALTERADO";
  return <article aria-label="Conferência da extração cognitiva">
    <p>Conferência do rascunho. Não confirma fato, prescrição nem conduta.</p>
    {historicoSomente ? <p role="status">Esta leitura é somente histórica. A fonte ou a consulta não corresponde ao estado atual.</p> : null}
    {!cognitivo ? <p role="status">Relatório cognitivo ausente neste rascunho. Nada foi promovido a fato.</p> : null}
    {cognitivo?.estado === "NAO_VERIFICADO" ? <p role="status">{rotuloCodigoCognitivoNaoVerificado(cognitivo.codigo)}</p> : null}
    {cognitivo?.estado === "AVALIADO" ? <>
      <p role="status">{rotuloStatusExtracaoCognitiva(cognitivo.harness.status)} Cobertura: {rotuloCobertura(cognitivo.harness.cobertura)}</p>
      <ul>{cognitivo.proposta.itensPropostos.map(item => <li key={item.itemId}>
        {item.campo}: {String(item.valorProposto)}{item.unidade ? ` ${item.unidade}` : ""} · {item.qualificador}
        {item.criticoNumero ? " · número crítico, conferir" : ""} · não validado · exige confirmação médica
      </li>)}</ul>
      {cognitivo.proposta.lacunas.length > 0 ? <p>Lacunas: {cognitivo.proposta.lacunas.map(l => `${l.campo} (${l.obrigatoriedade})`).join("; ")}.</p> : null}
      {cognitivo.proposta.ambiguidades.length > 0 ? <p>Ambiguidades sem escolha automática: {cognitivo.proposta.ambiguidades.map(a => a.campo).join(", ")}.</p> : null}
      {cognitivo.harness.manifestacoes.length > 0 ? <ul aria-label="Manifestações do harness">{cognitivo.harness.manifestacoes.map((m, indice) =>
        <li key={`${m.tipo}:${m.campo}:${indice}`}>{m.tipo} · {m.campo}</li>)}</ul> : null}
    </> : null}
    {cognitivo?.captura ? <p>Áudio não conferido. {cognitivo.captura.transcricaoEditada
      ? "A transcrição foi editada. O original permanece no registro."
      : "A marca de edição da transcrição não afirma conferência do áudio."}</p> : null}
    {cognitivo?.conhecimento ? <p>Referências locais consultadas depois da extração: {cognitivo.conhecimento.referencias.length}. Filtros de consulta não são fatos do paciente.</p> : null}
  </article>;
}

function rotuloCobertura(cobertura: "VERIFICADA" | "COBERTURA_NAO_VERIFICADA" | "PARCIALMENTE_VERIFICADA") {
  if (cobertura === "VERIFICADA") return "conferida pelo harness, ainda sem decisão médica.";
  if (cobertura === "PARCIALMENTE_VERIFICADA") return "parcial; resolver antes de usar.";
  return "não verificada.";
}
