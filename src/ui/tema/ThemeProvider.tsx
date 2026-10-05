import type { ReactNode } from "react";
import { TEMAS, type TemaId } from "./temas.js";

// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./tokens.css";

/** Só aplica o tema. Não lê nem reescreve o conteúdo clínico dos filhos. */
export function ThemeProvider({ tema, children }: { tema: TemaId; children: ReactNode }) {
  return (
    <div data-tema={TEMAS[tema].id} className="tema">
      {children}
    </div>
  );
}
