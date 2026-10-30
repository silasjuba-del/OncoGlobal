// Entrada de fontes para IA/biblioteca: PDF, imagem, Word, YouTube, Reels, Plaud, Google Drive, biblioteca, texto.
import { useState } from 'react';
import { imageAttachment, pdfAttachment, textAttachment, type Attachment } from '../../ai/attachments';
import {
  hasDesktopAi,
  listFolder,
  readFolderFile,
  reelsMeta,
  wordImport,
  youtubeTranscript,
  type FolderFile,
} from '../../ai/bridge';
import { docText, useLibrary } from '../../ai/library';
import { openFiles } from '../../platform/platform';
import { useAppState } from '../../store/store';
import { transcribeBytes, transcribeFile } from '../../ai/transcription';

type Panel = null | 'youtube' | 'reels' | 'plaud' | 'drive' | 'library' | 'text';

export function SourcesPanel({ onAdd, toast }: { onAdd(atts: Attachment[]): void; toast(m: string, k?: 'info' | 'error' | 'success'): void }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const desktop = hasDesktopAi();

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const addPdfs = () =>
    run('Lendo PDF…', async () => {
      const files = await openFiles('pdf', true);
      onAdd(await Promise.all(files.map((f) => pdfAttachment(f.name, f.bytes))));
    });
  const addImages = () =>
    run('Preparando imagens…', async () => {
      const files = await openFiles('image', true);
      onAdd(await Promise.all(files.map((f) => imageAttachment(f.name, f.bytes, /\.png$/i.test(f.name) ? 'image/png' : 'image/jpeg'))));
    });
  const addWord = () =>
    run('Lendo Word…', async () => {
      const docs = await wordImport();
      onAdd(docs.map((d) => textAttachment(d.name, d.text, d.path)));
    });

  const btn = (id: Panel, label: string, disabled = false, title?: string) => (
    <button className={`chip ${panel === id ? 'on' : ''}`} disabled={disabled} title={title} onClick={() => setPanel(panel === id ? null : id)}>
      {label}
    </button>
  );

  return (
    <div className="sources">
      <div className="chips">
        <button className="chip" onClick={addPdfs}>
          + PDF
        </button>
        <button className="chip" onClick={addImages} title="Fotos, capturas de tela ou rascunhos (análise visual / UI-UX)">
          + Foto/imagem
        </button>
        <button className="chip" onClick={addWord} disabled={!desktop} title={desktop ? 'Importar .docx' : 'Só no app desktop'}>
          + Word
        </button>
        {btn('youtube', '+ YouTube')}
        {btn('reels', '+ Reels')}
        {btn('plaud', '+ Plaud', !desktop, desktop ? undefined : 'Só no app desktop')}
        {btn('drive', '+ Drive', !desktop, desktop ? undefined : 'Só no app desktop')}
        {btn('library', '+ Biblioteca')}
        {btn('text', '+ Texto')}
      </div>
      {busy && <p className="muted small">{busy}</p>}
      {panel === 'youtube' && <YoutubeForm onDone={(a) => (onAdd([a]), setPanel(null))} run={run} />}
      {panel === 'reels' && <ReelsForm onDone={(a) => (onAdd([a]), setPanel(null))} run={run} />}
      {panel === 'plaud' && <FolderPicker kind="plaud" onDone={(a) => onAdd([a])} run={run} />}
      {panel === 'drive' && <FolderPicker kind="drive" onDone={(a) => onAdd([a])} run={run} />}
      {panel === 'library' && <LibraryPicker onDone={(a) => (onAdd(a), setPanel(null))} />}
      {panel === 'text' && <TextForm onDone={(a) => (onAdd([a]), setPanel(null))} />}
    </div>
  );
}

type Run = (label: string, fn: () => Promise<void>) => Promise<void>;

function YoutubeForm({ onDone, run }: { onDone(a: Attachment): void; run: Run }) {
  const [url, setUrl] = useState('');
  return (
    <form
      className="source-form"
      onSubmit={(e) => {
        e.preventDefault();
        void run('Buscando legenda do YouTube…', async () => {
          const t = await youtubeTranscript(url);
          onDone(textAttachment(`YouTube: ${t.title}`, `Fonte: ${t.url}\nIdioma da legenda: ${t.language}${t.automatic ? ' (automática)' : ''}\n\n${t.text}`, t.url));
        });
      }}
    >
      <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" aria-label="URL do YouTube" />
      <button className="btn btn-sm btn-primary" disabled={!url.trim()}>
        Transcrever
      </button>
    </form>
  );
}

function ReelsForm({ onDone, run }: { onDone(a: Attachment): void; run: Run }) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [transcript, setTranscript] = useState('');
  return (
    <div className="source-form col">
      <p className="muted small">
        O Instagram exige login para baixar Reels. Baixe o vídeo (ou use “Salvar” no app) e selecione o arquivo; cole a legenda se quiser.
      </p>
      <div className="row">
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/… (opcional)" aria-label="URL do Reels" />
        <button
          className="btn btn-sm"
          disabled={!url.trim()}
          onClick={() =>
            run('Lendo metadados do Reels…', async () => {
              const m = await reelsMeta(url);
              if (m.loginWall) throw new Error('O Instagram não liberou a legenda sem login. Cole-a abaixo.');
              setCaption([m.title, m.description].filter(Boolean).join('\n'));
            })
          }
        >
          Ler legenda
        </button>
      </div>
      <button
        className="btn btn-sm"
        onClick={() =>
          run('Transcrevendo vídeo…', async () => {
            const [f] = await openFiles('any', false);
            if (!f) return;
            if (f.bytes.length > 25 * 1024 * 1024) throw new Error('Vídeo maior que 25 MB; a API de transcrição recusa. Corte ou exporte só o áudio.');
            setTranscript(f.path ? await transcribeFile(f.path) : await transcribeBytes(f.bytes, f.name));
          })
        }
      >
        Selecionar vídeo e transcrever
      </button>
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda do Reels" rows={2} aria-label="Legenda" />
      <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Transcrição (gerada ou colada)" rows={4} aria-label="Transcrição" />
      <button
        className="btn btn-sm btn-primary"
        disabled={!caption.trim() && !transcript.trim()}
        onClick={() => onDone(textAttachment(`Reels${url ? `: ${url}` : ''}`, `Legenda:\n${caption}\n\nTranscrição:\n${transcript}`, url || undefined))}
      >
        Anexar Reels
      </button>
    </div>
  );
}

function FolderPicker({ kind, onDone, run }: { kind: 'plaud' | 'drive'; onDone(a: Attachment): void; run: Run }) {
  const { settings } = useAppState();
  const dir = kind === 'plaud' ? settings.ai.plaudFolder : settings.ai.driveFolder;
  const [files, setFiles] = useState<FolderFile[] | null>(null);
  if (!dir) return <p className="muted small">Defina a pasta do {kind === 'plaud' ? 'Plaud (exportações)' : 'Google Drive'} em Configurações → Plugins.</p>;
  const load = () => run('Listando pasta…', async () => setFiles(await listFolder(kind === 'drive' ? `${dir}` : dir)));
  return (
    <div className="source-form col">
      <div className="row">
        <span className="muted small ellipsis" title={dir}>
          {dir}
        </span>
        <button className="btn btn-sm" onClick={load}>
          {files ? 'Atualizar' : 'Listar arquivos'}
        </button>
      </div>
      {files && files.length === 0 && <p className="muted small">Nenhum PDF, Word, texto, legenda ou áudio nesta pasta.</p>}
      {files && (
        <ul className="file-pick">
          {files.slice(0, 40).map((f) => (
            <li key={f.path}>
              <button
                className="link"
                onClick={() =>
                  run(`Importando ${f.name}…`, async () => {
                    if (f.kind === 'audio') {
                      const text = await transcribeFile(f.path);
                      onDone(textAttachment(`${kind === 'plaud' ? 'Plaud' : 'Drive'}: ${f.name}`, text, f.path));
                      return;
                    }
                    const c = await readFolderFile(f.path);
                    onDone(c.kind === 'pdf' && c.bytes ? await pdfAttachment(c.name, c.bytes) : textAttachment(`${kind === 'plaud' ? 'Plaud' : 'Drive'}: ${c.name}`, c.text ?? '', f.path));
                  })
                }
              >
                {f.name}
              </button>
              <span className="muted small">
                {f.kind} · {new Date(f.mtime).toLocaleDateString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LibraryPicker({ onDone }: { onDone(a: Attachment[]): void }) {
  const lib = useLibrary();
  const [sel, setSel] = useState<string[]>([]);
  if (!lib.docs.length) return <p className="muted small">A biblioteca está vazia.</p>;
  return (
    <div className="source-form col">
      <ul className="file-pick">
        {lib.docs.slice(0, 60).map((d) => (
          <li key={d.id}>
            <label className="check">
              <input type="checkbox" checked={sel.includes(d.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))} />
              <span>{d.title}</span>
            </label>
          </li>
        ))}
      </ul>
      <button className="btn btn-sm btn-primary" disabled={!sel.length} onClick={() => onDone(lib.docs.filter((d) => sel.includes(d.id)).map((d) => textAttachment(d.title, docText(d), d.source)))}>
        Anexar {sel.length || ''}
      </button>
    </div>
  );
}

function TextForm({ onDone }: { onDone(a: Attachment): void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  return (
    <div className="source-form col">
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" aria-label="Título do texto" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Cole o texto aqui" aria-label="Texto" />
      <button className="btn btn-sm btn-primary" disabled={!text.trim()} onClick={() => onDone(textAttachment(title || 'Texto colado', text))}>
        Anexar texto
      </button>
    </div>
  );
}
