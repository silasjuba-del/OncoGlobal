import type { ReactNode } from "react";

/** Coluna de 396 px. CURSOR-02: cartão Modelo 08; miolo clínico nas fatias seguintes. */
export function PainelLateral({ children }: { children?: ReactNode }) {
  return (
    <aside className="oc-side" aria-label="Painel lateral" data-coluna="lateral">
      {children}
    </aside>
  );
}
