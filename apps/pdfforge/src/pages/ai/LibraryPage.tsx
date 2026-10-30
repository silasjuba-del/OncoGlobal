import { answerWithSources } from '../../ai/answerSources';
// Biblioteca Memo-RAG: acervo local de PDFs, transcrições, respostas e anotações, com busca e perguntas com citação.
import { useMemo, useState } from 'react';
import { useActions } from '../../app/actions';
import { attachmentPages, textAttachment, type Attachment } from '../../ai/attachments';
import { aiAvailable, chatStream, PROVIDERS, type Provider } from '../../ai/bridge';
import { addDoc, docText, docTitle, removeDoc, searchLibrary, useLibrary, type DocKind } from '../../ai/library';
import { buildContext, RAG_SYSTEM, type Hit } from '../../ai/rag';
import { toWord } from '../../ai/share';
import { Markdown } from '../../components/Markdown';
import { useAppState } from '../../store/store';
import { SourcesPanel } from './SourcesPanel';

const KIND_LABEL: Record<DocKind, string> = {
  pdf: 'PDF',
  resposta: 'Resposta IA',
  transcricao: 'Transcrição',
  youtube: 'YouTube',
  reels: 'Reels',
  plaud: 'Plaud',
  word: 'Word',
  nota: 'Anotações',
  texto: 'Texto',
};

function kindOf(a: Attachment): DocKind {
  if (/^YouTube/.test(a.name)) return 'youtube';
  if (/^Reels/.test(a.name)) return 'reels';
  if (/^Plaud/.test(a.name)) return 'plaud';
  if (/\.docx$/i.test(a.name)) return 'word';
  if (a.pages) return 'pdf';
  return 'texto';
}

export function LibraryPage() {
  const actions = useActions();
  const lib = useLibrary();
  const { settings } = useAppState();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [provider, setProvider] = useState<Provider>('claude');
  const [answer, setAnswer] = useState('');
  const [answerSource, setAnswerSource] = useState({ question: '', context: '' });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<DocKind | ''>('');
  const docs = useMemo(() => lib.docs.filter((d) => !filter || d.kind === filter), [lib.docs, filter]);
  const totalChunks = lib.docs.reduce((s, d) => s + d.chunks.length, 0);

  const ask = () => {
    if (busy) return;
    const found = searchLibrary(query, 8);
    const snapshot = { question: query, context: buildContext(found, docTitle) };
    setAnswerSource(snapshot);
    setHits(found);
    if (!found.length) {
      setAnswer('Nada relevante encontrado na biblioteca para essa pergunta.');
      return;
    }
    setBusy(true);
    setAnswer('');
    let acc = '';
    chatStream(
      {
        provider,
        model: settings.ai.models[provider],
        effort: settings.ai.effort,
        system: RAG_SYSTEM,
        messages: [{ role: 'user', content: [{ type: 'text', text: `Trechos:\n${snapshot.context}\n\nPergunta: ${snapshot.question}` }] }],
      },
      (d) => setAnswer((acc += d)),
    )
      .done.catch((e: Error) => setAnswer(`${acc}\n\n— ${e.message}`))
      .finally(() => setBusy(false));
  };

  return (
    <div className="llm">
      <header className="llm-head">
        <span className="llm-badge" style={{ background: '#6C7BD0' }}>
          M
        </span>
        <div>
          <h1>Biblioteca Memo-RAG</h1>
          <span className="muted small">
            {lib.docs.length} documentos · {totalChunks} trechos indexados · {lib.annotations.length} anotações — tudo local
          </span>
        </div>
      </header>
      <div className="chat-layout">
        <div className="chat-main lib-main">
          <form
            className="row lib-ask"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) setHits(searchLibrary(query, 12));
            }}
          >
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ou perguntar à biblioteca…" aria-label="Busca na biblioteca" />
            <button className="btn btn-sm">Buscar</button>
            <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="Provedor para responder">
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-primary" disabled={!query.trim() || busy || !aiAvailable()} onClick={ask}>
              {busy ? 'Respondendo…' : 'Perguntar com citações'}
            </button>
          </form>
          {answer && (
            <div className="lib-answer">
              <p>Pergunta desta resposta: {answerSource.question}</p>
              <Markdown text={answer} />
              <details><summary>Fontes desta resposta</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{answerSource.context}</pre></details>
              {!busy && (
                <div className="msg-actions">
                  <button className="link" onClick={() => navigator.clipboard.writeText(answerWithSources({ display: answer, sourceSnapshot: answerSource.context }))}>
                    Copiar
                  </button>
                  <button className="link" onClick={() => toWord(`Biblioteca — ${answerSource.question}`, answerWithSources({ display: answer, sourceSnapshot: answerSource.context }), actions.toast)}>
                    Word
                  </button>
                </div>
              )}
            </div>
          )}
          {hits && (
            <section>
              <h2 className="sub">Resultados da busca atual — trechos encontrados ({hits.length})</h2>
              {hits.length === 0 && <p className="muted">Nenhum trecho contém esses termos.</p>}
              <ol className="hits">
                {hits.map((h, i) => (
                  <li key={h.chunk.id}>
                    <div className="hit-head">
                      <strong>[{i + 1}] {docTitle(h.chunk.docId)}</strong>
                      {h.chunk.page && <span className="muted small"> p. {h.chunk.page}</span>}
                      <span className="muted small"> · relevância {h.score.toFixed(1)}</span>
                    </div>
                    <p>{h.chunk.text.slice(0, 420)}{h.chunk.text.length > 420 ? '…' : ''}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section>
            <div className="row space">
              <h2 className="sub">Acervo</h2>
              <select value={filter} onChange={(e) => setFilter(e.target.value as DocKind | '')} aria-label="Filtrar por tipo">
                <option value="">Todos os tipos</option>
                {Object.entries(KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {docs.length === 0 ? (
              <p className="empty">Adicione fontes à direita, ou use “+ Biblioteca” nas respostas da IA e nas anotações do visualizador.</p>
            ) : (
              <table className="history">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Tamanho</th>
                    <th>Adicionado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>{d.title}</td>
                      <td>
                        <span className="tag">{KIND_LABEL[d.kind]}</span>
                      </td>
                      <td className="muted">
                        {d.chunks.length} trechos · {(d.chars / 1000).toFixed(1)} mil caract.
                      </td>
                      <td className="muted">{new Date(d.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="row-actions">
                        <button className="link" onClick={() => actions.openLlm('claude', { attachments: [textAttachment(d.title, docText(d), d.source)] })}>
                          Abrir no Claude
                        </button>
                        <button className="link-danger" onClick={() => removeDoc(d.id)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
        <aside className="chat-side">
          <h2>Adicionar à biblioteca</h2>
          <SourcesPanel
            onAdd={(atts) => {
              for (const a of atts.filter((x) => x.kind === 'doc')) {
                const doc = addDoc(a.name, kindOf(a), attachmentPages(a), a.source);
                actions.toast(`"${doc.title}" indexado (${doc.chunks.length} trechos).`, 'success');
              }
            }}
            toast={actions.toast}
          />
        </aside>
      </div>
    </div>
  );
}
