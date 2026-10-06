// W8-MUSE · MU-04 · invólucro comum dos ícones OncoMed.
// Traço 24×24, cor herdada (currentColor); tamanho e rótulo no uso.
import type { ReactNode } from "react";

export function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
