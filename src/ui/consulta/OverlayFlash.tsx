import { useEffect, useRef } from "react";
import { ConsultaFlash, type ConsultaFlashProps } from "./ConsultaFlash.js";

export function OverlayFlash({ flash, onFechar, erro = null }: {
  flash: ConsultaFlashProps; onFechar: () => void; erro?: string | null;
}) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    card.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function teclado(e: KeyboardEvent) {
      if (e.key === "Escape" && !flash.ocupado) { e.preventDefault(); onFechar(); }
      if (e.key === "Tab") {
        const itens = Array.from(card.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
        const primeiro = itens[0], ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
      }
    }
    document.addEventListener("keydown", teclado);
    return () => { document.removeEventListener("keydown", teclado); anterior?.focus(); };
  }, [onFechar, flash.ocupado]);
  return <div className="oc-ov oc-ov--fixa" role="dialog" aria-modal="true" aria-label="Consulta Flash">
    <button type="button" className="oc-ov-backdrop" aria-label="Fechar overlay" tabIndex={-1} disabled={flash.ocupado} onClick={onFechar} />
    <div className="oc-ov-card" ref={card}>
      <header className="oc-ov-h"><h3>Consulta Flash</h3><button type="button" disabled={flash.ocupado} onClick={onFechar} aria-label="Fechar Consulta Flash">Fechar</button></header>
      <div className="oc-ov-body">{erro && <p role="alert">{erro}</p>}<ConsultaFlash {...flash} /></div>
    </div>
  </div>;
}
