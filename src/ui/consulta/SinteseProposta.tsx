import { useEffect, useRef, useState } from "react";
import type { PortaConsulta } from "../api/porta.js";
import { SintesePropostaResposta } from "../../contracts/api/sinteseProposta.js";
import { AtendimentoV6 } from "./AtendimentoV6.js";

export function SinteseProposta({ porta, contexto }: { porta: PortaConsulta; contexto: { patientId: string; encounterId: string; tumorLotId?: string | null } }) {
  if(porta.recuperarAtendimentoV6&&porta.prepararAtendimentoV6)return <>
    <AtendimentoV6 key={JSON.stringify([contexto.patientId,contexto.encounterId,contexto.tumorLotId??null])} porta={porta} contexto={{...contexto,tumorLotId:contexto.tumorLotId??null}}/>
    <details><summary>Síntese literal por LLM · opcional</summary><SinteseCitada porta={porta} contexto={contexto}/></details>
  </>;
  return <SinteseCitada porta={porta} contexto={contexto}/>;
}
function SinteseCitada({ porta, contexto }: { porta: PortaConsulta; contexto: { patientId: string; encounterId: string; tumorLotId?: string | null } }) {
  const [resultado, setResultado] = useState<SintesePropostaResposta | null>(null);
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState("");
  const geracao = useRef(0), aborto = useRef<AbortController | null>(null), emCurso = useRef(false);
  const portaDaResposta = useRef<PortaConsulta | null>(null);
  useEffect(() => { geracao.current++; aborto.current?.abort(); setResultado(null); setErro(""); setOcupado(false);
    emCurso.current = false;
    return () => { geracao.current++; aborto.current?.abort(); };
  }, [contexto.patientId, contexto.encounterId, contexto.tumorLotId, porta]);
  async function propor() {
    if (!porta.sintetizarRetrato || emCurso.current) return;
    const g = ++geracao.current; aborto.current?.abort(); const controller = new AbortController(); aborto.current = controller;
    emCurso.current = true; setOcupado(true); setErro(""); setResultado(null);
    try { const bruto = await porta.sintetizarRetrato({ patientId: contexto.patientId, encounterId: contexto.encounterId,
      tumorLotId: contexto.tumorLotId ?? null, idempotencyKey: crypto.randomUUID() }, controller.signal);
      if (g !== geracao.current) return;
      const r = SintesePropostaResposta.safeParse(bruto);
      if (!r.success || r.data.contexto.patientId !== contexto.patientId || r.data.contexto.encounterId !== contexto.encounterId
        || r.data.contexto.tumorLotId !== (contexto.tumorLotId ?? null)) throw new Error("SINTESE_FORA_CONTEXTO");
      portaDaResposta.current = porta; setResultado(r.data);
    } catch { if (g === geracao.current) { setResultado(null); setErro("Proposta indisponível; o resumo confirmado permanece ativo."); } }
    finally { if (g === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }
  const atual = resultado && portaDaResposta.current === porta && resultado.contexto.patientId === contexto.patientId
    && resultado.contexto.encounterId === contexto.encounterId && resultado.contexto.tumorLotId === (contexto.tumorLotId ?? null)
    ? resultado : null;
  return <section aria-label="Síntese proposta com fontes" className="consulta-sintese" aria-busy={ocupado}>
    <h2>Síntese proposta com fontes</h2>
    <p>O resumo confirmado permanece ativo. A proposta exige revisão médica.</p>
    <button type="button" disabled={ocupado || !porta.sintetizarRetrato} onClick={() => { void propor(); }}>
      {ocupado ? "Preparando proposta…" : "Propor síntese citada"}</button>
    <div role="status" aria-live="polite">{erro || (atual?.codigo === "PENDENTE" ? `Pendente: ${atual.motivo ?? "LLM indisponível"}. Resumo confirmado ativo.` : "")}</div>
    {atual?.codigo !== "PENDENTE" && atual?.proposta && <><p><strong>PROPOSTA — revisão obrigatória</strong></p><ul>{atual.proposta.citacoes.map((c, i) => <li key={i}>
      <p>{c.texto}</p><p className="consulta-fonte-ref">Fontes: {c.fatos.map(f => `${f.eventId} · revisão ${f.revisao}`).join("; ")}</p>
    </li>)}</ul></>}
  </section>;
}
