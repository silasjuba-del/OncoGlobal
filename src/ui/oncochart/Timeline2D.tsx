import { useState } from "react";
import {
  mesesDoEixo,
  posicaoNoEixo,
  type TimelineVisao,
} from "./timeline-visao.js";

export function Timeline2D({
  visao,
  onVer3d,
}: {
  visao: TimelineVisao;
  onVer3d: () => void;
}) {
  const [ocultas, setOcultas] = useState<Record<number, boolean>>({});
  const meses = mesesDoEixo(visao.inicio, visao.fim);
  const hojeX = posicaoNoEixo(visao.hoje, visao.inicio, visao.fim);

  return (
    <section className="oc-tl" aria-label="Linha do tempo oncológica">
      <div className="oc-tl-head">
        <h3>Linha do tempo oncológica</h3>
        {visao.cicloChip ? <span className="oc-chip oc-chip-accent">{visao.cicloChip}</span> : (
          <span className="oc-chip">ciclo PENDENTE</span>
        )}
        <button type="button" className="oc-tl-3d" onClick={onVer3d}>
          Ver em 3D
        </button>
        <div className="oc-tl-legend">
          {visao.lanes.map((lane, i) => (
            <button
              key={lane}
              type="button"
              aria-pressed={!ocultas[i]}
              onClick={() => setOcultas((h) => ({ ...h, [i]: !h[i] }))}
              style={{ opacity: ocultas[i] ? 0.35 : 1 }}
            >
              {lane}
            </button>
          ))}
        </div>
      </div>
      <div className="oc-tl-body">
        <div className="oc-tl-lanes">
          {visao.lanes.map((lane, i) => (
            <div key={lane} className="oc-tl-lane-l" style={{ opacity: ocultas[i] ? 0.35 : 1 }}>
              {lane}
            </div>
          ))}
        </div>
        <div className="oc-tl-track">
          {visao.lanes.map((lane, li) => (
            <div
              key={lane}
              className="oc-tl-row"
              style={{ opacity: ocultas[li] ? 0.12 : 1 }}
              data-lane={lane}
            >
              {visao.barras
                .filter((b) => b.lane === li)
                .map((b) => {
                  const left = posicaoNoEixo(b.de, visao.inicio, visao.fim);
                  const right = posicaoNoEixo(b.ate, visao.inicio, visao.fim);
                  return (
                    <div
                      key={b.id}
                      className={`oc-tl-bar${b.futuro ? " oc-tl-future" : ""}`}
                      style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}
                      title={b.rotulo}
                    >
                      <span>{b.rotulo}</span>
                    </div>
                  );
                })}
              {visao.eventos
                .filter((e) => e.lane === li)
                .map((e) => (
                  <div
                    key={e.id}
                    className={`oc-tl-ev${e.futuro ? " oc-tl-future" : ""}${e.miniatura ? " oc-tl-thumb" : ""}`}
                    style={{ left: `${posicaoNoEixo(e.em, visao.inicio, visao.fim)}%` }}
                    title={`${e.titulo} · ${e.subtitulo}`}
                  >
                    <span className="oc-tl-pt" />
                    <span className="oc-tl-tip">
                      <b>{e.titulo}</b>
                      {e.futuro ? " · futuro" : ""}
                      <br />
                      {e.subtitulo}
                    </span>
                  </div>
                ))}
            </div>
          ))}
          <div className="oc-tl-today" style={{ left: `${hojeX}%` }} aria-label="HOJE" />
          <div className="oc-tl-axis">
            {meses.map((m) => (
              <span
                key={m.em}
                style={{ left: `${posicaoNoEixo(m.em, visao.inicio, visao.fim)}%` }}
              >
                {m.rotulo}
              </span>
            ))}
          </div>
        </div>
      </div>
      {visao.stageHistory.length > 0 ? (
        <div className="oc-tl-hist" role="region" aria-label="Histórico de estádio">
          {visao.stageHistory.map((h) => (
            <span key={`${h.em}-${h.tnm}`}>
              {h.em}: {h.tnm} · {h.estadio}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
