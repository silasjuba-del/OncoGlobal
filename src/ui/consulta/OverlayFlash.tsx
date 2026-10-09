import { useEffect } from "react";
import { ConsultaFlash, type ConsultaFlashProps } from "./ConsultaFlash.js";

/** Overlay "Consulta Flash" com a Flash real dentro. Fecha por Esc ou pelos botões. */
export function OverlayFlash({ flash, onFechar, erro = null }: {
  flash: ConsultaFlashProps;
  onFechar: () => void;
  /** W12-F4: erro de salvar/finalizar. O overlay continua aberto e as marcações ficam como estão. */
  erro?: string | null;
}) {
  useEffect(() => {
    function k(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onFechar]);
  return (
    <div className="oc-ov oc-ov--fixa" role="dialog" aria-label="Consulta Flash">
      <button type="button" className="oc-ov-backdrop" aria-label="Fechar overlay" onClick={onFechar} />
      <div className="oc-ov-card">
        <header className="oc-ov-h">
          <h3>Consulta Flash</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar Consulta Flash">
            Fechar
          </button>
        </header>
        <div className="oc-ov-body">
          {erro ? <p role="alert">{erro}</p> : null}
          <ConsultaFlash {...flash} />
        </div>
      </div>
    </div>
  );
}
