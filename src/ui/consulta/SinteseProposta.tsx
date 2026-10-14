import { useEffect, useRef, useState } from "react";
import type { PortaConsulta } from "../api/porta.js";
import type { SintesePropostaResposta } from "../../contracts/api/sinteseProposta.js";

export function SinteseProposta({ porta, contexto }: { porta: PortaConsulta; contexto: { patientId: string; encounterId: string; tumorLotId?: string | null } }) {
  const [resultado, setResultado] = useState<SintesePropostaResposta | null>(null);
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState("");
  const geracao = useRef(0), aborto = useRef<AbortController | null>(null);
  useEffect(() => { geracao.current++; aborto.current?.abort(); setResultado(null); setErro(""); setOcupado(false);
    return () => { geracao.current++; aborto.current?.abort(); };
  }, [contexto.patientId, contexto.encounterId, contexto.tumorLotId, porta]);
  async function propor() {
    if (!porta.sintetizarRetrato || ocupado) return;
    const g = ++geracao.current; const controller = new AbortController(); aborto.current = controller;
    setOcupado(true); setErro("");
    try { const r = await porta.sintetizarRetrato({ patientId: contexto.patientId, encounterId: contexto.encounterId,
      tumorLotId: contexto.tumorLotId ?? null, idempotencyKey: crypto.randomUUID() }, controller.signal);
      if (g === geracao.current) setResultado(r);
    } catch { if (g === geracao.current) setErro("Proposta indisponível; o resumo confirmado permanece ativo."); }
    finally { if (g === geracao.current) setOcupado(false); }
  }
  return <section aria-label="Síntese proposta com fontes" style={{ background: "#101c2b", color: "#fff", padding: 20, fontSize: 18, border: "2px solid #64748b", borderRadius: 12 }}>
    <h2 style={{ fontSize: 24 }}>Síntese proposta com fontes</h2>
    <p>O resumo confirmado permanece ativo. A proposta exige revisão médica.</p>
    <button type="button" disabled={ocupado || !porta.sintetizarRetrato} onClick={() => { void propor(); }} style={{ fontSize: 18, padding: "12px 18px" }}>
      {ocupado ? "Preparando proposta…" : "Propor síntese citada"}</button>
    <div role="status" aria-live="polite">{erro || (resultado?.codigo === "PENDENTE" ? `Pendente: ${resultado.motivo ?? "LLM indisponível"}. Resumo confirmado ativo.` : "")}</div>
    {resultado?.proposta && <><p><strong>PROPOSTA — revisão obrigatória</strong></p><ul>{resultado.proposta.citacoes.map((c, i) => <li key={i}>
      <p>{c.texto}</p><p style={{ fontSize: 16 }}>Fontes: {c.fatos.map(f => `${f.eventId} · revisão ${f.revisao}`).join("; ")}</p>
    </li>)}</ul></>}
  </section>;
}
