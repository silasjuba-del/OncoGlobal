import { useEffect } from "react";
import { ConsultaFlash, type ConsultaFlashProps } from "./ConsultaFlash.js";

/** Overlay "Consulta Flash" com a Flash real dentro. Fecha por Esc ou pelos botões. */
export function OverlayFlash({ flash, onFechar }: { flash: ConsultaFlashProps; onFechar: () => void }) {
  useEffect(() => {
    function k(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onFechar]);
  return (
    <div className="oc-ov" role="dialog" aria-label="Consulta Flash">
      <button type="button" className="oc-ov-backdrop" aria-label="Fechar overlay" onClick={onFechar} />
      <div className="oc-ov-card">
        <header className="oc-ov-h">
          <h3>Consulta Flash</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar Consulta Flash">
            Fechar
          </button>
        </header>
        <div className="oc-ov-body">
          <ConsultaFlash {...flash} />
        </div>
      </div>
    </div>
  );
}
