import { useEffect, useRef, useState } from "react";
import { ErroPorta, type PortaConsulta, type PedidoBundle } from "../api/porta.js";
import {
  classificarCapacidade, classificarFontes, mensagemCapacidade, mensagemResultadoTecnico, rotuloCategoria,
  type EstadoOncoassist, type FontesOncoassist, type RespostaOncoassist, type HistoricoOncoassist,
} from "../api/oncoassist.js";

/** Organização documental proposta; não confirma fatos nem altera o prontuário. */
export function PainelOncoassist({ porta, contexto }: { porta: PortaConsulta; contexto: PedidoBundle }) {
  const [estado, setEstado] = useState<EstadoOncoassist | null>(null);
  const [fontes, setFontes] = useState<FontesOncoassist["fontes"]>([]);
  const [fontesSemVinculo, setFontesSemVinculo] = useState<FontesOncoassist["fontesSemVinculo"]>([]);
  const [selecionada, setSelecionada] = useState("");
  const [resultado, setResultado] = useState<RespostaOncoassist | null>(null);
  const [historico, setHistorico] = useState<HistoricoOncoassist["propostas"]>([]);
  const [executando, setExecutando] = useState(false);
  const [canceladoLocal, setCanceladoLocal] = useState(false);
  const [falhaConsulta, setFalhaConsulta] = useState(false);
  const [contextoAlterado, setContextoAlterado] = useState(false);
  const geracao = useRef(0);
  const classificacao = useRef(0);
  const requisicao = useRef<AbortController | null>(null);
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
    setHistorico([]);
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
        setHistorico(memoria?.propostas ?? []);
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
    return () => { geracao.current++; controller.abort(); requisicao.current?.abort(); };
  }, [porta, patientId, encounterId, tumorLotId, portaOncoassist]);

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
          setHistorico(memoria.propostas);
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
      setResultado(null); setHistorico([]);
      setContextoAlterado(error instanceof ErroPorta && ["FONTE_ALTERADA", "CONTEXTO_CONSULTA_ALTERADO"].includes(error.codigo));
    } finally {
      if (classificacaoAtiva(contextoGeracao, classificacaoId)) {
        setExecutando(false);
        if (requisicao.current === controller) requisicao.current = null;
      }
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
  </section>;
}
