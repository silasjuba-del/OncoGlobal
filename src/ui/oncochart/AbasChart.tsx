import { useEffect, useRef, useState, type ReactNode } from "react";

export type AbaChart = "geral" | "qt" | "clin" | "evo";

const ABAS: readonly { id: AbaChart; rotulo: string; chip?: string }[] = [
  { id: "geral", rotulo: "Visão geral" },
  { id: "qt", rotulo: "Quimioterapia", chip: "Cn" },
  { id: "clin", rotulo: "Dados clínicos" },
  { id: "evo", rotulo: "Evolução" },
];

export function AbasChart({
  valor,
  onChange,
  cicloChip,
  children,
}: {
  valor: AbaChart;
  onChange: (aba: AbaChart) => void;
  cicloChip: string | null;
  children: (aba: AbaChart) => ReactNode;
}) {
  const lista = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const root = lista.current;
    if (!root) return;
    const ativo = root.querySelector<HTMLElement>(`[data-aba="${valor}"]`);
    if (!ativo) return;
    setInd({ left: ativo.offsetLeft, width: ativo.offsetWidth });
  }, [valor, cicloChip]);

  return (
    <section className="oc-abas" aria-label="Abas da consulta">
      <div className="oc-tabs" ref={lista} role="tablist">
        {ABAS.map((aba) => {
          const rotulo =
            aba.id === "qt" && cicloChip ? `Quimioterapia (${cicloChip})` : aba.rotulo;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              data-aba={aba.id}
              aria-selected={valor === aba.id}
              className={`oc-tab${valor === aba.id ? " on" : ""}`}
              onClick={() => onChange(aba.id)}
            >
              {rotulo}
            </button>
          );
        })}
        <span className="oc-tab-ind" style={{ left: ind.left, width: ind.width }} aria-hidden="true" />
      </div>
      <div className="oc-tab-content" role="tabpanel">
        {children(valor)}
      </div>
    </section>
  );
}
