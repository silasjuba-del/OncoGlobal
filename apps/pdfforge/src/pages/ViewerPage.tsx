import { useEffect, useRef, useState } from 'react';
import { EnviarOncoGlobal } from '../integrations/EnviarOncoGlobal';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useActions } from '../app/actions';
import { IconLock, IconZoomIn, IconZoomOut } from '../components/icons';
import { ToolIcon } from '../components/ToolIcon';
import { openPdfjs } from '../engine/render';
import { ToolError } from '../engine/types';
import type { FilePayload } from '../platform/platform';
import { TOOLS } from '../tools/catalog';
import { AnnotationsPanel } from './ai/AnnotationsPanel';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** Visualizador com renderização preguiçosa (só páginas visíveis) e miniaturas. */
export function ViewerPage({ file }: { file: FilePayload }) {
  const actions = useActions();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.25);
  const [current, setCurrent] = useState(1);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [notesOpen, setNotesOpen] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let opened: PDFDocumentProxy | null = null;
    openPdfjs(file.bytes, password)
      .then(async (d) => {
        opened = d;
        if (!alive) return d.destroy();
        const s: { w: number; h: number }[] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const vp = (await d.getPage(i)).getViewport({ scale: 1 });
          s.push({ w: vp.width, h: vp.height });
        }
        setSizes(s);
        setDoc(d);
        setNeedPassword(false);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ToolError && /senha/i.test(e.message)) {
          setNeedPassword(true);
          if (password) setError(e.message);
        } else setError((e as Error).message);
      });
    return () => {
      alive = false;
      void opened?.destroy();
    };
  }, [file.bytes, password]);

  const goTo = (n: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-page="${n}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pdfTools = TOOLS.filter((t) => t.status === 'ready' && t.accepts === 'pdf');

  if (needPassword) {
    return (
      <div className="page planned-page">
        <IconLock width={48} height={48} />
        <h2>{file.name} está protegido</h2>
        <form
          className="pw-form wide"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get('pw');
            if (v) setPassword(String(v));
          }}
        >
          <input name="pw" type="password" placeholder="Senha do documento" aria-label="Senha do documento" autoFocus />
          <button className="btn btn-primary" type="submit">
            Abrir
          </button>
        </form>
        {error && <p className="err">{error}</p>}
      </div>
    );
  }
  if (error) return <div className="page"><div className="notice error">{error}</div></div>;
  if (!doc) return <div className="page muted">Abrindo {file.name}…</div>;

  return (
    <div className="viewer">
      <aside className="thumbs">
        {sizes.map((s, i) => (
          <button key={i} className={`thumb-btn ${current === i + 1 ? 'active' : ''}`} onClick={() => goTo(i + 1)}>
            <LazyPage doc={doc} pageNo={i + 1} scale={110 / s.w} size={s} />
            <span>{i + 1}</span>
          </button>
        ))}
      </aside>
      <div className="viewer-main">
        <EnviarOncoGlobal original={file} documento={doc} />
        <div className="viewer-toolbar">
          <span className="muted">
            Página {current} de {doc.numPages}
          </span>
          <div className="zoom">
            <button className="icon-btn" title="Diminuir zoom" onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}>
              <IconZoomOut />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" title="Aumentar zoom" onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}>
              <IconZoomIn />
            </button>
          </div>
          <div className="viewer-tools">
            {pdfTools.slice(0, 6).map((t) => (
              <button key={t.id} className="mini-tool" title={t.name} onClick={() => actions.openTool(t.id, [{ ...file }])}>
                <ToolIcon tool={t} size={26} />
              </button>
            ))}
            <button className={`btn btn-sm ${notesOpen ? 'btn-primary' : ''}`} onClick={() => setNotesOpen((o) => !o)} aria-pressed={notesOpen}>
              Anotações & IA
            </button>
            <select
              aria-label="Mais ferramentas"
              value=""
              onChange={(e) => e.target.value && actions.openTool(e.target.value, [{ ...file }])}
            >
              <option value="">Mais ferramentas…</option>
              {pdfTools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          className="pages"
          ref={scroller}
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop + e.currentTarget.clientHeight / 3;
            const els = e.currentTarget.querySelectorAll<HTMLElement>('[data-page]');
            for (const el of els) {
              if (el.offsetTop + el.offsetHeight > top) {
                setCurrent(Number(el.dataset.page));
                break;
              }
            }
          }}
        >
          {sizes.map((s, i) => (
            <div key={i} data-page={i + 1} className="page-wrap">
              <LazyPage doc={doc} pageNo={i + 1} scale={zoom} size={s} hiDpi />
            </div>
          ))}
        </div>
      </div>
      {notesOpen && <AnnotationsPanel file={file} doc={doc} page={current} onGoTo={goTo} />}
    </div>
  );
}

function LazyPage({ doc, pageNo, scale, size, hiDpi }: { doc: PDFDocumentProxy; pageNo: number; scale: number; size: { w: number; h: number }; hiDpi?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    let cancelled = false;
    let task: { cancel(): void } | null = null;
    const canvas = ref.current;
    const dpr = hiDpi ? window.devicePixelRatio || 1 : 1;
    doc.getPage(pageNo).then((page) => {
      if (cancelled) return;
      const vp = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d')!;
      const t = page.render({ canvasContext: ctx, viewport: vp });
      task = t;
      t.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, pageNo, scale, hiDpi]);

  return <canvas ref={ref} className="pdf-canvas" style={{ width: size.w * scale, height: size.h * scale }} />;
}
