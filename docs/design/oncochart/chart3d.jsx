// ===== Primitivo Box3D (CSS preserve-3d) + Gráfico 3D: RECIST (lesões × tempo) e CTCAE skyline =====
function Box3D({ x = 0, y = 0, z = 0, w, h, d, color, ghost, title, onClick, cls = '', style }) {
  const base = ghost ? 'transparent' : null;
  const f = (W, H, tf, shade, k) => (
    <div key={k} className="b3f" style={{ width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transform: tf,
      background: base || `color-mix(in oklch, ${color} ${shade}%, oklch(0.18 0.03 280))`, borderColor: color }} />
  );
  return (
    <div className={`b3 ${ghost ? 'ghost' : ''} ${cls}`} title={title} onClick={onClick}
      style={{ transform: `translate3d(${x}px, ${y - h / 2}px, ${z}px)`, ...style }}>
      {f(w, h, `translateZ(${d / 2}px)`, 88, 'f')}
      {f(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, 64, 'b')}
      {f(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, 72, 'r')}
      {f(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, 72, 'l')}
      {f(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, 100, 't')}
    </div>
  );
}

// rótulo que sempre encara a câmera do gráfico
function C3Label({ x, y = 0, z, children, cls = '' }) {
  return <div className={`c3-lbl ${cls}`} style={{ transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(calc(var(--yaw) * -1)) rotateX(24deg)` }}><span>{children}</span></div>;
}

// Dados RECIST derivados (baseline/interina/reavaliação) — fictícios, coerentes com DATA.recist
const C3_RECIST = {
  tp: ['Baseline\n20 mai', 'Interina\n20 jul', 'Reaval.\n28 set'],
  rows: [{ k: 'T1 · mama E', v: [34, 30, 21], c: 'var(--accent)' }, { k: 'T2 · axila E', v: [18, 16, 11], c: 'var(--info)' }],
};

function Chart3D({ mode }) {
  const wref = useRef(); const st = useRef({ base: -34, yaw: -34, drag: null, t0: 0 });
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(false); const t = setTimeout(() => setGrown(true), 60); return () => clearTimeout(t); }, [mode]);
  useEffect(() => {
    let raf; const tick = (t) => { const s = st.current; if (!s.t0) s.t0 = t;
      if (!s.drag) s.yaw = s.base + Math.sin((t - s.t0) / 2600) * 20;
      wref.current && wref.current.style.setProperty('--yaw', s.yaw.toFixed(2) + 'deg'); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  const down = (e) => { st.current.drag = { x: e.clientX, yaw: st.current.yaw }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { const s = st.current; if (s.drag) s.yaw = s.drag.yaw + (e.clientX - s.drag.x) * .4; };
  const up = () => { const s = st.current; if (!s.drag) return; s.drag = null; s.base = s.yaw; s.t0 = performance.now(); };

  let body;
  if (mode === 'recist') {
    const K = 2.5, X = [-112, 0, 112], Z = [-92, 0, 72];
    const sums = C3_RECIST.tp.map((_, i) => C3_RECIST.rows.reduce((a, r) => a + r.v[i], 0));
    const thr = sums[0] * 0.7;
    body = <>
      {C3_RECIST.tp.map((t, ci) => <React.Fragment key={ci}>
        <Box3D x={X[ci]} z={Z[0]} w={58} d={46} h={grown ? sums[ci] * K : 2} color="var(--amber)" title={`Soma · ${sums[ci]} mm`} cls="grow" style={{ transitionDelay: ci * 120 + 'ms' }} />
        <C3Label x={X[ci]} y={-(grown ? sums[ci] * K : 0) - 16} z={Z[0]} cls="val">{sums[ci]}<small> mm</small></C3Label>
        {C3_RECIST.rows.map((r, ri) => <Box3D key={ri} x={X[ci]} z={Z[ri + 1]} w={58} d={40} h={grown ? r.v[ci] * K : 2} color={r.c} title={`${r.k} · ${r.v[ci]} mm`} cls="grow" style={{ transitionDelay: (ci * 120 + (ri + 1) * 90) + 'ms' }} />)}
        <C3Label x={X[ci]} y={22} z={Z[2] + 52} cls="axis">{t.split('\n').map((l, i) => <div key={i}>{l}</div>)}</C3Label>
      </React.Fragment>)}
      <div className="c3-plane" style={{ width: 340, height: 64, left: -170, top: -32, transform: `translate3d(0, ${-thr * K}px, ${Z[0]}px) rotateX(90deg)` }} />
      <C3Label x={196} y={-thr * K} z={Z[0]} cls="thr">−30%<small> limiar RP</small></C3Label>
      {['Soma', 'T1', 'T2'].map((k, i) => <C3Label key={k} x={-196} y={-6} z={Z[i]} cls="axis">{k}</C3Label>)}
    </>;
  } else {
    const C = DATA.chemo.tox, G = ['var(--line-strong)', 'var(--ok)', 'var(--amber)', 'var(--danger)', 'var(--danger)'];
    body = <>
      {C.g.map((row, ri) => row.map((g, ci) => {
        const x = (ci - 4) * 34, z = (ri - 2.5) * 34;
        return <Box3D key={ri + '-' + ci} x={x} z={z} w={26} d={26} h={grown ? 4 + g * 26 : 2} color={G[g]} title={`${C.rows[ri]} · ${C.cols[ci]} · G${g}`} cls="grow" style={{ transitionDelay: (ci * 40 + ri * 30) + 'ms' }} />;
      }))}
      {C.cols.map((c, ci) => <C3Label key={c} x={(ci - 4) * 34} y={14} z={3.5 * 34} cls="axis sm">{c}</C3Label>)}
      {C.rows.map((r, ri) => <C3Label key={r} x={-4 * 34 - 66} y={-4} z={(ri - 2.5) * 34} cls="axis sm">{r}</C3Label>)}
    </>;
  }
  return (
    <div className="c3-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="c3-world" ref={wref}>
        <div className="c3-floor" />
        {body}
      </div>
    </div>
  );
}
Object.assign(window, { Box3D, Chart3D, C3_RECIST });
