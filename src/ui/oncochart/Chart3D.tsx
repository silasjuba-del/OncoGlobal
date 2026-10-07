import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box3D } from "./Box3D.js";
import {
  corGrau,
  ctcaeSintetico,
  limiarRpMm,
  recistSintetico,
  somaRecist,
  TIMEPOINTS_RECIST,
  type ModoChart3D,
} from "./chart3d-visao.js";

function C3Label({
  x,
  y = 0,
  z,
  children,
  className = "",
}: {
  x: number;
  y?: number;
  z: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`oc-c3-lbl ${className}`.trim()}
      style={{
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(calc(var(--yaw) * -1)) rotateX(24deg)`,
      }}
    >
      <span>{children}</span>
    </div>
  );
}

/** Chart3D CSS: RECIST 1.1 (−30% RP) ou skyline CTCAE (só graus confirmados). */
export function Chart3D({
  modo,
  reduzirMotion,
}: {
  modo: ModoChart3D;
  reduzirMotion?: boolean;
}) {
  const worldRef = useRef<HTMLDivElement>(null);
  const st = useRef({ base: -34, yaw: -34, drag: null as null | { x: number; yaw: number } });
  const [grown, setGrown] = useState(reduzirMotion === true);

  useEffect(() => {
    if (reduzirMotion) {
      setGrown(true);
      return;
    }
    setGrown(false);
    const t = window.setTimeout(() => setGrown(true), 60);
    return () => window.clearTimeout(t);
  }, [modo, reduzirMotion]);

  useEffect(() => {
    if (reduzirMotion) {
      worldRef.current?.style.setProperty("--yaw", "-30deg");
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      const s = st.current;
      if (!t0) t0 = t;
      if (!s.drag) s.yaw = s.base + Math.sin((t - t0) / 2600) * 20;
      worldRef.current?.style.setProperty("--yaw", `${s.yaw.toFixed(2)}deg`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduzirMotion]);

  const lesoes = recistSintetico();
  const tox = ctcaeSintetico();
  const X = [-112, 0, 112] as const;
  const Z = [-92, 0, 72] as const;
  const K = 2.5;
  const thr = limiarRpMm(lesoes);

  return (
    <div
      className="oc-c3-stage"
      aria-label={modo === "recist" ? "Chart3D RECIST 1.1" : "Chart3D CTCAE skyline"}
      data-modo={modo}
      onPointerDown={(e) => {
        st.current.drag = { x: e.clientX, yaw: st.current.yaw };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (s.drag) s.yaw = s.drag.yaw + (e.clientX - s.drag.x) * 0.4;
      }}
      onPointerUp={() => {
        const s = st.current;
        if (!s.drag) return;
        s.base = s.yaw;
        s.drag = null;
      }}
    >
      <div className="oc-c3-world" ref={worldRef} style={{ ["--yaw" as string]: "-30deg" }}>
        <div className="oc-c3-floor" />
        {modo === "recist"
          ? TIMEPOINTS_RECIST.map((tp, ci) => {
              const soma = somaRecist(lesoes, ci);
              const xi = X[ci]!;
              const zSoma = Z[0];
              return (
                <div key={tp} data-timepoint={tp}>
                  <Box3D
                    x={xi}
                    z={zSoma}
                    w={58}
                    d={46}
                    h={grown ? soma * K : 2}
                    color="var(--amber)"
                    title={`Soma · ${soma} mm`}
                  />
                  <C3Label x={xi} y={-(grown ? soma * K : 0) - 16} z={zSoma} className="val">
                    {soma} mm
                  </C3Label>
                  {lesoes.map((l, ri) => {
                    const zi = Z[ri + 1] ?? Z[2];
                    const mm = l.mm[ci] ?? 0;
                    return (
                      <Box3D
                        key={l.id}
                        x={xi}
                        z={zi}
                        w={58}
                        d={40}
                        h={grown ? mm * K : 2}
                        color={l.cor}
                        title={`${l.rotulo} · ${mm} mm`}
                      />
                    );
                  })}
                  <C3Label x={xi} y={22} z={Z[2] + 52} className="axis">
                    {tp}
                  </C3Label>
                </div>
              );
            })
          : tox.map((g, i) => {
              const cols = ["AC1", "AC2", "AC3", "AC4", "P2", "P4", "P8", "P10"];
              const rows = ["Neutropenia", "Náusea", "Fadiga", "Neuropatia", "Mucosite"];
              const ci = Math.max(0, cols.indexOf(g.ciclo));
              const ri = Math.max(0, rows.indexOf(g.toxicidade));
              return (
                <Box3D
                  key={`${g.toxicidade}-${g.ciclo}-${i}`}
                  x={(ci - 3.5) * 34}
                  z={(ri - 2) * 34}
                  w={26}
                  d={26}
                  h={grown ? 4 + g.grau * 26 : 2}
                  color={corGrau(g.grau)}
                  title={`${g.toxicidade} · ${g.ciclo} · G${g.grau}`}
                />
              );
            })}
        {modo === "recist" ? (
          <>
            <div
              className="oc-c3-plane"
              data-limiar="rp-30"
              style={{
                transform: `translate3d(0, ${-thr * K}px, ${Z[0]}px) rotateX(90deg)`,
              }}
            />
            <C3Label x={196} y={-thr * K} z={Z[0]} className="thr">
              −30% limiar RP
            </C3Label>
          </>
        ) : null}
      </div>
    </div>
  );
}
