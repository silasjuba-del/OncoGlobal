// ===== Painel lateral: Agenda/Fila · Painel (gráficos) · Exame selecionado =====
const STATUS = {
  done: { l: 'Atendido', c: 'ok' }, now: { l: 'Em consulta', c: 'accent' },
  wait: { l: 'Aguardando', c: 'amber' }, triage: { l: 'Triagem', c: 'info' }, sched: { l: 'Agendado', c: '' },
};

function Queue({ queue, onCall, calling }) {
  const cur = queue.find(q => q.st === 'now');
  const next = queue.find(q => q.st === 'wait' || q.st === 'triage');
  const counts = { done: queue.filter(q => q.st === 'done').length, wait: queue.filter(q => q.st === 'wait' || q.st === 'triage').length, total: queue.length };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
      <div className="kpis">
        <div className="kpi"><div className="l">Agendados</div><div className="n"><CountUp to={counts.total} /></div></div>
        <div className="kpi"><div className="l">Atendidos</div><div className="n" style={{ color: 'var(--ok)' }}><CountUp to={counts.done} /></div></div>
        <div className="kpi"><div className="l">Na fila</div><div className="n" style={{ color: 'var(--amber)' }}><CountUp to={counts.wait} /></div></div>
      </div>
      <div className="callboard">
        <div style={{ fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', opacity: .85, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}><span className="dot pulse" style={{ flexShrink: 0 }} /> Painel de chamada · Consultório 3</div>
        <div className="row1">
          <div>
            <div className={`big ${calling ? 'flash' : ''}`} key={cur?.n}>{cur ? cur.n.toUpperCase() : '—'}</div>
            <div style={{ fontSize: 11, opacity: .85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur ? cur.s : ''} · senha <span className="mono">A-0{queue.indexOf(cur) + 12}</span></div>
          </div>
          <Btn sm kind="" style={{ background: '#fff3', borderColor: 'transparent', color: 'inherit' }} icon="volume" onClick={onCall}>Chamar</Btn>
        </div>
        <div style={{ fontSize: 10.5, opacity: .85, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Próximo: <b>{next.n}</b> · aguarda {next.wait} min</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ fontSize: 12.5, fontWeight: 600 }}>Agenda de hoje</h3>
        <span className="faint" style={{ fontSize: 11 }}>{DATA.today}</span>
        <div style={{ marginLeft: 'auto' }}>
          <Dropdown align="right" trigger={<button className="link">Todos <Icon n="chevD" s={12} /></button>}>
            <div className="dd-lbl">Filtrar fila</div>
            <DDItem on>Todos</DDItem><DDItem>Quimioterapia</DDItem><DDItem>1ª consulta</DDItem><DDItem>Retorno / resultado</DDItem>
          </Dropdown>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', margin: '0 -6px', padding: '0 6px', minHeight: 0 }}>
        {queue.map((q, i) => {
          const st = STATUS[q.st];
          return (
            <div key={q.n} className={`q-it ${q.st === 'now' ? 'cur' : ''} ${calling && q.st === 'now' ? 'q-leave' : ''}`} style={{ opacity: q.st === 'done' ? .55 : 1 }}>
              <div className="t">{q.t}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div className="avatar" style={{ width: 28, height: 28, fontSize: 10.5, background: 'var(--surface-3)', color: 'var(--muted)' }}>{q.ini}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{q.n}{q.flag && <span className={`chip sm ${q.flag === 'Prioridade' ? 'danger' : 'info'}`} style={{ height: 17 }}>{q.flag}</span>}</div>
                  <div className="sub">{q.s}</div>
                </div>
              </div>
              <span className={`status chip sm ${st.c}`}>{q.st === 'now' && <span className="dot pulse" />}{st.l}{q.wait && q.st !== 'now' ? <span className="mono" style={{ opacity: .7 }}>· {q.wait}′</span> : null}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Charts ----------
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.v + d.n)); const H = 110;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: H + 22 }}>
      {data.map((d, i) => (
        <div key={d.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${d.v} retornos · ${d.n} novos`}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: H, gap: 2 }}>
            <div className="grow-bar" style={{ height: (d.n / max) * H, background: 'var(--amber)', borderRadius: '5px 5px 2px 2px', animationDelay: i * 60 + 'ms' }} />
            <div className="grow-bar" style={{ height: (d.v / max) * H, background: d.d === 'Hoje' ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 55%, var(--surface-3))', borderRadius: 2, animationDelay: i * 60 + 'ms' }} />
          </div>
          <span style={{ fontSize: 10.5, color: d.d === 'Hoje' ? 'var(--accent)' : 'var(--faint)', fontWeight: d.d === 'Hoje' ? 600 : 400 }}>{d.d}</span>
        </div>
      ))}
    </div>
  );
}
function LineChart({ data }) {
  const W = 340, H = 80, max = 30;
  const pts = data.map((v, i) => [i * (W / (data.length - 1)), H - (v / max) * H]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <svg width="100%" viewBox={`0 -6 ${W} ${H + 12}`} style={{ overflow: 'visible' }}>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--info)" stopOpacity=".3" /><stop offset="1" stopColor="var(--info)" stopOpacity="0" /></linearGradient></defs>
      <line x1="0" x2={W} y1={H - (15 / max) * H} y2={H - (15 / max) * H} stroke="var(--line-strong)" strokeDasharray="3 4" />
      <text x={W} y={H - (15 / max) * H - 4} textAnchor="end" fontSize="9" fill="var(--faint)">meta 15 min</text>
      <path d={d + ` L${W} ${H} L0 ${H}Z`} fill="url(#lg)" style={{ animation: 'fade 1s .5s both' }} />
      <path d={d} fill="none" stroke="var(--info)" strokeWidth="2.2" className="draw-line" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? 'var(--info)' : 'var(--surface)'} stroke="var(--info)" strokeWidth="1.5" />)}
    </svg>
  );
}
function Donut({ data }) {
  const tot = data.reduce((a, b) => a + b.v, 0); let acc = 0; const R = 38, C = 2 * Math.PI * R;
  const [hov, setHov] = useState(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <g transform="rotate(-90 52 52)">
          {data.map((s, i) => { const len = (s.v / tot) * C; const el = <circle key={s.k} cx="52" cy="52" r={R} fill="none" stroke={s.c} strokeWidth={hov === i ? 16 : 12} strokeDasharray={`${len - 2} ${C}`} strokeDashoffset={-acc} style={{ transition: 'stroke-width .2s' }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} />; acc += len; return el; })}
        </g>
        <text x="52" y="50" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--text)" fontFamily="Geist Mono">{hov != null ? data[hov].v + '%' : '109'}</text>
        <text x="52" y="64" textAnchor="middle" fontSize="9" fill="var(--faint)">{hov != null ? data[hov].k : 'atend. semana'}</text>
      </svg>
      <div style={{ display: 'grid', gap: 4, fontSize: 11.5, flex: 1 }}>
        {data.map((s, i) => <div key={s.k} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: hov == null || hov === i ? 1 : .45, transition: 'opacity .2s', cursor: 'default' }}><span style={{ width: 8, height: 8, borderRadius: 3, background: s.c }} />{s.k}<span className="mono faint" style={{ marginLeft: 'auto' }}>{s.v}%</span></div>)}
      </div>
    </div>
  );
}
function Dashboard() {
  const S = DATA.stats;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', minHeight: 0, flex: 1 }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}><h3 style={{ fontSize: 12.5, fontWeight: 600 }}>Atendimentos · semana</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 10.5 }} className="muted"><span><i className="dot" style={{ display: 'inline-block', color: 'var(--accent)' }} /> retorno</span><span><i className="dot" style={{ display: 'inline-block', color: 'var(--amber)' }} /> novo</span></div></div>
        <BarChart data={S.week} />
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}><h3 style={{ fontSize: 12.5, fontWeight: 600 }}>Tempo de espera</h3><span className="mono" style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 600, color: 'var(--info)' }}><CountUp to={11} /> min</span></div>
        <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>Média das últimas 8 semanas · ↓ 50%</div>
        <LineChart data={S.wait} />
      </div>
      <div className="card" style={{ padding: 12 }}>
        <h3 style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Casuística por sítio</h3>
        <Donut data={S.mix} />
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">Cadeiras QT</div><div className="n"><CountUp to={7} />/10</div></div>
        <div className="kpi"><div className="l">Em trial</div><div className="n" style={{ color: 'var(--accent)' }}><CountUp to={14} /></div></div>
        <div className="kpi"><div className="l">Tox ≥ G3</div><div className="n" style={{ color: 'var(--danger)' }}><CountUp to={2} /></div></div>
      </div>
    </div>
  );
}

function ExamSide({ exam, setExam, openViewer }) {
  const [tab, setTab] = useState('resumo');
  const ex = DATA.exams.find(e => e.id === exam) || DATA.exams[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
      <Dropdown width={360} trigger={(o) => (
        <button className="card" style={{ width: 376, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, textAlign: 'left' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--info-soft)', color: 'var(--info)', display: 'grid', placeItems: 'center' }}><Icon n={ex.img ? 'img' : 'flask'} /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{ex.name}</div><div className="faint" style={{ fontSize: 11 }}>{ex.date}</div></div>
          <span className="chip sm ok">{ex.status}</span>
          <Icon n="chevD" s={14} style={{ transform: o ? 'rotate(180deg)' : '', transition: 'transform .25s' }} />
        </button>)}>
        <div className="dd-lbl">Exames do paciente</div>
        {DATA.exams.map(e => <DDItem key={e.id} icon={e.img ? 'img' : 'flask'} on={e.id === ex.id} sub={e.date + ' · ' + e.type} onClick={() => setExam(e.id)}>{e.name}</DDItem>)}
      </Dropdown>
      <Seg value={tab} onChange={setTab} items={[{ v: 'resumo', l: 'Resumo' }, { v: 'laudo', l: 'Laudo' }, { v: 'img', l: 'Imagens' }]} />
      <div key={ex.id + tab} style={{ animation: 'paneIn .3s var(--ease)', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', minHeight: 0 }}>
        {ex.img && tab !== 'laudo' && (
          <div className="img-card" style={{ height: tab === 'img' ? 300 : 170 }} onClick={() => openViewer(ex.id)}>
            <img src={ex.img} alt="" />
            <div className="ov"><Icon n="zoom" s={14} /> Ampliar · OncoAssist explica <span style={{ marginLeft: 'auto' }} className="mono">1/248</span></div>
          </div>
        )}
        <div className="card" style={{ padding: 12 }}>
          <dl className="kv">
            <dt>Indicação</dt><dd>Reavaliação pós-ciclo 10 · RECIST 1.1</dd>
            <dt>Técnica</dt><dd>{ex.type === 'TC' ? 'Helicoidal, contraste IV, cortes 1,25 mm' : ex.type}</dd>
            <dt>Conclusão</dt><dd>{ex.concl}</dd>
            {ex.id === 'e1' && <><dt>Comparação</dt><dd><span className="chip sm ok">RP · −34%</span> vs 20 mai 2026</dd></>}
          </dl>
        </div>
        {tab === 'laudo' && <div className="card" style={{ padding: 12, fontSize: 12, lineHeight: 1.6 }} >
          <b>Achados:</b> Lesão sólida espiculada na mama esquerda, QSE, medindo 21 × 17 mm (prévio 34 × 28 mm). Linfonodo axilar esquerdo nível I com 11 mm no menor eixo (prévio 18 mm). Ausência de nódulos pulmonares, derrame pleural ou linfonodomegalia mediastinal. Estruturas ósseas sem lesões líticas/blásticas.<br /><b>Impressão:</b> resposta parcial segundo RECIST 1.1 (soma 32 mm vs 52 mm).
        </div>}
        {ex.img && <Btn kind="primary" icon="zoom" onClick={() => openViewer(ex.id)} style={{ justifyContent: 'center' }}>Abrir visualizador + explicação</Btn>}
      </div>
    </div>
  );
}

Object.assign(window, { Queue, Dashboard, ExamSide, BarChart, LineChart, Donut });
