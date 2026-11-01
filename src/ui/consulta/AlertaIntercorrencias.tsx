import { useState } from "react";
import type { DutosClinicaVisao } from "../../contracts/api/dutos.js";

type Intercorrencia = NonNullable<DutosClinicaVisao["intercorrenciasAnteriores"]>[number];
const SITUACAO: Record<Intercorrencia["dados"]["status"], string> = { COMPLETA: "Completa", PARCIAL: "Parcial", INTERROMPIDA: "Interrompida", OMITIDA: "Não administrada" };
const data = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "não informado";

/** Semáforo vermelho do encontro: administração anterior parcial, interrompida, omitida ou com reação infusional. */
export function AlertaIntercorrencias({ intercorrencias }: { intercorrencias: readonly Intercorrencia[] }) {
  const [aberto, setAberto] = useState(false);
  if (!intercorrencias.length) return null;
  return <>
    <button type="button" className="semaforo-vermelho" aria-haspopup="dialog" onClick={() => setAberto(true)}
      style={{ background: "#b42318", color: "#fff", border: 0, borderRadius: 6, padding: "0.5rem 0.75rem", fontWeight: 600 }}>
      <span aria-hidden="true">● </span>Intercorrência na administração anterior ({intercorrencias.length}) — ver motivo
    </button>
    {aberto ? <div role="dialog" aria-modal="true" aria-label="Motivo da intercorrência na administração"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 1100 }}>
      <section style={{ background: "#fff", color: "#111", maxWidth: 640, width: "calc(100% - 32px)", maxHeight: "80vh", overflow: "auto", borderRadius: 8, padding: "1rem" }}>
        <h3>Intercorrência na administração anterior</h3>
        <ul>{intercorrencias.map(i => <li key={i.eventId}>
          <p><strong>{i.dados.droga}</strong> · {SITUACAO[i.dados.status]}{i.dados.reacaoInfusional ? " · reação infusional" : ""}</p>
          <p>Motivo registrado: {i.dados.motivo ?? "não informado"}</p>
          <p>Administrado {i.dados.quantidadeEfetivaMg} mg · início {data(i.dados.inicio)} · fim {data(i.dados.fim)}</p>
          <p>Encontro {i.encounterId} · registrado em {data(i.registradoEm)} · fonte {i.dados.fonte.sourceId}</p>
        </li>)}</ul>
        <button type="button" onClick={() => setAberto(false)}>Fechar</button>
      </section>
    </div> : null}
  </>;
}
