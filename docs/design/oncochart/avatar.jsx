// ===== OncoAssist · avatar 3D com movimento (olhar segue cursor, piscar, fala, órbitas) =====
function OncoAvatar({ size = 120, speaking = false, mood = '' }) {
  const ref = useRef();
  useEffect(() => {
    const mv = (e) => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const cl = (v) => Math.max(-1, Math.min(1, v));
      el.style.setProperty('--lx', cl((e.clientX - cx) / (r.width * 3)).toFixed(3));
      el.style.setProperty('--ly', cl((e.clientY - cy) / (r.height * 3)).toFixed(3));
    };
    addEventListener('pointermove', mv); return () => removeEventListener('pointermove', mv);
  }, []);
  return (
    <div ref={ref} className={`ava ${speaking ? 'talk' : ''} ${mood}`} style={{ '--s': size + 'px' }} aria-label="OncoAssist">
      <div className="ava-float">
        <div className="ava-halo" />
        <div className="ava-ring r1"><b /></div>
        <div className="ava-ring r2"><b /></div>
        <div className="ava-head">
          <div className="ava-face">
            <div className="ava-eyes"><i /><i /></div>
            <div className="ava-mouth" />
          </div>
        </div>
      </div>
      <div className="ava-shadow" />
    </div>
  );
}

// FAB flutuante na tela principal: dicas rotativas + atalho para a jornada 3D
const AV_HINTS = [
  ['RP −34% na TC de 28/set', 'target'],
  ['Fluoxetina × tamoxifeno: trocar antes da HT', 'alert'],
  ['C11 liberado · todos os gates OK', 'check'],
  ['Ver jornada em 3D', 'cube'],
];
function OncoFab({ onOpen }) {
  const [h, setH] = useState(0); const [hover, setHover] = useState(false);
  useEffect(() => { const t = setInterval(() => setH(v => (v + 1) % AV_HINTS.length), 4800); return () => clearInterval(t); }, []);
  const [txt, ic] = hover ? ['Abrir jornada oncológica 3D', 'cube'] : AV_HINTS[h];
  return (
    <button className="onco-fab av-fab" onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className="av-bubble" key={txt}><Icon n={ic} s={13} />{txt}</span>
      <OncoAvatar size={58} speaking={hover} />
    </button>
  );
}
Object.assign(window, { OncoAvatar, OncoFab });
