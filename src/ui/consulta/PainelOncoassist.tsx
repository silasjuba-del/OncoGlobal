import { useEffect, useRef, useState } from "react";
import { ErroPorta, type PortaConsulta, type PedidoBundle } from "../api/porta.js";
import {
  classificarCapacidade, classificarFontes, mensagemCapacidade, mensagemResultadoTecnico,
  type EstadoOncoassist, type FontesOncoassist, type RespostaOncoassist,
} from "../api/oncoassist.js";

/** Organização documental proposta; não confirma fatos nem altera o prontuário. */
export function PainelOncoassist({ porta, contexto }: { porta: PortaConsulta; contexto: PedidoBundle }) {
  const [estado, setEstado] = useState<EstadoOncoassist | null>(null);
  const [fontes, setFontes] = useState<FontesOncoassist["fontes"]>([]);
  const [fontesSemVinculo, setFontesSemVinculo] = useState<FontesOncoassist["fontesSemVinculo"]>([]);
  const [selecionada, setSelecionada] = useState("");
  const [resultado, setResultado] = useState<RespostaOncoassist | null>(null);
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
    setCanceladoLocal(false); setExecutando(false);
    if (!porta.oncoassistStatus) {
      setEstado({ status: "PENDENTE" }); return;
    }
    void (async () => {
      try {
        const status = await porta.oncoassistStatus!(controller.signal);
        if (atual !== geracao.current) return;
        setEstado(status);
        if (status.status !== "DISPONIVEL" || !porta.oncoassistFontes) return;
        const lista = await porta.oncoassistFontes!({ patientId, encounterId, tumorLotId }, controller.signal);
        if (atual !== geracao.current) return;
        setFontes(lista.fontes);
        setFontesSemVinculo(lista.fontesSemVinculo ?? []);
        setSelecionada(lista.fontes[0]?.draftId ?? "");
      } catch {
        if (atual === geracao.current) setFalhaConsulta(true);
      }
    })();
    return () => { geracao.current++; controller.abort(); requisicao.current?.abort(); };
  }, [porta, patientId, encounterId, tumorLotId, portaOncoassist]);

  function interromper() {
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
        { patientId, encounterId, tumorLotId, draftId: selecionada }, controller.signal);
      if (classificacaoAtiva(contextoGeracao, classificacaoId) && !controller.signal.aborted) {
        setResultado(resposta);
      }
    } catch (error) {
      if (!classificacaoAtiva(contextoGeracao, classificacaoId)) return;
      if (controller.signal.aborted) {
        setCanceladoLocal(true);
        return;
      }
      setFalhaConsulta(true);
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
  </section>;
}
