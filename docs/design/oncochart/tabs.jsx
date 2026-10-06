// ===== Conteúdo das abas: Visão geral · Quimioterapia · Dados clínicos · Evolução =====
const TONE = { danger: 'var(--danger)', amber: 'var(--amber)', info: 'var(--info)', ok: 'var(--ok)' };

function Comorb({ open }) {
  return (
    <div className="card">
      <div className="card-h"><h3>Comorbidades</h3><span className="chip sm">{DATA.comorb.length}</span><div className="r"><button className="link" onClick={() => open('clin')}>Detalhar <Icon n="chev" s={12} /></button></div></div>
      <div className="card-b"><div className="como">
        {DATA.comorb.map(c => (
          <div key={c.k} className="como-it">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: TONE[c.tone] }}><Icon n={c.icon} s={15} /></span><b>{c.k}</b><span className="dot" style={{ marginLeft: 'auto', color: TONE[c.tone] }} /></div>
            <small>{c.s}</small>
          </div>
        ))}
      </div></div>
    </div>
  );
}
function Interactions({ open, compact }) {
  const [op, setOp] = useState(0);
  return (
    <div className="card" style={{ flex: 1 }}>
      <div className="card-h"><h3>Interações medicamentosas</h3><span className="chip sm danger">1 grave</span><span className="chip sm amber">2 mod.</span><div className="r"><button className="link" onClick={() => open('ix')}>Matriz <Icon n="chev" s={12} /></button></div></div>
      <div className="card-b">
        {DATA.interactions.slice(0, compact ? 3 : 4).map((i, k) => (
          <div key={k} className={`ix ${op === k ? 'open' : ''}`} onClick={() => setOp(op === k ? -1 : k)}>
            <div className="ix-h"><span className="sev" style={{ background: TONE[i.sev], height: 14 }} /><span>{i.a}</span><span className="faint">×</span><span>{i.b}</span>
              <span className={`chip sm ${i.sev}`} style={{ marginLeft: 'auto' }}>{i.t}</span><Icon n="chevD" s={13} style={{ transform: op === k ? 'rotate(180deg)' : '', transition: 'transform .25s', color: 'var(--faint)' }} /></div>
            <div className="ix-d">{i.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function ExamOrder({ onSend }) {
  const cats = Object.keys(DATA.orderable); const [cat, setCat] = useState(cats[0]);
  const [sel, setSel] = useState({ 'RM de mamas (pós-neo)': true, 'Hemograma completo': true, 'Ecocardiograma (FEVE)': true });
  const [pri, setPri] = useState('Rotina'); const toast = useToast();
  const n = Object.values(sel).filter(Boolean).length;
  return (
    <div className="card" style={{ flex: 1 }}>
      <div className="card-h"><h3>Solicitação de exames</h3><span className="chip sm accent" key={n} style={{ animation: 'bump .35s var(--spring)' }}>{n} selec.</span>
        <div className="r">
          <Dropdown align="right" trigger={(o) => <button className="sel" style={{ height: 26, fontSize: 11.5 }}>{pri}<Icon n="chevD" s={12} /></button>}>
            {['Rotina', 'Prioritário', 'Urgente'].map(p => <DDItem key={p} on={p === pri} onClick={() => setPri(p)}>{p}</DDItem>)}
          </Dropdown>
        </div></div>
      <div className="card-b" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="ex-cat">{cats.map(c => <button key={c} className={`chip sm ${c === cat ? 'accent' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div key={cat} style={{ animation: 'paneIn .25s var(--ease)', flex: 1, overflow: 'auto' }}>
          {DATA.orderable[cat].map(e => (
            <div key={e} className={`ex-it ${sel[e] ? 'on' : ''}`} onClick={() => setSel(s => ({ ...s, [e]: !s[e] }))}>
              <span className="cbx"><Icon n="check" s={12} w={3} /></span>{e}
              {e.includes('Eco') && <span className="chip sm amber" style={{ marginLeft: 'auto' }}>pós-antraciclina</span>}
              {e.includes('RM de mamas') && <span className="chip sm info" style={{ marginLeft: 'auto' }}>pré-cirúrgico</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <Btn sm kind="ghost" icon="layers" onClick={() => toast('Pacote "Pré-cirúrgico mama" aplicado', 'accent', 'layers')}>Pacote tumor-pack</Btn>
          <Btn sm kind="primary" icon="send" style={{ marginLeft: 'auto' }} onClick={() => { toast(`${n} exames solicitados · ${pri}`); setSel({}); }}>Solicitar {n}</Btn>
        </div>
      </div>
    </div>
  );
}
function Recist({ openViewer }) {
  const R = DATA.recist; const sb = R.lesions.reduce((a, l) => a + l.b, 0), sc = R.lesions.reduce((a, l) => a + l.c, 0);
  return (
    <div className="card">
      <div className="card-h"><h3>RECIST 1.1</h3><span className="chip sm ok">{R.resp} · {R.pct}%</span><div className="r"><button className="link" onClick={() => openViewer('e1')}>Ver TC <Icon n="chev" s={12} /></button></div></div>
      <div className="card-b">
        <div style={{ position: 'relative', height: 26, marginBottom: 8 }}>
          <div style={{ position: 'absolute', inset: '10px 0', borderRadius: 4, background: 'linear-gradient(90deg, var(--ok) 0 30%, var(--info) 30% 70%, var(--danger) 70%)', opacity: .25 }} />
          {[['−30% RP', 30], ['0', 50], ['+20% DP', 70]].map(([l, p]) => <span key={l} style={{ position: 'absolute', left: p + '%', top: 0, fontSize: 9, transform: 'translateX(-50%)' }} className="faint mono">{l}</span>)}
          <div style={{ position: 'absolute', left: '22%', top: 7, width: 12, height: 12, borderRadius: '50%', background: 'var(--ok)', transform: 'translateX(-50%)', boxShadow: '0 0 0 3px var(--surface)', animation: 'pop .6s var(--spring)' }} />
        </div>
        {R.lesions.map(l => (
          <div key={l.id} className="row" style={{ padding: '5px 0' }}>
            <span className="chip sm">{l.id}</span><span style={{ flex: 1, fontSize: 12 }}>{l.site}</span>
            <span className="mono faint" style={{ fontSize: 11.5 }}>{l.b}</span><Icon n="chev" s={12} style={{ color: 'var(--faint)' }} /><span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ok)' }}>{l.c} mm</span>
          </div>
        ))}
        <div className="row" style={{ padding: '5px 0', fontSize: 12 }}><b style={{ flex: 1 }}>Soma diâmetros</b><span className="mono">{sb} → <b style={{ color: 'var(--ok)' }}>{sc} mm</b></span></div>
      </div>
    </div>
  );
}

function Overview({ open, openViewer }) {
  const C = DATA.chemo;
  return (
    <div className="g" style={{ gridTemplateColumns: '1.05fr 1fr 1fr' }}>
      <div className="col">
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => open('chemo')}>
          <div className="card-h"><Icon n="drip" s={15} style={{ color: 'var(--accent)' }} /><h3>Terapia sistêmica atual</h3><div className="r"><span className="chip sm amber"><span className="dot pulse" />Hoje: {C.current}</span></div></div>
          <div className="card-b">
            <div style={{ fontWeight: 600, fontSize: 14 }}>{C.protocol}</div>
            <div className="faint" style={{ fontSize: 11.5, marginBottom: 8 }}>{C.ref} · RDI {C.rdi}%</div>
            <CycleTrack />
          </div>
        </div>
        <Recist openViewer={openViewer} />
        <Comorb open={open} />
      </div>
      <div className="col"><Interactions open={open} /></div>
      <div className="col"><ExamOrder /></div>
    </div>
  );
}

function CycleTrack({ big }) {
  const C = DATA.chemo;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {C.phases.map((p, pi) => (
        <div key={p.k}>
          <div style={{ display: 'flex', fontSize: 11, marginBottom: 4 }} className="muted"><span>{p.k} · {p.every}</span><span className="mono" style={{ marginLeft: 'auto' }}>{p.done}/{p.n}</span></div>
          <div className="cyc-track">
            {Array.from({ length: p.n }).map((_, i) => {
              const done = i < p.done, today = pi === 1 && i === p.done;
              return <div key={i} title={`${p.k} C${i + 1}`} className={`cyc cyc-fill ${done ? 'done ' + p.color : ''} ${today ? 'today' : ''}`} style={{ height: big ? 34 : 24, animationDelay: (pi * 4 + i) * 35 + 'ms' }}>{today ? 'HOJE' : `C${i + 1}`}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChemoPane({ open }) {
  const C = DATA.chemo; const P = DATA.patient; const toast = useToast();
  const [red, setRed] = useState(100); const [gatesRun, setGatesRun] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGatesRun(true), 300); return () => clearTimeout(t); }, []);
  const tc = (g) => ['var(--surface-2)', 'color-mix(in oklch, var(--ok) 40%, transparent)', 'color-mix(in oklch, var(--amber) 55%, transparent)', 'color-mix(in oklch, var(--danger) 70%, transparent)', 'var(--danger)'][g];
  const pac = Math.round(80 * P.bsa * red / 100);
  return (
    <div className="g" style={{ gridTemplateColumns: '1.35fr 1fr' }}>
      <div className="col">
        <div className="card">
          <div className="card-h"><Icon n="drip" s={15} style={{ color: 'var(--accent)' }} /><h3>{C.protocol}</h3><span className="chip sm">{C.ref}</span>
            <div className="r">
              <Dropdown align="right" width={260} trigger={<button className="sel" style={{ height: 28 }}>Trocar protocolo <Icon n="chevD" s={12} /></button>}>
                <div className="dd-lbl">Mama · tumor-pack v3.2</div>
                <DDItem on sub="Neoadjuvante HR+/HER2−">AC-dd → Paclitaxel</DDItem>
                <DDItem sub="Neoadjuvante, s/ antraciclina">TC ×6</DDItem>
                <DDItem sub="TNBC · KEYNOTE-522">Pembro + Carbo-Pacli → AC</DDItem>
                <DDItem sub="HER2+ · TRAIN-2">TCHP ×6</DDItem>
              </Dropdown>
            </div></div>
          <div className="card-b"><CycleTrack big /></div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="card-h"><h3>Prescrição do dia · C11 D1</h3><span className="chip sm">ASC {P.bsa.toFixed(2).replace('.', ',')} m² · {P.weight} kg</span>
            <div className="r"><span className="faint" style={{ fontSize: 11 }}>Dose</span>
              <Dropdown align="right" trigger={<button className="sel" style={{ height: 26, fontSize: 11.5, color: red < 100 ? 'var(--amber)' : '' }}>{red}%<Icon n="chevD" s={12} /></button>}>
                <div className="dd-lbl">Nível de dose</div>
                {[100, 90, 80, 75].map(v => <DDItem key={v} on={v === red} onClick={() => { setRed(v); v < 100 && toast(`Redução para ${v}% registrada · justificar na evolução`, 'amber', 'alert'); }} sub={v === 100 ? 'Dose plena' : v === 80 ? 'Neuropatia G2' : ''}>{v}%</DDItem>)}
              </Dropdown>
            </div></div>
          <div className="card-b">
            <table className="rx">
              <thead><tr><th>Fármaco</th><th>Dose</th><th>Calculada</th><th>Via</th><th>Obs.</th></tr></thead>
              <tbody>{C.rx.map((r, i) => (
                <tr key={r.drug}><td style={{ fontWeight: 600 }}>{r.drug}</td><td className="mono">{r.dose}</td>
                  <td className="mono" style={{ fontWeight: 600, color: i === 0 && red < 100 ? 'var(--amber)' : '' }}>{i === 0 ? pac + ' mg' : r.calc}</td><td>{r.route}</td><td className="muted">{r.note}</td></tr>
              ))}</tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <span className="chip sm amber"><Icon n="alert" s={12} />Dexa × Metformina: glicemia capilar 6/6h por 48h</span>
              <Btn sm icon="copy" style={{ marginLeft: 'auto' }} onClick={() => toast('Prescrição copiada do ciclo anterior')}>Repetir C10</Btn>
              <Btn sm kind="primary" icon="check" onClick={() => open('chemo')}>Liberar para farmácia</Btn>
            </div>
          </div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="card-h"><Icon n="shield" s={15} style={{ color: 'var(--ok)' }} /><h3>Critérios de liberação (gates)</h3><div className="r"><span className="chip sm ok">{gatesRun ? '6/6 aprovados' : 'checando…'}</span></div></div>
          <div className="card-b">{C.gates.map((g, i) => (
            <div key={g.k} className={`gate ${gatesRun ? (g.ok ? 'pass' : 'fail') : ''}`} style={{ transitionDelay: i * 90 + 'ms' }}>
              <span className="ck" style={{ transitionDelay: i * 90 + 'ms' }}><Icon n="check" s={11} w={3} /></span>{g.k}<span className="val">{g.v}</span>
            </div>
          ))}</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="card-h"><h3>Toxicidade CTCAE v5 por ciclo</h3><div className="r" style={{ gap: 3 }}>{[0, 1, 2, 3].map(g => <span key={g} style={{ width: 16, height: 12, borderRadius: 3, background: tc(g), fontSize: 8, display: 'grid', placeItems: 'center' }} className="mono">G{g}</span>)}</div></div>
          <div className="card-b">
            <div className="heat" style={{ gridTemplateColumns: `86px repeat(${C.tox.cols.length}, 1fr)` }}>
              <span />{C.tox.cols.map(c => <span key={c} className="mono faint" style={{ fontSize: 9.5, textAlign: 'center' }}>{c}</span>)}
              {C.tox.rows.map((r, ri) => <React.Fragment key={r}><span style={{ fontSize: 11.5, alignSelf: 'center' }}>{r}</span>{C.tox.g[ri].map((g, ci) => <span key={ci} className="hc" title={`${r} · ${C.tox.cols[ci]} · G${g}`} style={{ background: tc(g), color: g >= 3 ? '#fff' : 'var(--text)', animation: `fade .4s ${(ri * 9 + ci) * 12}ms both` }}>{g || ''}</span>)}</React.Fragment>)}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5 }} className="muted">Neuropatia periférica G1 estável desde P4 — reavaliar a cada ciclo (critério de redução: G2).</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClinicalPane() {
  const H = DATA.history;
  return (
    <div className="g" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
      <div className="col">
        <div className="card"><div className="card-h"><h3>Antecedentes pessoais (AP)</h3></div>
          <div className="card-b" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{H.ap.map(a => <span key={a} className="chip">{a}</span>)}
            <div className="muted" style={{ fontSize: 11.5, width: '100%', marginTop: 4 }}>Gineco-obstétrico: {H.gyn}</div></div></div>
        <div className="card"><div className="card-h"><h3>Alergias</h3><span className="chip sm danger">{DATA.allergies.length}</span></div>
          <div className="card-b">{DATA.allergies.map(a => <div key={a.k} className="row"><Icon n="alert" s={15} style={{ color: 'var(--danger)' }} /><b>{a.k}</b><span className="muted" style={{ flex: 1 }}>{a.r}</span><span className="chip sm amber">{a.sev}</span></div>)}
            <div className="faint" style={{ fontSize: 11 }}>Sem alergia a taxanos/platinas registrada.</div></div></div>
        <div className="card" style={{ flex: 1 }}><div className="card-h"><h3>Cirurgias prévias</h3></div>
          <div className="card-b">{H.surg.map(s => <div key={s.k} className="row"><span className="mono faint" style={{ width: 36 }}>{s.y}</span>{s.k}</div>)}</div></div>
      </div>
      <div className="col">
        <div className="card" style={{ flex: 1 }}><div className="card-h"><h3>Medicamentos de uso contínuo (MUC)</h3><span className="chip sm">{DATA.meds.length}</span></div>
          <div className="card-b">{DATA.meds.map(m => <div key={m.n} className="row"><Icon n="drop" s={14} style={{ color: 'var(--info)' }} /><b style={{ fontWeight: 600 }}>{m.n}</b><span className="muted mono" style={{ marginLeft: 'auto', fontSize: 11.5 }}>{m.d}</span>{m.n === 'Fluoxetina' && <span className="chip sm danger">CYP2D6</span>}</div>)}</div></div>
      </div>
      <div className="col">
        <div className="card"><div className="card-h"><h3>História familiar (HF)</h3><span className="chip sm danger">Síndrome HBOC</span></div>
          <div className="card-b">{H.fam.map(f => <div key={f.k} className="row"><b style={{ width: 90 }}>{f.k}</b><span className="muted">{f.v}</span></div>)}</div></div>
        <div className="card" style={{ flex: 1 }}><div className="card-h"><h3>Hábitos de vida</h3></div>
          <div className="card-b">{H.habits.map(h => <div key={h.k} className="row"><span className="dot" style={{ color: TONE[h.tone] || 'var(--faint)' }} /><b style={{ width: 110, fontWeight: 500 }}>{h.k}</b><span className="muted">{h.v}</span></div>)}</div></div>
      </div>
    </div>
  );
}

function EvolutionPane({ note, setNote }) {
  const toast = useToast();
  const soap = [['S', 'Subjetivo'], ['O', 'Objetivo'], ['A', 'Avaliação'], ['P', 'Plano']];
  return (
    <div className="g" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
      <div className="card"><div className="card-h"><Icon n="edit" s={15} /><h3>Evolução de hoje · SOAP</h3><span className="chip sm ok">autosalvo 09:14</span>
        <div className="r"><Btn sm kind="ghost" icon="zap" onClick={() => toast('Rascunho gerado pelo OncoAssist a partir do áudio', 'accent', 'zap')}>Gerar do áudio</Btn></div></div>
        <div className="card-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {soap.map(([k, l]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 11, fontWeight: 600 }}><span className="chip sm accent" style={{ marginRight: 6 }}>{k}</span>{l}</span>
              <textarea className="ta" rows={5} value={note[k]} onChange={(e) => setNote({ ...note, [k]: e.target.value })} /></label>
          ))}
        </div></div>
      <div className="card"><div className="card-h"><h3>Evoluções anteriores</h3></div>
        <div className="card-b">
          {[['29 set', 'Paclitaxel C10', 'Neuropatia G1. Glicemia pós-dexa 248. Reduzida dexa.'], ['22 set', 'Paclitaxel C9', 'Sem intercorrências. ECOG 1.'], ['15 set', 'Paclitaxel C8', 'Fadiga G1. Ajuste pré-medicação.'], ['28 jul', 'Início taxano', 'ECO FEVE 62% pós-AC.'], ['14 jul', 'AC C4', 'Neutropenia G2, sem febre.']].map(([d, k, t]) => (
            <div key={d} className="row" style={{ alignItems: 'flex-start' }}><span className="mono faint" style={{ width: 46, fontSize: 11.5 }}>{d}</span><div><b style={{ fontWeight: 600 }}>{k}</b><div className="muted" style={{ fontSize: 11.5 }}>{t}</div></div></div>
          ))}
        </div></div>
    </div>
  );
}

Object.assign(window, { Overview, ChemoPane, ClinicalPane, EvolutionPane, CycleTrack, Interactions });
