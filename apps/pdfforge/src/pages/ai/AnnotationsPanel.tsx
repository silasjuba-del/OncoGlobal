import { useChatRequests } from '../../ai/useChatRequests';
// Anotações ao lado do PDF: por página, manuais ou geradas por IA; exportáveis para Word e biblioteca.
import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useActions } from '../../app/actions';
import { attachmentPages, pdfAttachment } from '../../ai/attachments';
import { aiAvailable, PROVIDERS, type Provider } from '../../ai/bridge';
import { addAnnotation, addDoc, docKeyOf, removeAnnotation, updateAnnotation, useLibrary } from '../../ai/library';
import { toLibrary, toWord } from '../../ai/share';
import type { FilePayload } from '../../platform/platform';
import { useAppState } from '../../store/store';

async function pageText(doc: PDFDocumentProxy, n: number) {
  const tc = await (await doc.getPage(n)).getTextContent();
  return tc.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('').trim();
}

export function AnnotationsPanel({ file, doc, page, onGoTo }: { file: FilePayload; doc: PDFDocumentProxy; page: number; onGoTo(n: number): void }) {
  const actions = useActions();
  const chatStream = useChatRequests(file);
  const lib = useLibrary();
  const { settings } = useAppState();
  const [identidade, setIdentidade] = useState<{ file: FilePayload; key: string } | null>(null);
  const key = identidade?.file === file ? identidade.key : null;
  useEffect(() => {
    let ativo = true;
    void docKeyOf(file).then(key => { if (ativo) setIdentidade({ file, key }); })
      .catch(() => { if (ativo) actions.toast('Nao foi possivel conferir o conteudo do documento.', 'error'); });
    return () => { ativo = false; };
  }, [file]);
  const notes = lib.annotations.filter((a) => a.docKey === key).sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState<'page' | 'all'>('page');
  const [provider, setProvider] = useState<Provider>('claude');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const visible = scope === 'page' ? notes.filter((n) => n.page === page) : notes;

  const generate = async () => {
    if (!key) return;
    setBusy(true);
    try {
      const text = await pageText(doc, page);
      if (!text) throw new Error('Página sem texto extraível (use OCR PDF antes).');
      const prompt =
        `Gere de 3 a 6 anotações de margem, curtas e úteis para estudo/revisão, sobre a página ${page} abaixo. ` +
        `Uma por linha, começando com "- ". Copie números, doses e unidades exatamente. Não invente nada que não esteja no texto.\n\n--- PÁGINA ${page} ---\n${text}`;
      const r = await chatStream(
        { provider, model: settings.ai.models[provider], effort: 'medium', messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }] },
        () => {},
      ).done;
      const items = r.text
        .split('\n')
        .map((l) => l.match(/^\s*[-*•]\s+(.*)/)?.[1]?.trim())
        .filter((l): l is string => Boolean(l));
      if (!items.length) throw new Error('A IA não devolveu anotações no formato esperado.');
      items.forEach((t) => addAnnotation({ docKey: key, docName: file.name, page, text: t, source: 'ai' }));
      actions.toast(`${items.length} anotações geradas para a página ${page}.`, 'success');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') actions.toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportMd = () =>
    `# Anotações — ${file.name}\n\n` +
    [...new Set(notes.map((n) => n.page))]
      .map((p) => `## Página ${p}\n${notes.filter((n) => n.page === p).map((n) => `- ${n.text}${n.source === 'ai' ? ' _(IA)_' : ''}`).join('\n')}`)
      .join('\n\n');

  return (
    <aside className="notes-panel" aria-label="Anotações">
      <div className="notes-head">
        <h2>Anotações</h2>
        <div className="segmented small-seg">
          <button className={scope === 'page' ? 'on' : ''} onClick={() => setScope('page')}>
            Pág. {page}
          </button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
            Todas ({notes.length})
          </button>
        </div>
      </div>
      {lib.annotations.some(a => a.docKey === (file.path ?? `${file.name}:${file.bytes.length}`)) &&
        <p role="status">Anotacoes antigas preservadas na biblioteca, sem vinculo confirmado ao conteudo atual.</p>}
      <form
        className="note-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || !key) return;
          addAnnotation({ docKey: key, docName: file.name, page, text: draft.trim(), source: 'user' });
          setDraft('');
        }}
      >
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={`Anotar na página ${page}…`} aria-label="Nova anotação" />
        <button className="btn btn-sm btn-primary" disabled={!draft.trim() || !key}>
          Anotar
        </button>
      </form>
      <div className="row note-ai">
        <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="IA para anotar">
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" disabled={busy || !key || !aiAvailable()} onClick={generate} title={aiAvailable() ? '' : 'Disponível no app desktop'}>
          {busy ? 'Gerando…' : 'IA: anotar página'}
        </button>
      </div>
      <ul className="notes">
        {visible.length === 0 && <li className="muted small">Nenhuma anotação {scope === 'page' ? 'nesta página' : 'neste documento'}.</li>}
        {visible.map((n) => (
          <li key={n.id} className={`note ${n.source}`}>
            <button className="note-page" onClick={() => onGoTo(n.page)} title="Ir para a página">
              p. {n.page}
            </button>
            {editing === n.id ? (
              <textarea
                autoFocus
                defaultValue={n.text}
                rows={3}
                onBlur={(e) => {
                  updateAnnotation(n.id, e.target.value.trim() || n.text);
                  setEditing(null);
                }}
                aria-label="Editar anotação"
              />
            ) : (
              <p onDoubleClick={() => setEditing(n.id)} title="Duplo clique para editar">
                {n.text}
              </p>
            )}
            <div className="note-meta">
              <span className="muted small">{n.source === 'ai' ? 'IA' : 'você'}</span>
              <button className="link-danger small" onClick={() => removeAnnotation(n.id)}>
                excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="notes-foot">
        <button className="btn btn-sm" disabled={!notes.length} onClick={() => toWord(`Anotações ${file.name}`, exportMd(), actions.toast)}>
          Exportar Word
        </button>
        <button className="btn btn-sm" disabled={!notes.length} onClick={() => toLibrary(`Anotações — ${file.name}`, exportMd(), 'nota', actions.toast, file.path ?? undefined)}>
          Anotações → biblioteca
        </button>
        <button
          className="btn btn-sm"
          onClick={async () => {
            const att = await pdfAttachment(file.name, file.bytes);
            const d = addDoc(file.name, 'pdf', attachmentPages(att), file.path ?? undefined);
            actions.toast(`PDF indexado na biblioteca (${d.chunks.length} trechos).`, 'success');
          }}
        >
          PDF → biblioteca
        </button>
        <button className="btn btn-sm btn-primary" onClick={async () => actions.openLlm('claude', { attachments: [await pdfAttachment(file.name, file.bytes)] })}>
          Perguntar à IA
        </button>
      </div>
    </aside>
  );
}
