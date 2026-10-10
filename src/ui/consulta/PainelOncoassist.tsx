import { useEffect, useRef, useState } from "react";
import { ErroPorta, type PortaConsulta, type PedidoBundle } from "../api/porta.js";
import type { EstadoOncoassist, FontesOncoassist, RespostaOncoassist } from "../api/oncoassist.js";

const nomes = { LAB: "Laboratório", RADS: "Imagem", PATH: "Anatomia patológica",
  NOTA: "Nota clínica", OUTRO: "Outro documento", INDETERMINADO: "Classificação indeterminada" };

/** Organização documental proposta; não confirma fatos nem altera o prontuário. */
export function PainelOncoassist({ porta, contexto }: { porta: PortaConsulta; contexto: PedidoBundle }) {
  const [estado, setEstado] = useState<EstadoOncoassist | null>(null);
  const [fontes, setFontes] = useState<FontesOncoassist["fontes"]>([]);
  const [selecionada, setSelecionada] = useState("");
  const [resultado, setResultado] = useState<RespostaOncoassist | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);
  const [mudou, setMudou] = useState(false);
  const geracao = useRef(0);
  const requisicao = useRef<AbortController | null>(null);
  const { patientId, encounterId, tumorLotId } = contexto;

  useEffect(() => {
    const atual = ++geracao.current;
    const controller = new AbortController();
    setEstado(null); setFontes([]); setSelecionada(""); setResultado(null); setErro(false); setMudou(false); setOcupado(false);
    if (!porta.oncoassistStatus || !porta.oncoassistFontes) {
      setEstado({ status: "PENDENTE" }); return;
    }
    void (async () => {
      try {
        const status = await porta.oncoassistStatus!(controller.signal);
        if (atual !== geracao.current) return;
        setEstado(status);
        if (status.status !== "DISPONIVEL") return;
        const lista = await porta.oncoassistFontes!({ patientId, encounterId, tumorLotId }, controller.signal);
        if (atual !== geracao.current) return;
        setFontes(lista.fontes); setSelecionada(lista.fontes[0]?.draftId ?? "");
      } catch { if (atual === geracao.current) setErro(true); }
    })();
    return () => { geracao.current++; controller.abort(); requisicao.current?.abort(); };
  }, [porta, patientId, encounterId, tumorLotId]);

  async function classificar() {
    if (ocupado || !selecionada || !porta.oncoassistClassificar) return;
    const atual = geracao.current;
    const controller = new AbortController();
    requisicao.current = controller;
    setOcupado(true); setErro(false); setMudou(false); setResultado(null);
    try {
      const resposta = await porta.oncoassistClassificar({ patientId, encounterId, tumorLotId, draftId: selecionada }, controller.signal);
      if (atual === geracao.current) setResultado(resposta);
    } catch (error) { if (atual === geracao.current) {
      setErro(true); setMudou(error instanceof ErroPorta && ["FONTE_ALTERADA", "CONTEXTO_CONSULTA_ALTERADO"].includes(error.codigo));
    } }
    finally { if (atual === geracao.current) setOcupado(false); }
  }

  return <section aria-label="OncoAssist — documentos">
    <h3>OncoAssist</h3>
    {erro ? <p role="status">{mudou ? "A fonte ou a consulta mudou. Reabra a consulta para atualizar." : "Não foi possível consultar o OncoAssist. Tente novamente."}</p>
      : estado?.status === "PENDENTE" ? <p>Organização de documentos aguardando configuração.</p>
      : !estado ? <p>Consultando disponibilidade…</p>
      : fontes.length === 0 ? <p>Nenhuma fonte vinculada a esta consulta.</p> : null}
    {estado?.status === "DISPONIVEL" && fontes.length > 0 ? <>
      <label>Documento <select aria-label="Documento para o OncoAssist" value={selecionada} disabled={ocupado}
        onChange={(event) => { setSelecionada(event.target.value); setResultado(null); }}>
        {fontes.map((fonte) => <option key={fonte.draftId} value={fonte.draftId}>{fonte.rotulo}</option>)}
      </select></label>
      <button type="button" className="oc-btn-primary" disabled={ocupado || !selecionada} onClick={() => void classificar()}>
        {ocupado ? "Organizando…" : "Sugerir classificação"}
      </button>
    </> : null}
    {resultado?.status === "PROPOSTA" ? <p role="status">{nomes[resultado.categoria]} — sugestão para revisão.</p>
      : resultado ? <p role="status">Classificação pendente. O documento foi preservado.</p> : null}
  </section>;
}
