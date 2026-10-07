import { useState } from "react";
import { classeSemaforo } from "../tema/temas.js";

/** OncoAssist narra laudo e achados já extraídos — sem diagnosticar, medir ou conduzir (D-W9-40). */
export function ImageViewerOncoAssist({
  exameTitulo,
  laudo,
  achados,
  alertasRads,
  onFechar,
  onTrecho,
}: {
  exameTitulo: string;
  laudo: string;
  achados: readonly { id: string; texto: string; trechoFonte: string }[];
  alertasRads: readonly { id: string; rotulo: string; trecho: string }[];
  onFechar: () => void;
  onTrecho: (trecho: string) => void;
}) {
  const [voz, setVoz] = useState(false);
  const [narracao, setNarracao] = useState<string | null>(null);
  const [morfo, setMorfo] = useState<string | null>(null);
  const [pontos, setPontos] = useState(0);

  function narrar() {
    const texto = [
      `Laudo de ${exameTitulo}.`,
      ...achados.map((a) => a.texto),
    ].join(" ");
    setNarracao(texto);
    if (voz && typeof window.speechSynthesis !== "undefined") {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "pt-BR";
      u.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  return (
    <div className="oc-viewer" role="dialog" aria-label="Visualizador de imagem">
      <header className="oc-viewer-h">
        <h3>{exameTitulo}</h3>
        <button type="button" onClick={onFechar} aria-label="Fechar visualizador">
          Fechar
        </button>
      </header>
      <div className="oc-viewer-grid">
        <div className="oc-viewer-img" aria-label="Imagem">
          <div className="oc-img-placeholder">imagem sintética</div>
          <button
            type="button"
            onClick={() => {
              const n = pontos + 1;
              setPontos(n);
              if (n >= 4) {
                setMorfo("DRAFT / NEEDS_REVIEW — morfometria sintética; não alimenta RECIST");
                setPontos(0);
              }
            }}
          >
            Modo 4 cliques ({pontos}/4)
          </button>
          {morfo ? (
            <p className={classeSemaforo("PENDENTE")} data-selo="morfometria">
              {morfo}
            </p>
          ) : null}
        </div>
        <div className="oc-viewer-assist" aria-label="OncoAssist">
          <h4>OncoAssist</h4>
          <p className="oc-muted">Narra o laudo e achados já extraídos — sem conduta.</p>
          <label>
            <input
              type="checkbox"
              checked={voz}
              onChange={(e) => setVoz(e.target.checked)}
              aria-label="Voz local pt-BR"
            />{" "}
            Voz local (opcional)
          </label>
          <button type="button" onClick={narrar}>
            Narrar laudo
          </button>
          {narracao ? <p role="status" className="oc-narracao">{narracao}</p> : null}
          <div className="oc-laudo-lado" aria-label="Laudo">
            <h5>Laudo</h5>
            <p>{laudo}</p>
          </div>
          <ul aria-label="Achados extraídos">
            {achados.map((a) => (
              <li key={a.id}>
                {a.texto}{" "}
                <button type="button" className="oc-link-fonte" onClick={() => onTrecho(a.trechoFonte)}>
                  fonte
                </button>
              </li>
            ))}
          </ul>
          {alertasRads.length > 0 ? (
            <div aria-label="Alertas RADS">
              {alertasRads.map((a) => (
                <span
                  key={a.id}
                  className={`oc-chip oc-chip-danger ${classeSemaforo("VERMELHO")}`}
                  title={a.trecho}
                >
                  {a.rotulo}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
