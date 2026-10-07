import { useEffect, useMemo, useRef, useState } from "react";
import { Box3D } from "./Box3D.js";
import { Chart3D } from "./Chart3D.js";
import type { ModoChart3D } from "./chart3d-visao.js";
import { JORNADA_WORLD_W, montarParadasJornada } from "./jornada-visao.js";
import type { TimelineVisao } from "./timeline-visao.js";
import { LANES, posicaoNoEixo } from "./timeline-visao.js";

const VIEWS = {
  persp: { tilt: -26, yaw: -10, label: "Perspectiva" },
  top: { tilt: -68, yaw: 0, label: "Topo" },
  low: { tilt: -9, yaw: -26, label: "Rasante" },
} as const;

type Vista = keyof typeof VIEWS;

function preferReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Modal Jornada 3D — CSS preserve-3d, dados da timeline, OncoAssist sem conduta. */
export function Jornada3D({
  visao,
  onFechar,
  onAbrirTc,
}: {
  visao: TimelineVisao;
  onFechar: () => void;
  onAbrirTc?: () => void;
}) {
  const paradas = useMemo(() => montarParadasJornada(visao), [visao]);
  const [sel, setSel] = useState<number | null>(() => {
    const idx = paradas.findIndex((p) => p.hoje);
    return idx >= 0 ? idx : 0;
  });
  const [vista, setVista] = useState<Vista>("persp");
  const [chart, setChart] = useState<ModoChart3D>("recist");
  const [tour, setTour] = useState(false);
  const [reduzir] = useState(preferReducedMotion);
  const camEl = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, yaw: -10, tilt: -26, dist: 650 });
  const tgt = useRef({ ...cam.current });

  const st = sel == null || sel < 0 ? null : paradas[sel] ?? null;

  useEffect(() => {
    if (st?.chart) setChart(st.chart);
  }, [st]);

  useEffect(() => {
    const v = VIEWS[vista];
    tgt.current = st
      ? { x: st.x, yaw: v.yaw - 4, tilt: v.tilt + 6, dist: vista === "top" ? 260 : 120 }
      : { x: 0, yaw: v.yaw, tilt: v.tilt, dist: vista === "top" ? 900 : 640 };
    if (reduzir && camEl.current) {
      const C = tgt.current;
      camEl.current.style.transform = `translateZ(${-C.dist}px) rotateX(${C.tilt}deg) rotateY(${C.yaw}deg) translateX(${-C.x}px)`;
      camEl.current.style.setProperty("--yaw", `${C.yaw}deg`);
    }
  }, [sel, vista, st, reduzir]);

  useEffect(() => {
    if (reduzir) return;
    let raf = 0;
    const f = () => {
      const C = cam.current;
      const G = tgt.current;
      const k = 0.075;
      C.x += (G.x - C.x) * k;
      C.yaw += (G.yaw - C.yaw) * k;
      C.tilt += (G.tilt - C.tilt) * k;
      C.dist += (G.dist - C.dist) * k;
      if (camEl.current) {
        camEl.current.style.transform = `translateZ(${-C.dist}px) rotateX(${C.tilt}deg) rotateY(${C.yaw}deg) translateX(${-C.x}px)`;
        camEl.current.style.setProperty("--yaw", `${C.yaw.toFixed(2)}deg`);
        camEl.current.style.setProperty("--tilt", `${(C.tilt * 0.6).toFixed(2)}deg`);
      }
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [reduzir]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onFechar();
        return;
      }
      if (e.key === "ArrowRight") {
        setSel((s) => Math.min(paradas.length - 1, (s == null ? -1 : s) + 1));
      }
      if (e.key === "ArrowLeft") {
        setSel((s) => Math.max(0, (s == null ? 1 : s) - 1));
      }
      if (e.key === " ") {
        e.preventDefault();
        setTour((t) => !t);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFechar, paradas.length]);

  useEffect(() => {
    if (!tour) return;
    const t = window.setTimeout(() => {
      setSel((s) => {
        const n = (s == null ? 0 : s) + 1;
        if (n >= paradas.length) {
          setTour(false);
          return s;
        }
        return n;
      });
    }, 1800);
    return () => window.clearTimeout(t);
  }, [tour, sel, paradas.length]);

  const hojeX =
    (posicaoNoEixo(visao.hoje, visao.inicio, visao.fim) / 100) * JORNADA_WORLD_W -
    JORNADA_WORLD_W / 2;

  const boxCountBars = visao.barras.length;
  const boxCountStops = paradas.length;
  const totalCaixasEstimado = boxCountBars + boxCountStops + 20; // chart separado

  return (
    <div className="oc-j3" role="dialog" aria-label="Jornada oncológica 3D" data-reduced={reduzir ? "1" : "0"}>
      <button type="button" className="oc-j3-backdrop" aria-label="Fechar jornada" onClick={onFechar} />
      <div className="oc-j3-panel">
        <div className="oc-j3-scene">
          <header className="oc-j3-h">
            <h2>Jornada oncológica · 3D</h2>
            <div className="oc-j3-views" role="group" aria-label="Vista da câmera">
              {(Object.keys(VIEWS) as Vista[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={vista === k}
                  onClick={() => setVista(k)}
                >
                  {VIEWS[k].label}
                </button>
              ))}
            </div>
            <button type="button" onClick={onFechar} aria-label="Fechar jornada 3D">
              Fechar
            </button>
          </header>
          <div className="oc-j3-stage" data-caixas={totalCaixasEstimado}>
            <div className="oc-j3-cam" ref={camEl}>
              <div
                className="oc-j3-floor"
                style={{ width: JORNADA_WORLD_W, height: 480 }}
                aria-hidden
              />
              <div
                className="oc-j3-hoje"
                style={{ transform: `translate3d(${hojeX}px, 0, 0) rotateY(90deg)` }}
                aria-label="Plano HOJE"
              >
                HOJE
              </div>
              {visao.barras.map((b) => {
                const de = posicaoNoEixo(b.de, visao.inicio, visao.fim);
                const ate = posicaoNoEixo(b.ate, visao.inicio, visao.fim);
                const x0 = (de / 100) * JORNADA_WORLD_W - JORNADA_WORLD_W / 2;
                const x1 = (ate / 100) * JORNADA_WORLD_W - JORNADA_WORLD_W / 2;
                const w = Math.max(12, x1 - x0);
                return (
                  <Box3D
                    key={b.id}
                    x={x0 + w / 2}
                    z={[-165, -55, 55, 165][b.lane] ?? 0}
                    w={w}
                    h={12}
                    d={34}
                    color="var(--info)"
                    {...(b.futuro ? { ghost: true } : {})}
                    title={b.rotulo}
                  />
                );
              })}
              {paradas.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`oc-j3-card ${sel === i ? "is-sel" : ""} ${p.futuro ? "is-fut" : ""}`}
                  style={{
                    transform: `translate3d(${p.x}px, -80px, ${p.z}px) rotateY(calc(var(--yaw, -10deg) * -1))`,
                  }}
                  onClick={() => setSel(i)}
                  aria-current={sel === i ? "true" : undefined}
                >
                  <span className="oc-j3-card-k">{p.titulo}</span>
                  <span className="oc-j3-card-s">{p.subtitulo}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="oc-j3-hint">← → navegar · espaço = tour · Esc fecha</p>
          <div className="oc-j3-lanes" aria-label="Raias clínicas">
            {LANES.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

        <aside className="oc-j3-assist" aria-label="OncoAssist jornada">
          <h3>OncoAssist</h3>
          <p className="oc-muted">Narração assistiva — sem conduta.</p>
          <p className="oc-j3-say" role="status">
            {st?.narracao ??
              "Eixo horizontal = tempo; profundidade = raias clínicas. Toque um marco ou inicie o tour."}
          </p>
          <div className="oc-j3-nav">
            <button
              type="button"
              aria-label="Parada anterior"
              onClick={() => setSel((s) => Math.max(0, (s ?? 1) - 1))}
            >
              ‹
            </button>
            <button type="button" onClick={() => setTour((t) => !t)}>
              {tour ? "Pausar tour" : "Tour guiado"}
            </button>
            <button
              type="button"
              aria-label="Próxima parada"
              onClick={() => setSel((s) => Math.min(paradas.length - 1, (s ?? -1) + 1))}
            >
              ›
            </button>
            {st?.lane === 1 && onAbrirTc ? (
              <button type="button" onClick={onAbrirTc}>
                Abrir TC
              </button>
            ) : null}
          </div>
          <div className="oc-j3-chart-h">
            <span>{chart === "recist" ? "RECIST 1.1 · lesões-alvo" : "CTCAE · skyline de toxicidade"}</span>
            <div role="group" aria-label="Modo do Chart3D">
              <button type="button" aria-pressed={chart === "recist"} onClick={() => setChart("recist")}>
                RECIST
              </button>
              <button type="button" aria-pressed={chart === "ctcae"} onClick={() => setChart("ctcae")}>
                CTCAE
              </button>
            </div>
          </div>
          <Chart3D modo={chart} reduzirMotion={reduzir} />
          <p className="oc-j3-disc">
            Narração assistiva com dados sintéticos. Não substitui laudo nem decisão do oncologista.
          </p>
        </aside>
      </div>
    </div>
  );
}
