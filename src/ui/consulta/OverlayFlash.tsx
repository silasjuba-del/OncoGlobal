import { useDialogoAcessivel } from "../oncochart/dialogoAcessivel.js";
import { ConsultaFlash, type ConsultaFlashProps } from "./ConsultaFlash.js";

export function OverlayFlash({ flash, onFechar, erro = null }: {
  flash: ConsultaFlashProps; onFechar: () => void; erro?: string | null;
}) {
  const raiz = useDialogoAcessivel<HTMLDivElement>(() => { if (!flash.ocupado) onFechar(); });
  return <div ref={raiz} className="oc-ov oc-ov--fixa" role="dialog" aria-modal="true" aria-label="Consulta Flash">
    <button type="button" className="oc-ov-backdrop" aria-label="Fechar overlay" tabIndex={-1} disabled={flash.ocupado} onClick={onFechar} />
    <div className="oc-ov-card">
      <header className="oc-ov-h"><h3>Consulta Flash</h3><button type="button" disabled={flash.ocupado} onClick={onFechar} aria-label="Fechar Consulta Flash">Fechar</button></header>
      <div className="oc-ov-body">{erro && <p role="alert">{erro}</p>}<ConsultaFlash {...flash} /></div>
    </div>
  </div>;
}
