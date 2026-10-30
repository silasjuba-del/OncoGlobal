// IA-Round: uma pergunta → até 4 LLMs em paralelo → rodada de confronto opcional → reconciliação por skill.
import { useState } from 'react';
import { useActions } from '../../app/actions';
import { docsText, imageBlocks, type Attachment } from '../../ai/attachments';
import { aiAvailable, chatStream, PROVIDERS, providerInfo, type ChatBlock, type Provider } from '../../ai/bridge';
import { allTemplates } from '../../ai/library';
import { fillTemplate } from '../../ai/prompts';
import { toLibrary, toWord } from '../../ai/share';
import { Markdown } from '../../components/Markdown';
import { useAppState } from '../../store/store';
import { SourcesPanel } from './SourcesPanel';

interface Lane {
  provider: Provider;
  text: string;
  status: 'idle' | 'running' | 'done' | 'error';
  round: number;
}

const SYSTEM = 'Responda em português do Brasil, com fundamentação explícita. Não invente dados; marque incertezas como "A CONFERIR".';

export function RoundPage() {
  const actions = useActions();
  const { settings } = useAppState();
  const [question, setQuestion] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [selected, setSelected] = useState<Provider[]>(PROVIDERS.map((p) => p.id));
  const [judge, setJudge] = useState<Provider>('claude');
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [merged, setMerged] = useState('');
  const [merging, setMerging] = useState(false);
  const running = lanes.some((l) => l.status === 'running');

  const run = (prov: Provider, blocks: ChatBlock[], round: number) =>
    new Promise<void>((resolve) => {
      let acc = '';
      setLanes((ls) => ls.map((l) => (l.provider === prov ? { ...l, text: '', status: 'running', round } : l)));
      chatStream({ provider: prov, model: settings.ai.models[prov], system: SYSTEM, effort: settings.ai.effort, messages: [{ role: 'user', content: blocks }] }, (d) => {
        acc += d;
        setLanes((ls) => ls.map((l) => (l.provider === prov ? { ...l, text: acc } : l)));
      })
        .done.then((r) => setLanes((ls) => ls.map((l) => (l.provider === prov ? { ...l, text: r.text || acc, status: 'done' } : l))))
        .catch((e: Error) => setLanes((ls) => ls.map((l) => (l.provider === prov ? { ...l, text: `${acc}\n\n— ${e.message}`, status: 'error' } : l))))
        .finally(resolve);
    });

  const userBlocks = (): ChatBlock[] => {
    const { documento, titulo } = docsText(atts);
    const text = documento ? `--- DOCUMENTOS: ${titulo} ---\n${documento}\n--- FIM ---\n\n${question}` : question;
    return [...imageBlocks(atts), { type: 'text', text }];
  };

  const start = async () => {
    setMerged('');
    setLanes(selected.map((p) => ({ provider: p, text: '', status: 'running', round: 1 })));
    const blocks = userBlocks();
    await Promise.all(selected.map((p) => run(p, blocks, 1)));
  };

  const confront = async () => {
    const snapshot = lanes.filter((l) => l.status === 'done');
    await Promise.all(
      snapshot.map((lane) => {
        const others = snapshot
          .filter((o) => o.provider !== lane.provider)
          .map((o) => `### ${providerInfo(o.provider).name}\n${o.text}`)
          .join('\n\n');
        const text =
          `Pergunta original: ${question}\n\nSua resposta anterior:\n${lane.text}\n\nRespostas dos outros modelos:\n${others}\n\n` +
          'Confronte: aponte erros e lacunas das outras respostas e da sua, com justificativa. Depois entregue sua resposta REVISADA. ' +
          'Mantenha o que estava certo; mude só o que tiver motivo.';
        return run(lane.provider, [{ type: 'text', text }], lane.round + 1);
      }),
    );
  };

  const reconcile = () => {
    const tpl = allTemplates('prompt').find((t) => t.id === 'reconciliar')!;
    const documento = lanes
      .filter((l) => l.status === 'done')
      .map((l) => `### ${providerInfo(l.provider).name} (rodada ${l.round})\n${l.text}`)
      .join('\n\n');
    setMerging(true);
    setMerged('');
    let acc = '';
    chatStream(
      {
        provider: judge,
        model: settings.ai.models[judge],
        effort: settings.ai.effort,
        messages: [{ role: 'user', content: [{ type: 'text', text: fillTemplate(tpl.template, { documento, entrada: question }) }] }],
      },
      (d) => setMerged((acc += d)),
    )
      .done.catch((e: Error) => setMerged(`${acc}\n\n— ${e.message}`))
      .finally(() => setMerging(false));
  };

  const doneCount = lanes.filter((l) => l.status === 'done').length;

  return (
    <div className="llm">
      <header className="llm-head">
        <span className="llm-badge" style={{ background: '#B5179E' }}>
          4
        </span>
        <div>
          <h1>IA-Round</h1>
          <span className="muted small">Uma pergunta, vários modelos, confronto e reconciliação</span>
        </div>
      </header>
      <div className="chat-layout">
        <div className="chat-main round-main">
          {!aiAvailable() && <div className="notice">Disponível no app desktop com chaves configuradas.</div>}
          <div className="round-input">
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="Pergunta para todos os modelos…" aria-label="Pergunta" />
            <div className="row">
              {PROVIDERS.map((p) => (
                <label key={p.id} className="check small">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                  />
                  <span>{p.name}</span>
                </label>
              ))}
              {atts.length > 0 && <span className="muted small">{atts.length} anexo(s)</span>}
              <button className="btn btn-primary btn-sm" disabled={!question.trim() || !selected.length || running} onClick={start}>
                Disparar rodada
              </button>
              <button className="btn btn-sm" disabled={doneCount < 2 || running} onClick={confront} title="Cada modelo critica os outros e revisa a própria resposta">
                Rodada de confronto
              </button>
              <span className="muted small">Reconciliar com</span>
              <select value={judge} onChange={(e) => setJudge(e.target.value as Provider)} aria-label="Modelo reconciliador">
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm btn-primary" disabled={doneCount < 2 || running || merging} onClick={reconcile}>
                {merging ? 'Reconciliando…' : 'Reconciliar'}
              </button>
            </div>
          </div>
          <div className="lanes" style={{ gridTemplateColumns: `repeat(${Math.max(1, lanes.length)}, minmax(0, 1fr))` }}>
            {lanes.map((l) => (
              <section key={l.provider} className={`lane lane-${l.status}`}>
                <header>
                  <span className="tab-badge" style={{ background: providerInfo(l.provider).color }}>
                    {providerInfo(l.provider).name[0]}
                  </span>
                  <strong>{providerInfo(l.provider).name}</strong>
                  <span className="muted small">
                    rodada {l.round} · {{ idle: '', running: 'gerando…', done: 'pronto', error: 'erro' }[l.status]}
                  </span>
                </header>
                <div className="lane-body">
                  <Markdown text={l.text || '…'} />
                </div>
              </section>
            ))}
          </div>
          {merged && (
            <section className="merged">
              <header className="row space">
                <h2>Síntese reconciliada ({providerInfo(judge).name})</h2>
                {!merging && (
                  <div className="row">
                    <button className="link" onClick={() => navigator.clipboard.writeText(merged)}>
                      Copiar
                    </button>
                    <button className="link" onClick={() => toWord(`IA-Round — ${question.slice(0, 50)}`, merged, actions.toast)}>
                      Word
                    </button>
                    <button className="link" onClick={() => toLibrary(`IA-Round — ${question.slice(0, 60)}`, merged, 'resposta', actions.toast)}>
                      + Biblioteca
                    </button>
                  </div>
                )}
              </header>
              <Markdown text={merged} />
            </section>
          )}
        </div>
        <aside className="chat-side">
          <h2>Fontes para todos</h2>
          <SourcesPanel onAdd={(a) => setAtts((l) => [...l, ...a])} toast={actions.toast} />
          {atts.length > 0 && (
            <div className="att-row">
              {atts.map((a) => (
                <span key={a.id} className="att">
                  {a.name}
                  <button aria-label={`Remover ${a.name}`} onClick={() => setAtts((l) => l.filter((x) => x.id !== a.id))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
