// ===== Overlays: Viewer+Avatar · Áudio · WhatsApp · Tumor-pack · Trials · Anagráficos · Interações · Liberação QT =====

// --- Typewriter speech (Web Speech opcional) ---
function useTypewriter(text, speed = 16) {
  const [out, setOut] = useState('');
  useEffect(() => { setOut(''); if (!text) return; let i = 0; const t = setInterval(() => { i += 2; setOut(text.slice(0, i)); if (i >= text.length) clearInterval(t); }, speed); return () => clearInterval(t); }, [text]);
  return [out, out.length < (text || '').length];
}

function ImageViewer({ examId, onClose }) {
  const ex = DATA.exams.find(e => e.id === examId) || DATA.exams[0];
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(onClose, 260); };
  const [z, setZ] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 }); const drag = useRef(null);
  const [win, setWin] = useState('med'); const [f, setF] = useState(null); const [voice, setVoice] = useState(false);
  const [measure, setMeasure] = useState(true);
  const intro = `Esta é a TC de tórax de reavaliação de ${ex.date}, após 10 ciclos de paclitaxel. Em resumo: resposta parcial pelo RECIST 1.1 — a soma das lesões-alvo caiu de 52 para 32 mm, uma redução de 34%. Sem sinais de doença à distância. Toque nos marcadores numerados para eu explicar cada região.`;
  const text = f == null ? intro : DATA.findings[f].text;
  const [said, typing] = useTypewriter(text);
  useEffect(() => {
    if (!voice || !window.speechSynthesis) return; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = 1.05; speechSynthesis.speak(u);
    return () => speechSynthesis.cancel();
  }, [text, voice]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') close(); if (e.key === '+') setZ(v => Math.min(4, v + .25)); if (e.key === '-') setZ(v => Math.max(1, v - .25)); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const filt = { med: 'none', lung: 'brightness(1.5) contrast(1.6)', bone: 'contrast(2.2) brightness(.8)', inv: 'invert(1)' }[win];
  const pickF = (i) => { setF(i === f ? null : i); const p = DATA.findings[i]; if (i !== f) { setZ(1.8); setPan({ x: (50 - p.x) * 4.5, y: (50 - p.y) * 4.5 }); } else { setZ(1); setPan({ x: 0, y: 0 }); } };
  return (
    <div className={closing ? 'closing' : ''} style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div className={`backdrop ${closing ? 'closing' : ''}`} onClick={close} />
      <div className="viewer" style={{ animation: closing ? 'modalOut .25s forwards' : 'viewerIn .5s var(--spring)' }}>
        <div className="viewer-img">
          <div className="viewer-stage" onWheel={(e) => setZ(v => Math.max(1, Math.min(4, v - e.deltaY * .002)))}
            onMouseDown={(e) => drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }}
            onMouseMove={(e) => drag.current && setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })}
            onMouseUp={() => drag.current = null} onMouseLeave={() => drag.current = null}>
            <div className="imgbox" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})` }}>
              <img src={ex.img} alt="" style={{ filter: filt }} draggable={false} />
              {ex.id === 'e1' && DATA.findings.map((p, i) => <button key={p.n} className={`hs ${f === i ? 'on' : ''}`} style={{ left: p.x + '%', top: p.y + '%', width: 26 / z, height: 26 / z, fontSize: 11 / z, borderWidth: 2 / z }} onMouseDown={e => e.stopPropagation()} onClick={() => pickF(i)}>{p.n}</button>)}
              {ex.id === 'e1' && measure && <div className="caliper" style={{ left: '74%', top: '27%', width: '13%', transform: 'rotate(18deg)', borderTopWidth: 1.5 / z }}><span style={{ fontSize: 11 / z, top: -20 / z }}>21,0 mm</span></div>}
            </div>
            <div className="viewer-hud">{DATA.patient.name.toUpperCase()} · {DATA.patient.id}<br />{ex.name}<br />{ex.date} · Série 3 · Img 124/248</div>
            <div className="viewer-hud r">W: {win === 'lung' ? 1500 : win === 'bone' ? 2000 : 400} L: {win === 'lung' ? -600 : win === 'bone' ? 500 : 40}<br />Zoom {Math.round(z * 100)}%<br />Esp. 1,25 mm</div>
          </div>
          <div className="viewer-tools">
            {[['med', 'Mediastino'], ['lung', 'Pulmão'], ['bone', 'Osso'], ['inv', 'Inverter']].map(([k, l]) => <button key={k} className={`vt ${win === k ? 'on' : ''}`} onClick={() => setWin(k)}><Icon n="contrast" s={13} />{l}</button>)}
            <span style={{ width: 1, height: 20, background: '#fff2', margin: '0 4px' }} />
            <button className={`vt ${measure ? 'on' : ''}`} onClick={() => setMeasure(m => !m)}><Icon n="ruler" s={13} />Medida</button>
            <button className="vt" onClick={() => setZ(v => Math.max(1, v - .5))}>−</button>
            <input type="range" min="1" max="4" step=".05" value={z} onChange={e => setZ(+e.target.value)} style={{ width: 120, accentColor: 'var(--accent)' }} />
            <button className="vt" onClick={() => setZ(v => Math.min(4, v + .5))}>+</button>
            <button className="vt" onClick={() => { setZ(1); setPan({ x: 0, y: 0 }); setF(null); }}><Icon n="refresh" s={13} />Reset</button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>Scroll = zoom · arraste = mover · Esc fecha</span>
          </div>
        </div>
        <div className="assist">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 18px 12px' }}>
            <div className={`orb ${typing ? 'talk' : ''}`} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 15 }}>OncoAssist</div><div className="faint" style={{ fontSize: 11.5 }}>{typing ? 'explicando…' : 'pronto · imagem ' + ex.type}</div></div>
            <button className={`icon-btn ${voice ? '' : ''}`} title="Ler em voz alta" onClick={() => setVoice(v => !v)} style={{ color: voice ? 'var(--accent)' : '' }}><Icon n="volume" /></button>
            <button className="icon-btn" onClick={close}><Icon n="x" /></button>
          </div>
          <div style={{ padding: '0 18px', flexShrink: 0 }}>
            <div className="card" style={{ padding: 14, background: 'var(--surface-2)', minHeight: 140 }}>
              {f != null && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>{DATA.findings[f].n} · {DATA.findings[f].title}</div>}
              <div className="say">{said}{typing && <span className="caret" />}</div>
            </div>
          </div>
          <div className="sec-t" style={{ padding: '0 18px' }}>Achados guiados</div>
          <div style={{ padding: '0 12px', overflow: 'auto', flex: 1 }}>
            {DATA.findings.map((p, i) => <div key={p.n} className={`finding ${f === i ? 'on' : ''}`} onClick={() => pickF(i)}><span className="n">{p.n}</span><div><b style={{ fontSize: 12.5 }}>{p.title}</b><div className="faint" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{p.text.slice(0, 64)}…</div></div></div>)}
          </div>
          <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
            <Btn sm icon="users">Explicar ao paciente</Btn>
            <Btn sm kind="primary" icon="target" style={{ marginLeft: 'auto' }}>Registrar RECIST</Btn>
          </div>
          <div className="faint" style={{ fontSize: 10, padding: '0 14px 10px' }}>Explicação assistiva. Não substitui laudo do radiologista.</div>
        </div>
      </div>
    </div>
  );
}

// --- Caixa de áudio (microfone) ---
function AudioBox({ onClose, onUse }) {
  const [paused, setPaused] = useState(false); const [sec, setSec] = useState(0); const [lines, setLines] = useState(1);
  const [bars, setBars] = useState(Array(64).fill(4)); const box = useRef();
  useEffect(() => { if (paused) return; const t = setInterval(() => { setSec(s => s + 1); }, 1000); const w = setInterval(() => setBars(b => b.map((_, i) => 4 + Math.abs(Math.sin(Date.now() / 180 + i * .55)) * 30 * Math.random() + (i % 7 === 0 ? 10 : 0))), 90); const l = setInterval(() => setLines(n => Math.min(DATA.transcript.length, n + 1)), 2200); return () => { clearInterval(t); clearInterval(w); clearInterval(l); }; }, [paused]);
  useEffect(() => { if (box.current) box.current.scrollTop = 9999; }, [lines]);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  return (
    <div className="audiobox">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 4px' }}>
        {!paused ? <span className="rec-dot" /> : <Icon n="pause" s={12} style={{ color: 'var(--faint)' }} />}
        <b style={{ fontSize: 12.5 }}>{paused ? 'Pausado' : 'Gravando consulta'}</b><span className="mono faint">{mm}</span>
        <span className="chip sm info" style={{ marginLeft: 6 }}>Transcrição ao vivo · pt-BR</span>
        <span className="chip sm">2 falantes</span>
        <button className="icon-btn" style={{ marginLeft: 'auto', width: 28, height: 28 }} onClick={onClose}><Icon n="x" s={14} /></button>
      </div>
      <div className={`wave ${paused ? 'paused' : ''}`} style={{ padding: '0 14px' }}>{bars.map((h, i) => <i key={i} style={{ height: paused ? 4 : h }} />)}</div>
      <div className="transcript" ref={box}>
        {DATA.transcript.slice(0, lines).map(([s, t], i) => <div key={i} className="word-in" style={{ marginBottom: 6 }}><div className="spk" style={{ color: s === 'Médico' ? 'var(--accent)' : 'var(--info)' }}>{s}</div>{t}</div>)}
        {!paused && <div className="skel" style={{ width: '60%' }} />}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, alignItems: 'center' }}>
        <Btn sm icon={paused ? 'play' : 'pause'} onClick={() => setPaused(p => !p)}>{paused ? 'Retomar' : 'Pausar'}</Btn>
        <Btn sm kind="ghost" icon="stop" onClick={() => { setPaused(true); }}>Parar</Btn>
        <span className="faint" style={{ fontSize: 11, marginLeft: 6 }}>Detectado: <b style={{ color: 'var(--text)' }}>neuropatia G1</b>, <b style={{ color: 'var(--text)' }}>hiperglicemia</b></span>
        <Btn sm kind="primary" icon="zap" style={{ marginLeft: 'auto' }} onClick={onUse}>Gerar evolução</Btn>
      </div>
    </div>
  );
}

// --- Encerrar consulta → WhatsApp ---
function FinishModal({ onClose, onDone, ecog }) {
  const [step, setStep] = useState(0); const [sending, setSending] = useState(false);
  const [opts, setOpts] = useState({ resumo: true, proxima: true, exames: true, orient: true, receita: false });
  const msg = [
    'Olá, Marina! Aqui é a equipe de Oncologia. 💜',
    opts.resumo && '\n✅ *Hoje:* Ciclo 11 de paclitaxel realizado. A TC mostrou boa resposta ao tratamento.',
    opts.proxima && '\n📅 *Próxima aplicação:* 13/out, 09:00 — chegar 30 min antes para coleta.',
    opts.exames && '\n🧪 *Exames solicitados:* RM de mamas, hemograma e ecocardiograma. A central entrará em contato.',
    opts.orient && '\n⚠️ *Procure o PS se:* febre ≥ 37,8 °C, falta de ar, formigamento que atrapalhe atividades.',
    opts.receita && '\n📄 Receita digital anexada.',
    '\nDúvidas: responda esta mensagem.',
  ].filter(Boolean).join('\n');
  const send = () => { setSending(true); setTimeout(() => setStep(2), 900); };
  return (
    <Modal title="Encerrar consulta" icon="logout" sub={`${DATA.patient.name} · Paclitaxel C11 · ECOG ${ecog}`} width={780} onClose={onClose}
      footer={(close) => step < 2 ? <>
        <span className="faint" style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 11.5 }}>Passo {step + 1} de 2</span>
        {step === 1 && <Btn onClick={() => setStep(0)} icon="chevL">Voltar</Btn>}
        {step === 0 ? <Btn kind="primary" onClick={() => setStep(1)}>Revisar mensagem <Icon n="chev" s={14} /></Btn>
          : <Btn kind="wa" icon="wa" onClick={send}>{sending ? 'Enviando…' : 'Enviar via WhatsApp'}</Btn>}
      </> : <Btn kind="primary" onClick={() => { close(); onDone(); }}>Chamar próximo paciente <Icon n="chev" s={14} /></Btn>}>
      {step === 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'paneIn .3s' }}>
        <div>
          <div className="sec-t" style={{ marginTop: 4 }}>Checklist de encerramento</div>
          {[['Evolução SOAP assinada', true], ['Prescrição liberada à farmácia', true], ['CTCAE registrado', true], ['RECIST atualizado', true], ['Retorno agendado', true], ['TCLE trial pendente', false]].map(([k, ok]) => (
            <div key={k} className={`gate ${ok ? 'pass' : 'fail'}`}><span className="ck"><Icon n={ok ? 'check' : 'x'} s={11} w={3} /></span>{k}</div>
          ))}
        </div>
        <div>
          <div className="sec-t" style={{ marginTop: 4 }}>Incluir no WhatsApp</div>
          {[['resumo', 'Resumo da consulta'], ['proxima', 'Próxima aplicação'], ['exames', 'Exames solicitados'], ['orient', 'Sinais de alarme'], ['receita', 'Receita digital (PDF)']].map(([k, l]) => (
            <div key={k} className="row"><span style={{ flex: 1 }}>{l}</span><Switch on={opts[k]} onChange={(v) => setOpts({ ...opts, [k]: v })} /></div>
          ))}
          <div className="sec-t">Destinatário</div>
          <Dropdown width={300} trigger={<button className="sel" style={{ width: '100%' }}><Icon n="phone" s={14} />Paciente · {DATA.patient.phone}<Icon n="chevD" s={12} style={{ marginLeft: 'auto' }} /></button>}>
            <DDItem on sub={DATA.patient.phone}>Paciente</DDItem><DDItem sub="(11) 9 7•••-2201">Paulo Costa · esposo</DDItem><DDItem sub="Grupo interno">Enfermagem navegadora</DDItem>
          </Dropdown>
        </div>
      </div>}
      {step === 1 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'paneIn .3s' }}>
        <div className="wa-phone"><div className={`wa-bubble ${sending ? 'sent-anim' : ''}`}>{msg}<div className="meta">09:31 ✓✓</div></div></div>
        <div><div className="sec-t" style={{ marginTop: 4 }}>Editar texto</div><textarea className="ta" rows={14} defaultValue={msg} style={{ fontSize: 12 }} />
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>Envio simulado · canal oficial com opt-in LGPD registrado.</div></div>
      </div>}
      {step === 2 && <div style={{ textAlign: 'center', padding: '30px 0 20px' }}>
        <div className="success-ring"><Icon n="check" s={34} w={2.5} /></div>
        <h2 style={{ marginTop: 14, fontSize: 18 }}>Consulta encerrada</h2>
        <div className="muted" style={{ marginTop: 4 }}>Mensagem entregue via WhatsApp · prontuário sincronizado</div>
      </div>}
    </Modal>
  );
}

// --- Tumor-pack (drawer) ---
function TumorPackDrawer({ onClose }) {
  const keys = Object.keys(DATA.tumorPacks); const [k, setK] = useState(keys[0]); const P = DATA.tumorPacks[k];
  const Ck = ({ ok }) => <span className="cbx" style={ok ? { background: 'var(--ok)', borderColor: 'var(--ok)', color: 'var(--bg)' } : ok === null && k === keys[0] ? { borderColor: 'var(--amber)' } : {}}><Icon n="check" s={11} w={3} /></span>;
  const total = [...P.bio, ...P.staging], done = total.filter(x => x[1]).length;
  return (
    <Drawer title="Tumor-pack" icon="pack" sub="Pacote por neoplasia: biomarcadores · estadiamento · protocolos · seguimento" onClose={onClose} width={600}
      footer={<><Btn icon="layers">Aplicar exames faltantes</Btn><Btn kind="primary" icon="check">Vincular ao paciente</Btn></>}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
        <Dropdown width={300} trigger={(o) => <button className="sel" style={{ height: 38, fontSize: 14 }}><Icon n="pack" s={15} />{k}<Icon n="chevD" s={13} style={{ transform: o ? 'rotate(180deg)' : '', transition: '.25s' }} /></button>}>
          <div className="dd-lbl">Selecionar pack</div>{keys.map(x => <DDItem key={x} on={x === k} sub={DATA.tumorPacks[x].owner + ' · ' + DATA.tumorPacks[x].ver} onClick={() => setK(x)}>{x}</DDItem>)}
        </Dropdown>
        <span className="chip sm">{P.ver}</span><span className="chip sm ok">{P.owner}</span><span className="faint" style={{ fontSize: 11 }}>atualizado {P.updated}</span>
      </div>
      <div className="pipe">{['Diagnóstico', 'Biomarcadores', 'Estadiamento', 'Tratamento', 'Seguimento'].map((s, i, a) => <React.Fragment key={s}><div className={`pipe-n ${i === 3 && k === keys[0] ? 'act' : ''}`}><b>{i + 1}</b>{s}</div>{i < a.length - 1 && <div className="pipe-a" />}</React.Fragment>)}</div>
      <div key={k} style={{ animation: 'paneIn .3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}><div className="gauge" style={{ flex: 1 }}><i style={{ width: (done / total.length * 100) + '%' }} /></div><span className="mono" style={{ fontSize: 12 }}>{done}/{total.length} completos</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><div className="sec-t">Biomarcadores obrigatórios</div>{P.bio.map(([n, ok]) => <div key={n} className="ex-it" style={{ cursor: 'default' }}><Ck ok={ok} />{n}</div>)}</div>
          <div><div className="sec-t">Estadiamento</div>{P.staging.map(([n, ok]) => <div key={n} className="ex-it" style={{ cursor: 'default' }}><Ck ok={ok} />{n}</div>)}</div>
        </div>
        <div className="sec-t">Protocolos do pack</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{P.protocols.map((p, i) => <span key={p} className={`chip ${i === 0 && k === keys[0] ? 'accent' : ''}`}>{p}</span>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><div className="sec-t">Seguimento</div>{P.follow.map(x => <div key={x} className="row" style={{ fontSize: 12 }}><Icon n="clock" s={13} style={{ color: 'var(--faint)' }} />{x}</div>)}</div>
          <div><div className="sec-t">Scores / calculadoras</div>{P.scores.map(x => <div key={x} className="row" style={{ fontSize: 12 }}><Icon n="target" s={13} style={{ color: 'var(--faint)' }} />{x}</div>)}</div>
        </div>
      </div>
    </Drawer>
  );
}

// --- Trials / Pesquisa clínica ---
function TrialsDrawer({ onClose }) {
  const toast = useToast(); const [flt, setFlt] = useState('Todos');
  const list = DATA.trials.filter(t => flt === 'Todos' || t.ph === flt);
  return (
    <Drawer title="Trials clínicos & pesquisa" icon="beaker" sub="Pré-triagem automática por critérios de elegibilidade" onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, margin: '10px 0 12px' }}>{['Todos', 'Fase III', 'Fase II', 'Observacional'].map(f => <button key={f} className={`chip ${flt === f ? 'accent' : ''}`} onClick={() => setFlt(f)}>{f}</button>)}</div>
      {list.map(t => (
        <div key={t.code} className="trial" style={{ animation: 'paneIn .3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="chip sm accent mono">{t.code}</span><span className="chip sm">{t.ph}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}><div className="gauge" style={{ width: 70, height: 6 }}><i style={{ width: t.match + '%', background: 'var(--accent)' }} /></div><b className="mono" style={{ color: 'var(--accent)' }}>{t.match}%</b></div></div>
          <div style={{ fontWeight: 600, fontSize: 13.5, margin: '8px 0 2px', textWrap: 'pretty' }}>{t.title}</div>
          <div className="faint" style={{ fontSize: 11.5, marginBottom: 6 }}>{t.site}</div>
          {t.crit.map(([c, ok]) => <div key={c} className="crit"><span style={{ color: ok ? 'var(--ok)' : ok === false ? 'var(--danger)' : 'var(--amber)' }}><Icon n={ok ? 'check' : ok === false ? 'x' : 'clock'} s={13} w={2.4} /></span>{c}{ok === null && <span className="faint">· pendente</span>}</div>)}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}><Btn sm kind="ghost" icon="file">Protocolo</Btn><Btn sm kind="primary" icon="send" style={{ marginLeft: 'auto' }} onClick={() => toast(`Encaminhado ao centro de pesquisa · ${t.code}`, 'accent', 'beaker')}>Encaminhar</Btn></div>
        </div>
      ))}
    </Drawer>
  );
}

function AnagModal({ onClose }) {
  const P = DATA.patient;
  const F = [['Nome', P.name], ['Nascimento', P.dob + ' (' + P.age + 'a)'], ['Sexo', P.sex], ['CPF', P.cpf], ['Estado civil', P.marital], ['Profissão', P.job], ['Cidade', P.city], ['Telefone', P.phone], ['Convênio', P.plan], ['Contato', P.contact], ['Peso / Altura', P.weight + ' kg / ' + P.height + ' cm'], ['IMC · ASC', P.bmi.toString().replace('.', ',') + ' · ' + P.bsa.toFixed(2).replace('.', ',') + ' m²']];
  return (
    <Modal title="Dados anagráficos" icon="user" sub={P.id} width={640} onClose={onClose} footer={(c) => <><Btn onClick={c}>Fechar</Btn><Btn kind="primary" icon="edit">Editar</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px' }}>{F.map(([k, v]) => <div key={k}><div className="dx-k">{k}</div><div style={{ fontWeight: 500, marginTop: 2 }} className={k === 'CPF' || k === 'Telefone' ? 'mono' : ''}>{v}</div></div>)}</div>
    </Modal>
  );
}
function IxModal({ onClose }) {
  const drugs = ['Paclitaxel', 'Dexametasona', 'Ondansetrona', 'Tamoxifeno*', 'Olaparibe*'], meds = DATA.meds.map(m => m.n);
  const M = { 'Fluoxetina|Tamoxifeno*': 'danger', 'Metformina|Dexametasona': 'amber', 'Fluoxetina|Ondansetrona': 'amber', 'Sinvastatina|Paclitaxel': 'info', 'Omeprazol|Olaparibe*': 'info', 'Levotiroxina|Dexametasona': 'info' };
  return (
    <Modal title="Matriz de interações" icon="zap" sub="MUC × terapia oncológica (* planejado)" width={720} onClose={onClose}>
      <div className="heat" style={{ gridTemplateColumns: `110px repeat(${drugs.length}, 1fr)`, gap: 4 }}>
        <span />{drugs.map(d => <span key={d} style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{d}</span>)}
        {meds.map(m => <React.Fragment key={m}><span style={{ fontSize: 12, alignSelf: 'center' }}>{m}</span>{drugs.map(d => { const s = M[m + '|' + d]; return <span key={d} className="hc" style={{ height: 30, background: s ? `var(--${s}-soft)` : 'var(--surface-2)', color: s ? `var(--${s})` : 'var(--faint)', fontFamily: 'var(--font)' }}>{s === 'danger' ? 'Grave' : s === 'amber' ? 'Moderada' : s === 'info' ? 'Leve' : '—'}</span>; })}</React.Fragment>)}
      </div>
      <div style={{ marginTop: 14 }}><Interactions open={() => { }} compact /></div>
    </Modal>
  );
}
function ReleaseModal({ onClose }) {
  const toast = useToast(); const [st, setSt] = useState(0);
  useEffect(() => { const t = [setTimeout(() => setSt(1), 500), setTimeout(() => setSt(2), 1100), setTimeout(() => setSt(3), 1700), setTimeout(() => setSt(4), 2300)]; return () => t.forEach(clearTimeout); }, []);
  const steps = ['Dose calculada por ASC', 'Gates laboratoriais', 'Dupla checagem (farmácia)', 'Enfermagem · cadeira 4'];
  return (
    <Modal title="Liberar ciclo para farmácia" icon="drip" sub="Paclitaxel 144 mg · C11 D1 · cadeira 4" width={520} onClose={onClose}
      footer={(c) => <><Btn onClick={c}>Cancelar</Btn><Btn kind="primary" icon="check" onClick={() => { toast('Ciclo liberado · farmácia notificada'); c(); }}>{st >= 4 ? 'Confirmar liberação' : 'Validando…'}</Btn></>}>
      {steps.map((s, i) => <div key={s} className={`gate ${st > i ? 'pass' : ''}`} style={{ padding: '9px 0', fontSize: 13 }}><span className="ck"><Icon n="check" s={11} w={3} /></span>{s}{st === i && <span className="faint" style={{ marginLeft: 'auto', fontSize: 11 }}>verificando…</span>}{st > i && <span className="chip sm ok" style={{ marginLeft: 'auto' }}>ok</span>}</div>)}
    </Modal>
  );
}
function FlashModal({ onClose, ecog }) {
  return (
    <Modal title="Consulta Flash" icon="zap" sub="Resumo de 30 segundos para decisão" width={640} onClose={onClose}>
      <div style={{ display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.5 }}>
        {[['Quem', `Marina, 58a, CDI mama E, ${DATA.dx.t}${DATA.dx.n}${DATA.dx.m} · IIB · RE+/RP+/HER2− · BRCA1+ · ECOG ${ecog}`], ['Onde está', 'Neoadjuvância: AC-dd ×4 concluído → Paclitaxel C11/12 hoje'], ['Como respondeu', 'RECIST RP −34% (TC 28/set)'], ['Riscos hoje', 'Neuropatia G1 · hiperglicemia pós-dexa · fluoxetina × tamoxifeno futuro'], ['Próximo passo', 'C12 13/out → RM mamas → cirurgia ~10/nov → olaparibe adj. se RCB>0 · avaliar trial ONC-BR-207']].map(([k, v], i) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)', animation: `paneIn .35s ${i * 70}ms both` }}><b className="muted" style={{ fontWeight: 500 }}>{k}</b><span>{v}</span></div>
        ))}
      </div>
    </Modal>
  );
}
function CidModal({ onClose, dx }) {
  const D = dx || DATA.dx;
  const rows = [['CID-10 topografia', D.cid], ['CID-O morfologia', D.histoType], ['Lateralidade', D.lateral], ['Localização', D.topo], ['Grau histológico', D.grade], ['Complemento', D.histo], ['Estadiamento', `${D.system} · ${D.t} ${D.n} ${D.m} → ${D.stage}`], ['Intenção', D.intent], ['Data do diagnóstico', D.dxDate], ['Tumor board', DATA.dx.board.date + ' · ' + DATA.dx.board.who]];
  return (
    <Modal title={`Ficha CID-O · ${D.cid}`} icon="file" sub={D.cidLabel} width={620} onClose={onClose}
      headRight={<button className="chip sm accent" style={{ cursor: 'default' }}>CID-10 + CID-O 3ª ed.</button>}>
      <div className="dxm-grid" style={{ gridTemplateColumns: '1fr' }}>
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '7px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 0 }}>
            <span className="dxm-l" style={{ width: 158, flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 500, marginLeft: 'auto', textAlign: 'right' }} className={k.startsWith('CID') || k === 'TNM' ? 'mono' : ''}>{v}</span>
          </div>
        ))}
      </div>
      <div className="sec-t">Impacto clínico das escolhas</div>
      <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>Lateralidade e topografia definem o campo cirúrgico e a área de radioterapia — errar aqui significa irradiar o lado errado. O morfológico guia a hormonioterapia: <b style={{ color: 'var(--text)' }}>lobular</b> muda a indicação de RM e de seguimento.</div>
    </Modal>
  );
}
function Palette({ onClose, open }) {
  const [q, setQ] = useState(''); const ref = useRef(); useOutside(ref, onClose, true);
  const items = [['Solicitar exames', 'flask', 'exam'], ['Abrir tumor-pack', 'pack', 'pack'], ['Trials clínicos', 'beaker', 'trials'], ['Matriz de interações', 'zap', 'ix'], ['Dados anagráficos', 'user', 'anag'], ['Liberar ciclo', 'drip', 'chemo'], ['Encerrar consulta', 'wa', 'finish'], ['Abrir TC de tórax', 'img', 'viewer']].filter(i => i[0].toLowerCase().includes(q.toLowerCase()));
  return (
    <><div className="backdrop" style={{ zIndex: 140 }} /><div className="palette" ref={ref}>
      <input autoFocus placeholder="Buscar pacientes, exames, protocolos, ações…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && items[0]) { onClose(); open(items[0][2]); } }} />
      <div style={{ padding: 6 }}><div className="dd-lbl">Ações</div>{items.map(([l, ic, k]) => <button key={k} className="dd-it" onClick={() => { onClose(); open(k); }}><Icon n={ic} s={15} />{l}<span className="kbd" style={{ marginLeft: 'auto' }}>↵</span></button>)}</div>
    </div></>
  );
}

Object.assign(window, { ImageViewer, AudioBox, FinishModal, TumorPackDrawer, TrialsDrawer, AnagModal, IxModal, ReleaseModal, FlashModal, CidModal, Palette });