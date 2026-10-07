// ===== UI primitives: Icon, Btn(ripple), Dropdown, Modal, Drawer, Toasts, Seg, Tabs =====
const { useState, useEffect, useRef, useLayoutEffect, useCallback, createContext, useContext } = React;

const P = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  cal: ['M8 2v4M16 2v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 13h6M9 17h6'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  chart: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z', 'M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5'],
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  chev: ['M9 18l6-6-6-6'], chevD: ['M6 9l6 6 6-6'], chevL: ['M15 18l-6-6 6-6'], chevU: ['M18 15l-6-6-6 6'],
  x: ['M18 6 6 18', 'M6 6l12 12'], plus: ['M12 5v14M5 12h14'], check: ['M20 6 9 17l-5-5'],
  more: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  stop: ['M6 6h12v12H6z'], pause: ['M6 4h4v16H6zM14 4h4v16h-4z'], play: ['M5 3l14 9-14 9z'],
  sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9z'],
  flask: ['M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3'],
  drip: ['M12 2v4M8 6h8v5a4 4 0 0 1-8 0z', 'M12 15v7'],
  drop: ['M12 2.7 5.6 9a8 8 0 1 0 12.8 0z'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4M12 17h.01'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z'],
  pulse: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  scale: ['M12 3v18M5 7h14', 'M5 7l-3 7a4 4 0 0 0 6 0z', 'M19 7l-3 7a4 4 0 0 0 6 0z'],
  img: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
  zoom: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35', 'M11 8v6M8 11h6'],
  ruler: ['M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z', 'M7.5 10.5l2-2M10.5 13.5l2-2M13.5 16.5l2-2'],
  contrast: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 2v20'],
  volume: ['M11 5 6 9H2v6h4l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  beaker: ['M4.5 3h15M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3', 'M6 14h12'],
  dna: ['M4 2c0 6 16 6 16 12s-16 6-16 8', 'M20 2c0 6-16 6-16 12s16 6 16 8', 'M7 5h10M7 19h10M9 9h6M9 15h6'],
  pack: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5M12 13v8'],
  layers: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5M2 12l10 5 10-5'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  refresh: ['M23 4v6h-6M1 20v-6h6', 'M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15'],
  copy: ['M9 9h11v11H9z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z'],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5M21 12H9'],
  list: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  wa: ['M3 21l1.6-4.7A9 9 0 1 1 8 19.6z', 'M9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.6-2-1-1 .8a4.5 4.5 0 0 1-2.6-2.6l.8-1-1-2z'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  spark: ['M12 3v4M12 17v4M3 12h4M17 12h4', 'M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8'],
  columns: ['M3 3h18v18H3z', 'M12 3v18'],
  side: ['M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M15 3v18'],
};
function Icon({ n, s = 16, w = 1.75, style, className }) {
  const d = P[n] || P.more;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      {d.map((x, i) => <path key={i} d={x} />)}
    </svg>
  );
}
P.cube = P.pack; P.rotate = P.refresh;

// ---- hooks ----
function useOutside(ref, cb, on = true) {
  useEffect(() => {
    if (!on) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    const k = (e) => { if (e.key === 'Escape') cb(); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [on, cb]);
}

// ---- Btn com ripple ----
function Btn({ kind = '', sm, icon, onClick, style, children, title }) {
  const ref = useRef();
  const click = (e) => {
    const b = ref.current; if (b) { const r = b.getBoundingClientRect(); const s = document.createElement('span'); const z = Math.max(r.width, r.height); const k = r.width / b.offsetWidth || 1;
      s.className = 'ripple'; s.style.width = s.style.height = z + 'px'; s.style.left = ((e.clientX - r.left) / k - z / 2) + 'px'; s.style.top = ((e.clientY - r.top) / k - z / 2) + 'px'; b.appendChild(s); setTimeout(() => s.remove(), 600); }
    onClick && onClick(e);
  };
  return <button ref={ref} title={title} className={`btn ${kind} ${sm ? 'sm' : ''}`} style={style} onClick={click}>{icon && <Icon n={icon} s={sm ? 13 : 15} />}{children}</button>;
}

// ---- Dropdown ----
const DDCtx = createContext(() => {});
function Dropdown({ trigger, children, align = 'left', width, up }) {
  const [o, setO] = useState(false); const ref = useRef();
  const close = useCallback(() => setO(false), []);
  useOutside(ref, close, o);
  return (
    <div className="dd-wrap" ref={ref}>
      <span onClick={() => setO(v => !v)} style={{ display: 'inline-flex' }}>{typeof trigger === 'function' ? trigger(o) : trigger}</span>
      {o && <DDCtx.Provider value={close}><div className={`dd ${align} ${up ? 'up' : ''}`} style={{ width }}>{children}</div></DDCtx.Provider>}
    </div>
  );
}
function DDItem({ icon, sub, on, onClick, children }) {
  const close = useContext(DDCtx);
  return <button className={`dd-it ${on ? 'on' : ''}`} onClick={() => { onClick && onClick(); close(); }}>
    {icon && <Icon n={icon} s={15} />}<span style={{ flex: 1, minWidth: 0 }}>{children}{sub && <small>{sub}</small>}</span>{on && <Icon n="check" s={13} />}
  </button>;
}

// ---- Modal / Drawer ----
function useClosing(onClose, ms = 240) {
  const [c, setC] = useState(false);
  const close = useCallback(() => { setC(true); setTimeout(onClose, ms); }, [onClose]);
  useEffect(() => { const k = (e) => e.key === 'Escape' && close(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [close]);
  return [c, close];
}
function Modal({ title, icon, sub, width = 640, onClose, footer, children, bodyStyle }) {
  const [c, close] = useClosing(onClose);
  return (
    <div className={c ? 'closing' : ''} style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div className={`backdrop ${c ? 'closing' : ''}`} onClick={close} />
      <div className="modal" style={{ width }}>
        <div className="modal-h">{icon && <span style={{ color: 'var(--accent)' }}><Icon n={icon} s={18} /></span>}
          <div style={{ flex: 1, minWidth: 0 }}><h2>{title}</h2>{sub && <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}</div>
          <button className="icon-btn" onClick={close}><Icon n="x" /></button></div>
        <div className="modal-b" style={bodyStyle}>{children}</div>
        {footer && <div className="modal-f">{typeof footer === 'function' ? footer(close) : footer}</div>}
      </div>
    </div>
  );
}
function Drawer({ title, icon, sub, width = 560, onClose, footer, children }) {
  const [c, close] = useClosing(onClose, 300);
  return (
    <div className={c ? 'closing' : ''} style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div className={`backdrop ${c ? 'closing' : ''}`} onClick={close} />
      <div className="drawer" style={{ width }}>
        <div className="modal-h">{icon && <span style={{ color: 'var(--accent)' }}><Icon n={icon} s={18} /></span>}
          <div style={{ flex: 1, minWidth: 0 }}><h2>{title}</h2>{sub && <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}</div>
          <button className="icon-btn" onClick={close}><Icon n="x" /></button></div>
        <div className="modal-b" style={{ flex: 1 }}>{children}</div>
        {footer && <div className="modal-f">{typeof footer === 'function' ? footer(close) : footer}</div>}
      </div>
    </div>
  );
}

// ---- Toasts ----
const ToastCtx = createContext(() => {});
function ToastHost({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((msg, tone = 'ok', icon = 'check') => {
    const id = Math.random(); setList(l => [...l, { id, msg, tone, icon }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 3200);
  }, []);
  return <ToastCtx.Provider value={push}>{children}
    <div className="toasts">{list.map(t => <div key={t.id} className="toast"><span style={{ color: `var(--${t.tone})` }}><Icon n={t.icon} s={16} /></span>{t.msg}</div>)}</div>
  </ToastCtx.Provider>;
}
const useToast = () => useContext(ToastCtx);

// ---- Seg / Tabs (indicador deslizante) ----
function useInd(value, deps) {
  const box = useRef(); const [ind, setInd] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => { const el = box.current && box.current.querySelector('.on'); if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth }); }, [value, ...(deps || [])]);
  return [box, ind];
}
function Seg({ value, onChange, items }) {
  const [box, ind] = useInd(value);
  return <div className="seg" ref={box}><span className="seg-ind" style={ind} />
    {items.map(i => <button key={i.v} className={value === i.v ? 'on' : ''} onClick={() => onChange(i.v)}>{i.icon && <Icon n={i.icon} s={13} />}{i.l}{i.badge ? <span className="chip sm amber" style={{ height: 16, padding: '0 5px' }}>{i.badge}</span> : null}</button>)}
  </div>;
}
function Tabs({ items, value, onChange }) {
  const [box, ind] = useInd(value);
  return <div className="tabs" ref={box}>
    {items.map(i => <button key={i.v} className={`tab ${value === i.v ? 'on' : ''}`} onClick={() => onChange(i.v)}>{i.icon && <Icon n={i.icon} s={14} />}{i.l}{i.cnt && <span className="cnt">{i.cnt}</span>}</button>)}
    <span className="tab-ind" style={ind} />
  </div>;
}

// ---- CountUp / Switch ----
function CountUp({ to, ms = 700 }) {
  const [v, setV] = useState(0);
  useEffect(() => { let raf, t0; const f = (t) => { t0 = t0 || t; const p = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [to]);
  return <>{v}</>;
}
function Switch({ on, onChange }) { return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />; }

// SidePanel = painel direito (agenda/gráficos/exame)
function SidePanel(p) { return <RightPanel {...p} tab={p.sideTab} setTab={p.setSideTab} />; }


