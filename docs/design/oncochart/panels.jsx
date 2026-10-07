// ===== Painéis: coluna esquerda (dados clínicos) · direita (agenda/gráficos) · tumor-pack =====
function DadosPanel({ open, tab, setTab }) {
  const C = DATA.chemo, S = DATA.stats;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
      <Seg value={tab} onChange={setTab} items={[
        { v: 'clin', l: 'Clínico', icon: 'heart' }, { v: 'tox', l: 'Toxicidade', icon: 'pulse' }, { v: 'dose', l: 'Doses', icon: 'drip' }]} />
      <div key={tab} style={{ flex: 1, minHeight: 0, overflow: 'auto', animation: 'paneIn .3s var(--ease)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'clin' && <>
          <div className="card" style={{ flexShrink: 0 }}>
            <div className="card-h"><h3>Performance status</h3><span className="chip sm accent">RDI {C.rdi}%</span></div>
            <div className="card-b">
              <div className="heat" style={{ gridTemplateColumns: 'repeat(16,1fr)', gap: 2 }}>
                {C.dose.map((d, i) => <span key={i} title={`Ciclo ${i + 1} · dose ${d}%`} className="hc" style={{ height: 18, fontSize: 9, background: d === 100 ? 'color-mix(in oklch, var(--accent) 30%, transparent)' : 'var(--amber-soft)', color: 'var(--text)' }}>{i + 1}</span>)}
              </div>
              <div className="faint" style={{ fontSize: 11, marginTop: 7 }}>Intensidade de dose relativa mantida em <b style={{ color: 'var(--text)' }}>98%</b> — nenhuma redução aplicada até aqui.</div>
            </div>
          </div>
          <Interactions open={open} compact />
          <div className="card" style={{ flexShrink: 0 }}>
            <div className="card-h"><h3>Comorbidades</h3><span className="chip sm">{DATA.comorb.length}</span></div>
            <div className="card-b">{DATA.comorb.map(c => <div key={c.k} className="row" style={{ padding: '6px 0' }}><span style={{ color: TONE[c.tone], flexShrink: 0 }}><Icon n={c.icon} s={14} /></span><div style={{ minWidth: 0 }}><b style={{ fontSize: 12 }}>{c.k}</b><div className="faint ell" style={{ fontSize: 10.5 }}>{c.s}</div></div><span className="dot" style={{ marginLeft: 'auto', color: TONE[c.tone], flexShrink: 0 }} /></div>)}</div>
          </div>
        </>}
        {tab === 'tox' && <>
          <div className="card" style={{ flex: 1 }}>
            <div className="card-h"><h3>CTCAE v5 · mapa por ciclo</h3></div>
            <div className="card-b">
              <div className="heat" style={{ gridTemplateColumns: `84px repeat(${C.tox.cols.length},1fr)`, gap: 3 }}>
                <span />{C.tox.cols.map(c => <span key={c} className="mono faint" style={{ fontSize: 9, textAlign: 'center' }}>{c}</span>)}
                {C.tox.rows.map((r, ri) => <React.Fragment key={r}><span style={{ fontSize: 11, alignSelf: 'center' }}>{r}</span>{C.tox.g[ri].map((g, ci) => <span key={ci} className="hc" title={`${r} · ${C.tox.cols[ci]} · G${g}`} style={{ background: ['var(--surface-2)', 'color-mix(in oklch,var(--ok) 40%,transparent)', 'color-mix(in oklch,var(--amber) 55%,transparent)', 'color-mix(in oklch,var(--danger) 70%,transparent)', 'var(--danger)'][g], color: g >= 3 ? '#fff' : 'var(--text)', fontSize: 9 }}>{g || ''}</span>)}</React.Fragment>)}
              </div>
            </div>
          </div>
          <div className="card" style={{ flexShrink: 0 }}>
            <div className="card-h"><h3>Alertas de toxicidade</h3></div>
            <div className="card-b">
              <div className="row" style={{ padding: '6px 0' }}><span className="chip sm amber">G1</span><span style={{ flex: 1, fontSize: 11.5 }}>Neuropatia periférica — estável, reavaliar a cada ciclo</span></div>
              <div className="row" style={{ padding: '6px 0' }}><span className="chip sm danger">G2</span><span style={{ flex: 1, fontSize: 11.5 }}>Neutropenia em AC3 — resolvida sem G-CSF adicional</span></div>
            </div>
          </div>
        </>}
        {tab === 'dose' && <div className="card" style={{ flex: 1 }}>
          <div className="card-h"><h3>Prescrição calculada · hoje</h3><span className="chip sm">ASC {DATA.patient.bsa.toFixed(2).replace('.', ',')} m²</span></div>
          <div className="card-b">
            <table className="rx"><tbody>{C.rx.map(r => <tr key={r.drug}><td style={{ fontWeight: 600 }}>{r.drug}</td><td className="mono" style={{ textAlign: 'right' }}>{r.calc}</td></tr>)}</tbody></table>
            <div style={{ marginTop: 10 }}>{C.gates.slice(0, 4).map(g => <div key={g.k} className="gate pass"><span className="ck"><Icon n="check" s={10} w={3} /></span><span className="ell" style={{ fontSize: 11 }}>{g.k}</span></div>)}</div>
          </div>
        </div>}
      </div>
    </div>
  );
}

function PackCol({ open }) {
  const keys = Object.keys(DATA.tumorPacks), P = DATA.tumorPacks[keys[0]];
  const total = [...P.bio, ...P.staging], done = total.filter(x => x[1]).length;
  const t = DATA.trials.slice().sort((a, b) => b.match - a.match)[0];
  return (
    <div className="packcol">
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-h"><span style={{ color: 'var(--accent)' }}><Icon n="pack" s={15} /></span><h3>Tumor-pack ativo</h3></div>
        <div className="card-b">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <b style={{ fontSize: 13 }}>Mama HR+/HER2−</b><span className="chip sm">{P.ver}</span>
            <button className="link" style={{ marginLeft: 'auto' }} onClick={() => open('pack')}>Abrir</button>
          </div>
          <div className="faint" style={{ fontSize: 10.5, margin: '2px 0 7px' }}>{P.owner} · atualizado {P.updated}</div>
          <div className="gauge"><i style={{ width: (done / total.length * 100) + '%' }} /></div>
          <div className="faint" style={{ fontSize: 10.5, marginTop: 5 }}>{done} de {total.length} itens completos · {total.length - done} pendentes</div>
        </div>
      </div>
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-h"><span style={{ color: 'var(--accent)' }}><Icon n="beaker" s={15} /></span><h3>Trials clínicos</h3><span className="chip sm accent">3</span>
          <div className="r"><button className="link" onClick={() => open('trials')}>Todos</button></div></div>
        <div className="card-b">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>{t.code}</div>
              <div className="faint ell" style={{ fontSize: 10.5 }}>{t.ph} · {t.title}</div>
            </div>
            <b className="mono" style={{ color: 'var(--accent)', fontSize: 17 }}>{t.match}%</b>
          </div>
          <div className="gauge" style={{ marginTop: 6, height: 6 }}><i style={{ width: t.match + '%', background: 'var(--accent)' }} /></div>
          <Btn sm kind="primary" icon="send" style={{ width: '100%', justifyContent: 'center', marginTop: 9 }} onClick={() => open('trials')}>Triagem de elegibilidade</Btn>
        </div>
      </div>
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-h"><span style={{ color: 'var(--info)' }}><Icon n="target" s={15} /></span><h3>Pesquisa clínica</h3></div>
        <div className="card-b">
          <div className="row" style={{ padding: '4px 0', fontSize: 11.5 }}><span style={{ flex: 1 }}>Estudos abertos no centro</span><b className="mono" style={{ color: 'var(--info)' }}>2</b></div>
          <div className="row" style={{ padding: '4px 0', fontSize: 11.5 }}><span style={{ flex: 1 }}>Pacientes em seguimento</span><b className="mono" style={{ color: 'var(--info)' }}>14</b></div>
          <button className="link" style={{ marginTop: 7 }} onClick={() => open('trials')}>Abrir carteira de pesquisa <Icon n="chev" s={12} /></button>
        </div>
      </div>
      <div className="card" style={{ flex: 1, minHeight: 0 }}>
        <div className="card-h"><h3>Pendências do pacote</h3></div>
        <div className="card-b">
          {[['Biomarcador PIK3CA', 'aplicar se doença metastática', 'amber'], ['Escore RCB', 'calcular após a cirurgia', ''], ['PIK3CA se M1', 'aguarda indicação', 'amber']].map(([k, s, tone]) => (
            <div key={k} className="row" style={{ padding: '5px 0' }}><span className={`dot ${tone ? 'pulse' : ''}`} style={{ color: tone ? `var(--${tone})` : 'var(--faint)', flexShrink: 0 }} /><div style={{ minWidth: 0 }}><b style={{ fontSize: 11.5 }}>{k}</b><div className="faint ell" style={{ fontSize: 10.5 }}>{s}</div></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RightPanel({ queue, onCall, calling, tab, setTab, exam, setExam, openViewer }) {
  const S = DATA.stats;
  const wait = Math.round(S.wait[S.wait.length - 1]);
  return (
    <aside className="side">
      <div className="rightbar">
        <Seg value={tab} onChange={setTab} items={[{ v: 'agenda', l: 'Agenda', icon: 'list', badge: queue.filter(q => q.st === 'wait' || q.st === 'triage').length }, { v: 'graf', l: 'Gráficos', icon: 'chart' }, { v: 'exame', l: 'Exame', icon: 'img' }]} />
        <div className="kpis">
          <div className="kpi"><div className="l">Atendidos</div><div className="n"><CountUp to={6} />/<span style={{ fontSize: 12, color: 'var(--faint)' }}>9</span></div></div>
          <div className="kpi" style={{ borderColor: 'color-mix(in oklch, var(--amber) 40%, var(--line))' }}><div className="l">Na fila</div><div className="n" style={{ color: 'var(--amber)' }}><CountUp to={3} /></div><div className="l" id="wait" style={{ color: 'var(--amber)', textTransform: 'none', letterSpacing: 0 }}>{wait} min espera</div></div>
          <div className="kpi"><div className="l">Cadeiras</div><div className="n"><CountUp to={7} /><span style={{ fontSize: 12, color: 'var(--faint)' }}>/10</span></div><div className="l" style={{ textTransform: 'none', letterSpacing: 0 }}>quimioterapia</div></div>
        </div>
      </div>
      <div key={tab} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, animation: 'paneIn .32s var(--ease)' }}>
        {tab === 'agenda' && <Queue queue={queue} onCall={onCall} calling={calling} />}
        {tab === 'graf' && <Dashboard />}
        {tab === 'exame' && <ExamSide exam={exam} setExam={setExam} openViewer={openViewer} />}
      </div>
    </aside>
  );
}
Object.assign(window, { DadosPanel, PackCol, RightPanel });
