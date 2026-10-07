import { useEffect, useRef, type ReactNode } from "react";
import { CANVAS_ALTURA, CANVAS_LARGURA, escalaDoCanvas } from "./escala.js";
import type { TemaOnco } from "./tema.js";

// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "../tema/tokens.css";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./tokens.css";

/** Palco fixo 1680×1000, escalado e centrado na janela. */
export function Palco({ tema, children }: { tema: TemaOnco; children: ReactNode }) {
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const aplicar = () => {
      const { escala, x, y } = escalaDoCanvas(window.innerWidth, window.innerHeight);
      el.style.transform = `translate(${x}px, ${y}px) scale(${escala})`;
    };
    aplicar();
    window.addEventListener("resize", aplicar);
    return () => window.removeEventListener("resize", aplicar);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const raiz = canvas.current?.closest(".oc-viewport");
    const aplicar = () => {
      if (raiz instanceof HTMLElement) raiz.dataset.movimento = mq.matches ? "reduzido" : "pleno";
    };
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  return (
    <div className="oc-viewport" data-tema-onco={tema}>
      <div
        ref={canvas}
        className="oc-canvas"
        data-canvas={`${CANVAS_LARGURA}x${CANVAS_ALTURA}`}
        style={{ width: CANVAS_LARGURA, height: CANVAS_ALTURA }}
      >
        {children}
      </div>
    </div>
  );
}
