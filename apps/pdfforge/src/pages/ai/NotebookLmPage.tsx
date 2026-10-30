import { useChatRequests } from '../../ai/useChatRequests';
// NotebookLM não tem API pública: o app monta as fontes (texto bruto ou reescritas por IA) e o usuário as importa no site.
import { useState } from 'react';
import { useActions } from '../../app/actions';
import { docsText, type Attachment } from '../../ai/attachments';
import { aiAvailable, PROVIDERS, type Provider } from '../../ai/bridge';
import { BUILTIN_PROMPTS, fillTemplate } from '../../ai/prompts';
import { toDrive, toFile, toWord } from '../../ai/share';
import { setAi, useAppState } from '../../store/store';
import { SiteView } from './SiteView';
import { SourcesPanel } from './SourcesPanel';

const NOTEBOOK_URL = 'https://notebooklm.google.com/';

export function NotebookLmPage() {
  const actions = useActions();
  const { settings } = useAppState();
  const mode = settings.ai.modes.notebooklm;
  const chatStream = useChatRequests(mode);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [provider, setProvider] = useState<Provider>('claude');
  const [output, setOutput] = useState('');
  const [outputTitle, setOutputTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const { documento, titulo } = docsText(atts);

  const rewrite = () => {
    if (busy) return;
    setOutputTitle(titulo);
    const tpl = BUILTIN_PROMPTS.find((p) => p.id === 'notebooklm')!;
    setBusy(true);
    setOutput('');
    let acc = '';
    chatStream(
      {
        provider,
        model: settings.ai.models[provider],
        effort: settings.ai.effort,
        messages: [{ role: 'user', content: [{ type: 'text', text: fillTemplate(tpl.template, { documento, titulo }) }] }],
      },
      (d) => setOutput((acc += d)),
    )
      .done.catch((e: Error) => { if (e.name !== 'AbortError') actions.toast(e.message, 'error'); })
      .finally(() => setBusy(false));
  };

  const sourceTitle = output ? outputTitle : titulo;
  const source = output || (documento ? `# ${titulo}\n\n${documento}` : '');

  return (
    <div className="llm">
      <header className="llm-head">
        <span className="llm-badge" style={{ background: '#1A73E8' }}>
          N
        </span>
        <div>
          <h1>NotebookLM</h1>
          <span className="muted small">Google · sem API pública — prepare fontes aqui e importe no site</span>
        </div>
        <div className="segmented llm-mode" role="radiogroup" aria-label="Modo">
          {(['api', 'site'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setAi({ modes: { ...settings.ai.modes, notebooklm: m } })}>
              {m === 'api' ? 'Preparar fontes' : 'Site'}
            </button>
          ))}
        </div>
      </header>
      {mode === 'site' ? (
        <SiteView url={NOTEBOOK_URL} partition="persist:site-notebooklm" name="NotebookLM" />
      ) : (
        <div className="chat-layout">
          <div className="chat-main nb-main">
            <ol className="nb-steps">
              <li>Adicione PDFs, transcrições (YouTube, Plaud, Reels) ou itens da biblioteca à direita.</li>
              <li>Opcional: reescreva como fonte otimizada com IA (prompt “Resuma para NotebookLM”).</li>
              <li>Salve no Google Drive (o NotebookLM importa direto do Drive) ou baixe o arquivo e faça upload no site.</li>
            </ol>
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
            <div className="row">
              <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="Modelo para reescrever">
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    Reescrever com {p.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm" disabled={!documento || busy || !aiAvailable()} onClick={rewrite}>
                {busy ? 'Gerando…' : 'Gerar fonte com IA'}
              </button>
            </div>
            {output && <p>Saida referente a: {outputTitle}</p>}
            <textarea className="nb-output" value={source} onChange={(e) => { if (!output) setOutputTitle(titulo); setOutput(e.target.value); }} placeholder="A fonte aparece aqui (texto bruto ou reescrito). Você pode editar." aria-label="Fonte para o NotebookLM" />
            <div className="row">
              <button className="btn btn-primary btn-sm" disabled={!source} onClick={() => toDrive(`NotebookLM ${sourceTitle}`, source, actions.toast, true)}>
                Salvar no Drive (.docx)
              </button>
              <button className="btn btn-sm" disabled={!source} onClick={() => toFile(`NotebookLM ${sourceTitle}`, source, 'md')}>
                Baixar .md
              </button>
              <button className="btn btn-sm" disabled={!source} onClick={() => toWord(`NotebookLM ${sourceTitle}`, source, actions.toast)}>
                Word
              </button>
              <a className="btn btn-sm btn-ghost" href={NOTEBOOK_URL} target="_blank" rel="noopener noreferrer">
                Abrir NotebookLM
              </a>
            </div>
          </div>
          <aside className="chat-side">
            <h2>Fontes</h2>
            <SourcesPanel onAdd={(a) => setAtts((l) => [...l, ...a.filter((x) => x.kind === 'doc')])} toast={actions.toast} />
          </aside>
        </div>
      )}
    </div>
  );
}
