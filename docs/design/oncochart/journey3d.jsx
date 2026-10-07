// ===== Jornada oncológica 3D: timeline com profundidade + OncoAssist narrador + gráfico 3D =====
// Eixo X = tempo · eixo Z = raia clínica (profundidade) · eixo Y = altura (pinos / barras)
const J3 = (() => {
  const T = DATA.timeline, W = 1680, DEPTH = 480, LANE_Z = [-165, -55, 55, 165];
  const ppd = W / ((T.end - T.start) / 864e5);
  const X = (d) => ((d - T.start) / 864e5) * ppd - W / 2;
  const D = (y, m, d) => Date.UTC(y, m, d);
  // paradas do tour — narração clínica (dados fictícios, coerentes com DATA)
  const stops = [
    { d: D(2026, 4, 12), lane: 0, k: 'Biópsia core', s: 'CDI G3 · RE 90% · HER2 1+', c: 'var(--accent)', tag: 'Diagnóstico',
      say: 'Biópsia core guiada por US: carcinoma ductal invasivo grau 3, RE 90%, RP 40%, HER2 1+ e Ki-67 35%. Fenótipo luminal B-like de alto risco — é isso que justifica a neoadjuvância com antraciclina e taxano.' },
    { d: D(2026, 4, 20), lane: 1, k: 'TC estadiamento', s: 'Baseline RECIST · 52 mm', c: 'var(--info)', img: 'assets/ct-torax.jpg', exam: 'e1', tag: 'Imagem', chart: 'recist',
      say: 'TC de estadiamento e cintilografia sem doença à distância. Estádio cT2 cN1 M0 — IIB. Duas lesões-alvo definidas: T1 mamária com 34 mm e T2 axilar com 18 mm. Soma de base RECIST: 52 mm.' },
    { d: D(2026, 4, 26), lane: 0, k: 'Painel germinativo', s: 'BRCA1 patogênica', c: 'var(--danger)', tag: 'Biomarcador',
      say: 'Variante patogênica em BRCA1. Três consequências: elegibilidade a olaparibe adjuvante se houver doença residual, discussão de cirurgia redutora de risco e aconselhamento genético da família — a mãe teve câncer de ovário aos 52.' },
    { d: D(2026, 5, 1), lane: 0, k: 'Tumor board', s: 'Neoadjuvância aprovada', c: 'var(--amber)', tag: 'Decisão',
      say: 'Tumor board de mama com cinco especialistas aprovou AC dose-densa seguido de paclitaxel semanal, com intenção curativa. Ecocardiograma basal antes da antraciclina.' },
    { d: D(2026, 5, 23), lane: 2, k: 'AC-dd ×4', s: 'q14d + G-CSF · 02 jun → 14 jul', c: 'var(--info)', tag: 'Sistêmico', chart: 'tox',
      say: 'Quatro ciclos de AC dose-densa a cada 14 dias com suporte de G-CSF. Pior toxicidade: neutropenia G3 no AC3, sem atraso de ciclo. Intensidade de dose preservada.' },
    { d: D(2026, 6, 20), lane: 1, k: 'TC interina', s: 'Doença estável · −12%', c: 'var(--info)', img: 'assets/ct-abdome.jpg', exam: 'e2', tag: 'Imagem', chart: 'recist',
      say: 'TC interina após o AC: soma das lesões caiu de 52 para 46 mm, redução de 12%. Pelo RECIST ainda é doença estável — o limiar de resposta parcial é 30%.' },
    { d: D(2026, 7, 26), lane: 2, k: 'Paclitaxel ×12', s: '80 mg/m² · 144 mg · semanal', c: 'var(--accent)', tag: 'Sistêmico', chart: 'tox',
      say: 'Paclitaxel semanal 80 mg/m², dose calculada de 144 mg para ASC de 1,80. RDI de 98%. Neuropatia periférica G1 estável — principal toxicidade a vigiar ciclo a ciclo.' },
    { d: D(2026, 8, 15), lane: 2, k: 'Ajuste pré-med', s: 'Dexa 20 → 10 mg', c: 'var(--amber)', tag: 'Ajuste',
      say: 'Dexametasona reduzida de 20 para 10 mg por hiperglicemia pós-ciclo em paciente com DM2. Sem reação infusional após o ajuste. Glicemia capilar de 6 em 6 horas por 48 horas.' },
    { d: D(2026, 8, 28), lane: 1, k: 'TC reavaliação', s: 'Resposta parcial · −34%', c: 'var(--ok)', img: 'assets/ct-torax.jpg', exam: 'e1', tag: 'Imagem', chart: 'recist',
      say: 'Reavaliação: T1 com 21 mm e T2 com 11 mm. Soma de 32 mm, redução de 34% sobre a base — resposta parcial pelo RECIST 1.1. Sem lesões novas.' },
    { d: D(2026, 9, 6), lane: 2, k: 'Hoje · Paclitaxel C11', s: 'Gates OK · liberar', c: 'var(--amber)', tag: 'Hoje', today: true,
      say: 'Hoje, ciclo 11 de 12. Todos os gates aprovados: neutrófilos 1.820, plaquetas 182 mil, função hepática normal, neuropatia G1 e glicemia 168. Alerta pendente: fluoxetina inibe CYP2D6 e precisa ser trocada antes do tamoxifeno.' },
    { d: D(2026, 10, 10), lane: 3, k: 'Cirurgia planejada', s: 'Mastectomia + BLS', c: 'var(--ok)', tag: 'Futuro', future: true,
      say: 'Cirurgia planejada cerca de quatro semanas após o último paclitaxel. RM de mamas e ECO antes. A peça cirúrgica dará o RCB, que decide o adjuvante.' },
    { d: D(2026, 11, 10), lane: 2, k: 'Olaparibe adjuvante', s: 'BRCA+ · 1 ano se RCB > 0', c: 'var(--info)', tag: 'Futuro', future: true,
      say: 'Se houver doença residual, olaparibe por um ano conforme OlympiA, associado à hormonioterapia. Trial ONC-BR-207 com match de 92% é alternativa a discutir.' },
    { d: D(2027, 0, 4), lane: 3, k: 'RT adjuvante', s: '14 dez → 25 jan', c: 'var(--ok)', tag: 'Futuro', future: true,
      say: 'Radioterapia adjuvante de parede torácica e drenagens, indicada pelo N1 clínico ao diagnóstico, independentemente da resposta.' },
  ].map(s => ({ ...s, x: X(s.d), z: LANE_Z[s.lane] }));
  // empilhamento vertical para evitar colisão de cards na mesma raia
  [0, 1, 2, 3].forEach(l => { let px = -1e9, lv = 0; stops.filter(s => s.lane === l).sort((a, b) => a.x - b.x).forEach(s => { lv = s.x - px < 170 ? lv + 1 : 0; s.lv = lv; px = s.x; }); });
  const cycles = [];
  for (let i = 0; i < 4; i++) cycles.push({ d: D(2026, 5, 2) + i * 14 * 864e5, k: `AC C${i + 1}`, c: 'var(--info)' });
  for (let i = 0; i < 12; i++) cycles.push({ d: D(2026, 6, 28) + i * 7 * 864e5, k: `P C${i + 1}`, c: 'var(--accent)', future: i >= 11, today: i === 10 });
  const months = []; for (let m = 4; m <= 12; m++) months.push({ x: X(D(2026, m, 1)), l: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m % 12] + (m === 12 ? ' 27' : '') });
  return { T, W, DEPTH, LANE_Z, X, stops, cycles, months, today: X(T.today) };
})();

const J3_VIEWS = { persp: { tilt: -26, yaw: -10, l: 'Perspectiva' }, top: { tilt: -68, yaw: 0, l: 'Topo' }, low: { tilt: -9, yaw: -26, l: 'Rasante' } };

function useTyper(text, speed = 18) {
  const [out, setOut] = useState('');
  useEffect(() => { setOut(''); let i = 0; const t = setInterval(() => { i += 2; setOut(text.slice(0, i)); if (i >= text.length) clearInterval(t); }, speed); return () => clearInterval(t); }, [text]);
  return [out, out.length < text.length];
}

function Journey3D({ onClose, openViewer }) {
  const [c, close] = useClosing(onClose, 300);
  const [sel, setSel] = useState(LS3('sel', 9)); const [view, setView] = useState(LS3('view', 'persp'));
  const [play, setPlay] = useState(false); const [voice, setVoice] = useState(false);
  const [chart, setChart] = useState('recist');
  const cam = useRef({ x: 0, yaw: -10, tilt: -26, dist: 650 }); const tgt = useRef({ ...cam.current });
  const user = useRef({ yaw: 0, dist: 0, drag: null }); const camEl = useRef();
  const S = J3.stops; const st = sel == null ? null : S[sel];
  useEffect(() => { localStorage.setItem('onco.j3.sel', JSON.stringify(sel)); localStorage.setItem('onco.j3.view', JSON.stringify(view)); }, [sel, view]);
  useEffect(() => { if (st && st.chart) setChart(st.chart); }, [sel]);

  // alvo de câmera
  useEffect(() => {
    const v = J3_VIEWS[view]; user.current.yaw = 0; user.current.dist = 0;
    tgt.current = st ? { x: st.x, yaw: v.yaw - 4, tilt: v.tilt + 6, dist: view === 'top' ? 260 : -60 } : { x: 0, yaw: v.yaw, tilt: v.tilt, dist: view === 'top' ? 900 : 640 };
  }, [sel, view]);
  // loop de câmera (lerp + respiração)
  useEffect(() => {
    let raf; const f = (t) => {
      const C = cam.current, G = tgt.current, U = user.current, k = .075;
      const sway = U.drag ? 0 : Math.sin(t / 3200) * 2.2;
      C.x += (G.x - C.x) * k; C.yaw += (G.yaw + U.yaw + sway - C.yaw) * k; C.tilt += (G.tilt - C.tilt) * k; C.dist += (G.dist + U.dist - C.dist) * k;
      const el = camEl.current;
      if (el) { el.style.transform = `translateZ(${-C.dist}px) rotateX(${C.tilt}deg) rotateY(${C.yaw}deg) translateX(${-C.x}px)`; el.style.setProperty('--yaw', C.yaw.toFixed(2) + 'deg'); el.style.setProperty('--tilt', (C.tilt * .6).toFixed(2) + 'deg'); }
      raf = requestAnimationFrame(f);
    }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, []);

  const text = st ? st.say : 'Esta é a jornada da Marina em três dimensões. O eixo horizontal é o tempo, a profundidade separa as raias clínicas — diagnóstico, imagem, tratamento sistêmico e cirurgia com radioterapia. Toque em qualquer marco ou aperte play para eu conduzir o caso do diagnóstico até o plano adjuvante.';
  const [said, typing] = useTyper(text);
  useEffect(() => {
    if (!voice || !window.speechSynthesis) return; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = 1.05; speechSynthesis.speak(u);
    return () => speechSynthesis.cancel();
  }, [text, voice]);
  // tour automático
  useEffect(() => {
    if (!play || typing) return;
    const t = setTimeout(() => setSel(s => { const n = s == null ? 0 : s + 1; if (n >= S.length) { setPlay(false); return s; } return n; }), voice ? 5200 : 2600);
    return () => clearTimeout(t);
  }, [play, typing, sel]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'ArrowRight') setSel(s => Math.min(S.length - 1, (s == null ? -1 : s) + 1)); if (e.key === 'ArrowLeft') setSel(s => Math.max(0, (s == null ? 1 : s) - 1)); if (e.key === ' ') { e.preventDefault(); setPlay(p => !p); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);

  const down = (e) => { if (e.target.closest('.j3-card,.j3-thumb')) return; user.current.drag = { x: e.clientX, y: e.clientY, yaw: user.current.yaw }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { const U = user.current; if (U.drag) U.yaw = Math.max(-40, Math.min(40, U.drag.yaw + (e.clientX - U.drag.x) * .18)); };
  const up = () => { user.current.drag = null; };
  const wheel = (e) => { user.current.dist = Math.max(-500, Math.min(700, user.current.dist + e.deltaY * .8)); };
  const go = (i) => { setPlay(false); setSel(i === sel ? null : i); };

  const near = (x) => !st ? 1 : Math.max(.28, 1 - Math.abs(x - st.x) / 520);
  return (
    <div className={c ? 'closing' : ''} style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div className={`backdrop ${c ? 'closing' : ''}`} onClick={close} />
      <div className="j3" style={{ animation: c ? 'modalOut .25s forwards' : 'viewerIn .55s var(--spring)' }}>
        <div className="j3-main">
          <div className="j3-head">
            <span style={{ color: 'var(--accent)' }}><Icon n="cube" s={18} /></span>
            <h2>Jornada oncológica · 3D</h2>
            <span className="chip sm accent">D+147</span><span className="chip sm">cT2 cN1 M0 · IIB</span><span className="chip sm ok">RP −34%</span>
            <div className="seg j3-views">
              {Object.entries(J3_VIEWS).map(([k, v]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{v.l}</button>)}
            </div>
            <button className="icon-btn" title="Visão geral" onClick={() => go(null)}><Icon n="zoom" s={16} /></button>
          </div>

          <div className="j3-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
            <div className="j3-cam" ref={camEl}>
              {/* chão: meses, raias, futuro */}
              <div className="j3-floor" style={{ width: J3.W, height: J3.DEPTH, left: -J3.W / 2, top: -J3.DEPTH / 2 }}>
                <div className="j3-future" style={{ left: J3.today + J3.W / 2 }} />
                {J3.LANE_Z.map((z, i) => <div key={i} className="j3-lane" style={{ top: z + J3.DEPTH / 2 - 26 }}><span>{J3.T.lanes[i]}</span></div>)}
                {J3.months.map(m => <div key={m.l} className="j3-month" style={{ left: m.x + J3.W / 2 }}><span>{m.l}</span></div>)}
              </div>
              {/* plano HOJE */}
              <div className="j3-today" style={{ transform: `translate3d(${J3.today}px, 0, 0) rotateY(90deg)` }} />
              <div className="j3-bb" style={{ transform: `translate3d(${J3.today}px, -232px, 0) rotateY(calc(var(--yaw) * -1))` }}><span className="j3-hoje">HOJE · 06 out</span></div>
              {/* barras de tratamento (volume) */}
              {J3.T.bars.map(b => { const a = J3.X(b.a), e = J3.X(b.b); return <Box3D key={b.k} x={(a + e) / 2} z={J3.LANE_Z[b.lane]} w={e - a} d={34} h={12} color={b.c} ghost={b.future} />; })}
              {/* ciclos = pilares */}
              {J3.cycles.map((cy, i) => <Box3D key={i} x={J3.X(cy.d)} z={J3.LANE_Z[2]} w={7} d={7} h={cy.today ? 52 : 28} color={cy.today ? 'var(--amber)' : cy.c} ghost={cy.future} cls={cy.today ? 'j3-pulse' : ''} title={cy.k} />)}
              {/* marcos */}
              {S.map((s, i) => {
                const h = 54 + s.lv * 66 + (s.lane === 2 ? 14 : 0), on = sel === i;
                return (
                  <React.Fragment key={i}>
                    <div className={`j3-dot ${on ? 'on' : ''}`} style={{ transform: `translate3d(${s.x}px, 0, ${s.z}px) rotateX(90deg)`, color: s.c }} />
                    <div className="j3-bb" style={{ transform: `translate3d(${s.x}px, 0, ${s.z}px) rotateY(calc(var(--yaw) * -1))`, opacity: near(s.x), filter: st && !on && Math.abs(s.x - st.x) > 300 ? 'blur(1.2px)' : 'none' }}>
                      <i className="j3-stem" style={{ height: h, color: s.c }} />
                      {s.img
                        ? <button className={`j3-thumb ${on ? 'on' : ''}`} style={{ bottom: h }} onClick={() => go(i)}><img src={s.img} alt="" draggable={false} /><span><b>{s.k}</b>{s.s}</span></button>
                        : <button className={`j3-card ${on ? 'on' : ''} ${s.future ? 'future' : ''}`} style={{ bottom: h, '--c': s.c }} onClick={() => go(i)}>
                            <small>{new Date(s.d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })} · {s.tag}</small><b>{s.k}</b><span>{s.s}</span></button>}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="j3-hint">Arraste = orbitar · scroll = aproximar · ← → navegar · espaço = tour</div>
          </div>

          {/* scrubber 2D sincronizado */}
          <div className="j3-scrub">
            <div className="j3-scrub-track">
              <div className="j3-scrub-fill" style={{ width: ((J3.today + J3.W / 2) / J3.W * 100) + '%' }} />
              {S.map((s, i) => <button key={i} title={s.k} className={`j3-tick ${sel === i ? 'on' : ''} ${s.future ? 'future' : ''}`} style={{ left: ((s.x + J3.W / 2) / J3.W * 100) + '%', color: s.c }} onClick={() => go(i)} />)}
              {J3.months.map(m => <span key={m.l} className="j3-scrub-m" style={{ left: ((m.x + J3.W / 2) / J3.W * 100) + '%' }}>{m.l}</span>)}
            </div>
          </div>
        </div>

        {/* OncoAssist */}
        <div className="j3-side">
          <div className="j3-ava-row">
            <OncoAvatar size={104} speaking={typing} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-.3px' }}>OncoAssist</div>
              <div className="faint" style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><span className={`dot ${typing ? 'pulse' : ''}`} style={{ color: typing ? 'var(--accent)' : 'var(--ok)' }} />{typing ? 'narrando o caso…' : play ? 'tour em andamento' : 'pronto'}</div>
            </div>
            <button className="icon-btn" title="Ler em voz alta" onClick={() => setVoice(v => !v)} style={{ color: voice ? 'var(--accent)' : '' }}><Icon n="volume" /></button>
            <button className="icon-btn" onClick={close}><Icon n="x" /></button>
          </div>

          <div className="card j3-say" key={sel ?? 'intro'}>
            {st && <div className="j3-say-h" style={{ color: st.c }}><span className="mono">{String(sel + 1).padStart(2, '0')}/{S.length}</span>{st.k}</div>}
            <div className="say">{said}{typing && <span className="caret" />}</div>
          </div>

          <div className="j3-nav">
            <Btn sm icon="chevL" onClick={() => go(Math.max(0, (sel ?? 1) - 1))} />
            <Btn sm kind="primary" icon={play ? 'pause' : 'play'} onClick={() => { if (!play && (sel == null || sel >= S.length - 1)) setSel(0); setPlay(p => !p); }}>{play ? 'Pausar tour' : 'Tour guiado'}</Btn>
            <Btn sm icon="chev" onClick={() => go(Math.min(S.length - 1, (sel ?? -1) + 1))} />
            {st && st.exam && <Btn sm kind="ghost" icon="img" style={{ marginLeft: 'auto' }} onClick={() => openViewer(st.exam)}>Abrir TC</Btn>}
          </div>
          <div className="j3-prog">{S.map((s, i) => <i key={i} className={i === sel ? 'on' : i < (sel ?? -1) ? 'done' : ''} style={{ color: s.c }} onClick={() => go(i)} />)}</div>

          <div className="card j3-chart">
            <div className="card-h"><h3>{chart === 'recist' ? 'RECIST 1.1 · lesões-alvo' : 'CTCAE v5 · skyline de toxicidade'}</h3>
              <div className="r"><Seg value={chart} onChange={setChart} items={[{ v: 'recist', l: 'RECIST' }, { v: 'tox', l: 'CTCAE' }]} /></div></div>
            <Chart3D mode={chart} />
            <div className="j3-legend">
              {chart === 'recist'
                ? <><span><i style={{ background: 'var(--amber)' }} />Soma</span><span><i style={{ background: 'var(--accent)' }} />T1 mama</span><span><i style={{ background: 'var(--info)' }} />T2 axila</span><span className="mono" style={{ marginLeft: 'auto' }}>52 → 32 mm</span></>
                : <><span><i style={{ background: 'var(--ok)' }} />G1</span><span><i style={{ background: 'var(--amber)' }} />G2</span><span><i style={{ background: 'var(--danger)' }} />G3</span><span className="faint" style={{ marginLeft: 'auto' }}>altura = grau</span></>}
            </div>
          </div>
          <div className="faint" style={{ fontSize: 10, padding: '0 2px' }}>Narração assistiva com dados fictícios. Não substitui laudo nem decisão do oncologista.</div>
        </div>
      </div>
    </div>
  );
}
function LS3(k, d) { try { const v = localStorage.getItem('onco.j3.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
Object.assign(window, { Journey3D, J3 });
