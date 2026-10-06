// ===== Cabeçalho do paciente · Diagnóstico/Estadiamento em evidência · Timeline =====
function PatientHeader({ ecog, setEcog, open, dxState }) {
  const P = DATA.patient, D = dxState; const toast = useToast();
  const [bump, setBump] = useState(false);
  const pickEcog = (v) => { setEcog(v); setBump(true); setTimeout(() => setBump(false), 400); toast(`ECOG atualizado para ${v} · registrado na evolução`); };
  return (
    <div className="phead">
      <div className="p-avatar"><div className="in">{P.initials}</div><div className="st" title="Em tratamento ativo" /></div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="p-name">{P.name}</div>
          <span className="chip amber"><span className="dot pulse" />Em tratamento</span>
        </div>
        <div className="anag">
          <span>{P.age} anos · {P.sex[0]}</span>
          <span className="mono">{P.id}</span>
          <span className="mono">ASC {P.bsa.toFixed(2).replace('.', ',')} m²</span>
          <button className="link" onClick={() => open('anag')}>Anagráficos <Icon n="chev" s={12} /></button>
        </div>
        <div className="tags">
          <button className="chip danger" onClick={() => open('clin')}><Icon n="alert" s={12} />Alergia: penicilina</button>
          <button className="chip accent" onClick={() => open('trials')}><Icon n="beaker" s={12} />Trials · 3</button>
          <button className="chip amber" onClick={() => open('ix')}><Icon n="zap" s={12} />Interação grave</button>
          <button className="chip" onClick={() => open('pack')}><Icon n="pack" s={12} />Tumor-pack mama</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div className="dx">
          <div className="dx-h"><Icon n="file" s={12} /><span className="lb">Diagnóstico &amp; estadiamento</span>
            <span className="chip sm ok" style={{ marginLeft: 'auto' }}>{D.intent}</span></div>
          <div className="dx-c">
            <button className="cid-big" onClick={() => open('cid')} title="Abrir ficha CID-O completa">
              <span className="c1">CID-10</span><span className="c2">{D.cid}</span><span className="c1" style={{ fontSize: 8, letterSpacing: .6 }}>ONCO</span></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dx-title ell" title={D.title} style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{D.title}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.35 }}>{D.histoType.replace('Carcinoma ductal invasivo', 'CDI')} · {D.grade.replace(' (Nottingham 8/9)', ' · N8/9')} · QSE mama esquerda</div>
            </div>
            <button className="dx-stat" onClick={() => open('stad')} title="Alterar T/N/M e estádio">
              <div className="k">TNM</div><div className="v">{D.t.replace('c', '')}{D.n}{D.m}</div>
              <div className="k" style={{ color: 'var(--accent)' }}>estádio {D.stage}</div></button>
            <div className="dx-stat eco" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="k">ECOG</div>
              <Dropdown align="right" width={310} trigger={(o) => <button className={`ecog-btn ${bump ? 'bump' : ''}`}>{ecog}<Icon n="chevD" s={13} style={{ transform: o ? 'rotate(180deg)' : '', transition: 'transform .25s' }} /></button>}>
                <div className="dd-lbl">Performance status · ECOG</div>
                {DATA.ecogOptions.map(o => <DDItem key={o.v} on={o.v === ecog} onClick={() => pickEcog(o.v)} sub={o.d}><b className="mono">{o.v}</b></DDItem>)}
              </Dropdown>
              <div className="k" style={{ marginTop: -1 }}>esforço leve</div>
            </div>
            <button className="icon-btn" title="Editar diagnóstico / estádio" onClick={() => open('dx')} style={{ flexShrink: 0 }}><Icon n="edit" s={16} /></button>
          </div>
          <div className="dx-ev"><span style={{ color: 'var(--ok)', flexShrink: 0 }}><Icon n="check" s={13} w={2.5} /></span>
            <span className="ell">Firmado em <b>{D.dxDate}</b> · tumor board {DATA.dx.board.date}</span>
            <button className="link" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => open('dx')}>Revisar</button></div>
        </div>
        <div className="actions-col">
          <Btn kind="primary" icon="zap" onClick={() => open('flash')}>Consulta Flash</Btn>
          <Dropdown align="right" width={240} trigger={<Btn icon="more">Ações</Btn>}>
            <DDItem icon="edit" onClick={() => open('dx')}>Editar diagnóstico / estádio</DDItem>
            <DDItem icon="file" onClick={() => open('cid')}>Ficha CID-O</DDItem>
            <div className="dd-sep" />
            <DDItem icon="flask" onClick={() => open('exam')}>Solicitar exames</DDItem>
            <DDItem icon="drip" onClick={() => open('chemo')}>Prescrever ciclo</DDItem>
            <DDItem icon="pack" onClick={() => open('pack')}>Abrir tumor-pack</DDItem>
            <DDItem icon="beaker" onClick={() => open('trials')}>Triagem p/ trials</DDItem>
            <div className="dd-sep" />
            <DDItem icon="wa" onClick={() => open('finish')}>Encerrar consulta</DDItem>
          </Dropdown>
        </div>
      </div>
    </div>
  );
}

function DxModal({ dx, setDx, onClose }) {
  const [f, setF] = useState(dx); const O = DATA.dxOpts;
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const ref = useRef(dx); const dirty = JSON.stringify(f) !== JSON.stringify(ref.current);
  const save = () => { setDx(f); onClose(); };
  const Sel = ({ k, list, label, wide }) => (
    <div className="dxm-f" style={wide ? { gridColumn: '1 / -1' } : {}}><span className="dxm-l">{label}</span>
      <Dropdown align="left" width={340} trigger={(o) => <button className="sel" style={{ width: '100%', height: 36, justifyContent: 'space-between' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f[k]}</span><Icon n="chevD" s={13} style={{ transform: o ? 'rotate(180deg)' : '', transition: '.25s' }} /></button>}>
        {list.map(x => <DDItem key={x} on={x === f[k]} onClick={() => set(k, x)}>{x}</DDItem>)}</Dropdown></div>);
  return (
    <Modal title="Diagnóstico & estadiamento" icon="file" sub={`${DATA.patient.name} · ${DATA.patient.id} · alterações exigem assinatura do oncologista responsável`} width={820} onClose={onClose}
      footer={(c) => <>
        <span className="faint" style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 11.5 }}>{dirty ? 'Alterações não salvas · gera entrada na trilha de auditoria' : 'Sem alterações'}</span>
        <Btn onClick={c}>Descartar</Btn>
        <Btn kind="primary" icon="check" onClick={save} style={{ opacity: dirty ? 1 : .5 }}>Salvar e versionar</Btn>
      </>}>
      <div className="dxm-grid">
        <Sel k="cid" list={O.cid} label="CID-10 · topografia" />
        <Sel k="histoType" list={O.histoType} label="Morfologia (CID-O)" />
        <Sel k="grade" list={O.grade} label="Grau histológico (Nottingham)" />
        <Sel k="topo" list={[f.topo, 'Mama direita · QSL', 'Mama esquerda · QSL', 'Mama esquerda · quadrante inferior', 'Mama esquerda · multicêntrico']} label="Localização / lateralidade" />
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ flex: 1 }}><span className="dxm-l">Estadiamento TNM</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
              {[['T', O.T], ['N', O.N], ['M', O.M]].map(([k, list]) => (
                <Dropdown key={k} align="left" width={200} trigger={(o) => <button className="sel" style={{ height: 36, minWidth: 74, justifyContent: 'space-between' }}><b className="mono" style={{ fontSize: 14 }}>{f[k]}</b><Icon n="chevD" s={12} /></button>}>
                  <div className="dd-lbl">categoria {k}</div>{list.map(x => <DDItem key={x} on={x === f[k]} onClick={() => set(k, x)}>{x}</DDItem>)}</Dropdown>))}
              <div className="sel" style={{ height: 36, borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}>= {f.stage}</div>
            </div></div>
          <div style={{ width: 260 }}><Sel k="system" list={O.system} label="Sistema de estadiamento" /></div>
        </div>
        <Sel k="intent" list={O.intent} label="Intenção terapêutica" />
        <div className="dxm-f"><span className="dxm-l">Data do diagnóstico</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="field" style={{ height: 36 }} value={f.dxDate} onChange={e => set('dxDate', e.target.value)} />
            <input className="field" style={{ height: 36 }} value={f.histo} onChange={e => set('histo', e.target.value)} title="Ki-67 / complemento" /></div></div>
        <div className="dxm-f" style={{ gridColumn: '1 / -1' }}><span className="dxm-l">Estádio derivado</span>
          <div className="dxa on" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <b className="mono" style={{ fontSize: 22, color: 'var(--accent)' }}>{f.stage}</b>
            <div><div style={{ fontWeight: 600 }}>{f.title}</div><small>TNM {f.t}{f.n}{f.m} · {f.system}</small></div>
            <span className="chip sm ok" style={{ marginLeft: 'auto' }}>{f.intent}</span></div></div>
      </div>
      <div className="sec-t">Biomarcadores vinculados</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{f.biomarkers.map(b => <span key={b.k} className={`chip ${b.tone}`}>{b.k} {b.v}</span>)}<span className="chip">Adicionar…</span></div>
      <div className="sec-t">Auditoria</div>
      <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>Última alteração por <b style={{ color: 'var(--text)' }}>Dr. Silas</b> · 06 out 2026 09:12. Estadiamento prévio preservado no histórico (nunca sobrescrito) — se você trocar TNM ou estádio, o prontuário mantém as duas versões para comparar desfecho.</div>
    </Modal>
  );
}

function Timeline({ openViewer, open3d }) {
  const T = DATA.timeline; const [zoom, setZoom] = useState('9m');
  const span = T.end - T.start; const x = (d) => ((d - T.start) / span) * 100;
  const months = []; for (let m = 4; m <= 12; m++) { const d = Date.UTC(2026, m, 1); months.push({ d, l: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m % 12] + (m === 12 ? ' 27' : '') }); }
  const [hidden, setHidden] = useState({});
  const cycles = [];
  // AC q14 (4) + paclitaxel weekly (12)
  for (let i = 0; i < 4; i++) cycles.push({ d: Date.UTC(2026, 5, 2) + i * 14 * 864e5, k: `AC C${i + 1}`, c: 'var(--info)' });
  for (let i = 0; i < 12; i++) cycles.push({ d: Date.UTC(2026, 6, 28) + i * 7 * 864e5, k: `Paclitaxel C${i + 1}`, c: 'var(--accent)', future: i >= 10 });
  const fmt = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  return (
    <div className="tl">
      <div className="tl-head">
        <h3>Linha do tempo oncológica</h3>
        <span className="chip sm accent">D+147 do diagnóstico</span>
        <span className="chip sm">Ciclo 15 de 16 · semana 10/12 de taxano</span>
        {open3d && <button className="tl-3d" onClick={open3d}><Icon n="cube" s={12} />Ver em 3D</button>}
        <div className="tl-legend">
          {[['Diagnóstico', 'var(--accent)', 0], ['Imagem', 'var(--info)', 1], ['Sistêmico', 'var(--accent)', 2], ['Cirurgia · RT', 'var(--ok)', 3]].map(([l, c, i]) => (
            <button key={l} onClick={() => setHidden(h => ({ ...h, [i]: !h[i] }))} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', opacity: hidden[i] ? .35 : 1, transition: 'opacity .2s' }}><i className="dot" style={{ color: c }} />{l}</button>
          ))}
          <Dropdown align="right" trigger={<button className="link">{zoom === '9m' ? 'Desde diagnóstico' : 'Todo histórico'} <Icon n="chevD" s={12} /></button>}>
            <DDItem on={zoom === '9m'} onClick={() => setZoom('9m')}>Desde diagnóstico</DDItem>
            <DDItem on={zoom === 'all'} onClick={() => setZoom('all')}>Todo histórico</DDItem>
          </Dropdown>
        </div>
      </div>
      <div className="tl-body">
        <div className="tl-lanes">{T.lanes.map((l, i) => <div key={l} className="tl-lane-l" style={{ opacity: hidden[i] ? .35 : 1 }}>{l}</div>)}</div>
        <div className="tl-track">
          {T.lanes.map((l, li) => (
            <div key={l} className="tl-row" style={{ opacity: hidden[li] ? .12 : 1, transition: 'opacity .3s' }}>
              {T.bars.filter(b => b.lane === li).map(b => (
                <div key={b.k} className="tl-bar" style={{ left: x(b.a) + '%', width: (x(b.b) - x(b.a)) + '%', background: b.future ? 'transparent' : `color-mix(in oklch, ${b.c} 22%, transparent)`, border: b.future ? `1.5px dashed ${b.c}` : 0 }}>
                  <span style={{ position: 'absolute', left: 6, top: -1, fontSize: 9.5, fontWeight: 600, color: b.c, whiteSpace: 'nowrap', lineHeight: '13px' }}>{b.k}</span>
                </div>
              ))}
              {li === 2 && cycles.map((c, i) => (
                <div key={i} className={`tl-ev ${c.future ? 'future' : ''}`} style={{ left: x(c.d) + '%', color: c.c }}>
                  <span className="pt" style={{ width: 8, height: 8, borderWidth: 1.5 }} />
                  <div className="tip"><b>{c.k}</b><br /><span className="muted">{fmt(c.d)}{c.future ? ' · agendado' : ' · aplicado'}</span></div>
                </div>
              ))}
              {T.events.filter(e => e.lane === li).map(e => (
                <div key={e.k} className={`tl-ev ${e.future ? 'future' : ''}`} style={{ left: x(e.d) + '%', color: e.c }}>
                  <span className="pt" />
                  <div className="tip"><b>{e.k}</b> · {fmt(e.d)}<br /><span className="muted">{e.s}</span></div>
                </div>
              ))}
              {T.thumbs.filter(e => e.lane === li).map((e, i) => (
                <button key={i} className="tl-thumb" style={{ left: x(e.d) + '%' }} onClick={() => openViewer(e.exam || 'e1')}>
                  <img src={e.img} alt="" />
                  <div className="tip" style={{ fontSize: 22, padding: '10px 16px' }}><b>{e.k}</b><br /><span className="muted">{fmt(e.d)} · {e.s}</span></div>
                </button>
              ))}
            </div>
          ))}
          <div className="tl-today" style={{ left: x(T.today) + '%' }} />
          <div className="tl-axis">{months.map(m => <span key={m.d} style={{ left: x(m.d) + '%' }}>{m.l}</span>)}</div>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { PatientHeader, Timeline, DxModal });
