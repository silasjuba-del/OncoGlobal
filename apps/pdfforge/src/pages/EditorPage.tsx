// Editor visual de PDF: texto, imagens, formas, caneta, marca-texto, corretor, assinatura e notas,
// com desfazer/refazer, camadas, zoom, miniaturas e rascunho automático. Aplica com src/engine/edit.ts.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { EnviarOncoGlobal } from '../integrations/EnviarOncoGlobal';
import { useActions } from '../app/actions';
import { applyEdits, boundsOf, LINE_HEIGHT, NOTE_SIZE, resizeOp, translateOp, type Bounds, type EditOp, type FontFamily } from '../engine/edit';
import { openPdfjs, pageThumbnails, renderPage } from '../engine/render';
import { ToolError, type OutputFile } from '../engine/types';
import { openFiles, saveFile, type FilePayload } from '../platform/platform';

type Tool = 'select' | 'text' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'pen' | 'highlight' | 'whiteout' | 'note';

interface Style {
  stroke: string;
  fill: string | null;
  strokeWidth: number;
  opacity: number;
  font: FontFamily;
  bold: boolean;
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

const DEFAULT_STYLE: Style = {
  stroke: '#E5322D',
  fill: null,
  strokeWidth: 2,
  opacity: 1,
  font: 'Helvetica',
  bold: false,
  size: 14,
  color: '#161616',
  align: 'left',
};

const TOOLS: { id: Tool; label: string; glyph: string; key: string; hint?: string }[] = [
  { id: 'select', label: 'Selecionar e mover', glyph: '↖', key: 'v' },
  { id: 'text', label: 'Texto', glyph: 'T', key: 't' },
  { id: 'rect', label: 'Retângulo', glyph: '▭', key: 'r' },
  { id: 'ellipse', label: 'Elipse', glyph: '◯', key: 'o' },
  { id: 'line', label: 'Linha', glyph: '╱', key: 'l' },
  { id: 'arrow', label: 'Seta', glyph: '↗', key: 'a' },
  { id: 'pen', label: 'Caneta (desenho livre)', glyph: '✎', key: 'p' },
  { id: 'highlight', label: 'Marca-texto', glyph: '▬', key: 'h' },
  {
    id: 'whiteout',
    label: 'Corretor (cobrir de branco)',
    glyph: '▢',
    key: 'w',
    hint: 'Só cobre visualmente: o conteúdo por baixo continua no arquivo. Não é tarja segura.',
  },
  { id: 'note', label: 'Nota (comentário do PDF)', glyph: '💬', key: 'n' },
];

const FONT_CSS: Record<FontFamily, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
};

const TYPE_LABEL: Record<EditOp['type'], string> = {
  text: 'Texto',
  image: 'Imagem',
  rect: 'Retângulo',
  ellipse: 'Elipse',
  highlight: 'Marca-texto',
  whiteout: 'Corretor',
  line: 'Linha',
  arrow: 'Seta',
  ink: 'Desenho',
  note: 'Nota',
};

const uid = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

interface Drag {
  mode: 'move' | 'resize' | 'create' | 'draw';
  id: string;
  start: { x: number; y: number };
  origin: EditOp;
  handle?: string;
  snapshot: EditOp[];
}

export function EditorPage({ file }: { file: FilePayload }) {
  const actions = useActions();
  const draftKey = `pdfforge-editor:${file.path ?? `${file.name}:${file.bytes.length}`}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [password, setPassword] = useState<string | undefined>();
  const [needPw, setNeedPw] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [zoom, setZoom] = useState(1.25);
  const [tool, setTool] = useState<Tool>('select');
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [ops, setOps] = useState<EditOp[]>([]);
  const [past, setPast] = useState<EditOp[][]>([]);
  const [future, setFuture] = useState<EditOp[][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ out: OutputFile; path: string | null } | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const drag = useRef<Drag | null>(null);
  const editSnapshot = useRef<EditOp[] | null>(null);
  const lastPropEdit = useRef<{ key: string; at: number } | null>(null);
  const draftWarned = useRef(false);
  const textEls = useRef(new Map<string, HTMLDivElement>());

  // ---------- carregamento ----------
  useEffect(() => {
    let alive = true;
    let opened: PDFDocumentProxy | null = null;
    openPdfjs(file.bytes, password)
      .then(async (d) => {
        opened = d;
        if (!alive) return void d.destroy();
        const s: { w: number; h: number }[] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const vp = (await d.getPage(i)).getViewport({ scale: 1 });
          s.push({ w: vp.width, h: vp.height });
        }
        setSizes(s);
        setDoc(d);
        setNeedPw(false);
        setLoadError(null);
        void pageThumbnails(file.bytes, 110, password).then((t) => alive && setThumbs(t)).catch(() => {});
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ToolError && /senha/i.test(e.message)) {
          setNeedPw(true);
          if (password) setLoadError(e.message);
        } else setLoadError((e as Error).message);
      });
    return () => {
      alive = false;
      void opened?.destroy();
    };
  }, [file.bytes, password]);

  // rascunho: restaura uma vez e grava a cada mudança
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      const saved = raw ? (JSON.parse(raw) as EditOp[]) : [];
      if (Array.isArray(saved) && saved.length) {
        setOps(saved);
        setDraftCount(saved.length);
      }
    } catch {
      /* rascunho indisponível */
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      if (ops.length) localStorage.setItem(draftKey, JSON.stringify(ops));
      else localStorage.removeItem(draftKey);
    } catch {
      if (!draftWarned.current) {
        draftWarned.current = true;
        actions.toast('Rascunho grande demais para salvar automaticamente (imagens). Salve o PDF para não perder o trabalho.', 'error');
      }
    }
  }, [ops, draftKey, actions]);

  // ---------- histórico ----------
  const commit = useCallback(
    (next: EditOp[], snapshot: EditOp[] = ops) => {
      setPast((p) => [...p.slice(-99), snapshot]);
      setFuture([]);
      setOps(next);
    },
    [ops],
  );

  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture((f) => [ops, ...f]);
    setOps(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setEditingText(null);
  }, [past, ops]);

  const redo = useCallback(() => {
    if (!future.length) return;
    setPast((p) => [...p, ops]);
    setOps(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, ops]);

  const sel = ops.find((o) => o.id === selected) ?? null;
  const pageOps = useMemo(() => ops.filter((o) => o.page === pageIdx), [ops, pageIdx]);
  const size = sizes[pageIdx];

  const updateOp = (id: string, patch: Partial<EditOp>, coalesceKey?: string) => {
    const next = ops.map((o) => (o.id === id ? ({ ...o, ...patch } as EditOp) : o));
    const now = Date.now();
    const same = coalesceKey && lastPropEdit.current?.key === `${id}:${coalesceKey}` && now - lastPropEdit.current.at < 900;
    lastPropEdit.current = coalesceKey ? { key: `${id}:${coalesceKey}`, at: now } : null;
    if (same) setOps(next);
    else commit(next);
  };

  const removeSelected = useCallback(() => {
    if (!selected) return;
    commit(ops.filter((o) => o.id !== selected));
    setSelected(null);
    setEditingText(null);
  }, [selected, ops, commit]);

  const duplicateSelected = useCallback(() => {
    if (!sel) return;
    const copy = { ...translateOp(sel, 12, 12), id: uid() } as EditOp;
    commit([...ops, copy]);
    setSelected(copy.id);
  }, [sel, ops, commit]);

  const reorder = (id: string, dir: -1 | 1) => {
    const i = ops.findIndex((o) => o.id === id);
    // troca com o vizinho da MESMA página na direção pedida
    let j = i + dir;
    while (j >= 0 && j < ops.length && ops[j].page !== ops[i].page) j += dir;
    if (j < 0 || j >= ops.length) return;
    const next = [...ops];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  // ---------- teclado ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current || rootRef.current.offsetParent === null) return; // aba oculta
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd' && !typing) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === 'Escape') {
        if (editingText) (document.activeElement as HTMLElement | null)?.blur();
        setEditingText(null);
        setSelected(null);
        setTool('select');
        return;
      }
      if (typing || mod) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        removeSelected();
        return;
      }
      if (sel && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const next = ops.map((o) => (o.id === sel.id ? translateOp(o, dx, dy) : o));
        const now = Date.now();
        const same = lastPropEdit.current?.key === `${sel.id}:nudge` && now - lastPropEdit.current.at < 900;
        lastPropEdit.current = { key: `${sel.id}:nudge`, at: now };
        if (same) setOps(next);
        else commit(next);
        return;
      }
      const tl = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (tl) setTool(tl.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, duplicateSelected, removeSelected, editingText, selected, sel, ops, commit]);

  // altura das caixas de texto acompanha o conteúdo renderizado
  useLayoutEffect(() => {
    let changed = false;
    const next = ops.map((o) => {
      if (o.type !== 'text') return o;
      const el = textEls.current.get(o.id);
      if (!el) return o;
      const h = Math.max(o.size * LINE_HEIGHT, el.scrollHeight);
      if (Math.abs(h - o.h) > 1) {
        changed = true;
        return { ...o, h };
      }
      return o;
    });
    if (changed) setOps(next);
  }, [ops, editingText]);

  // ---------- ponteiro ----------
  const pointOf = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !size) return;
    const p = pointOf(e);
    const target = e.target as Element;
    const handle = target.getAttribute('data-handle');
    const hitId = target.closest('[data-id]')?.getAttribute('data-id') ?? null;

    if (handle && sel) {
      drag.current = { mode: 'resize', id: sel.id, start: p, origin: sel, handle, snapshot: ops };
      svgRef.current!.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'select' || (tool === 'text' && hitId)) {
      if (hitId) {
        const op = ops.find((o) => o.id === hitId)!;
        if (editingText === hitId) return; // clique dentro do texto em edição
        setSelected(hitId);
        if (tool === 'text' && op.type === 'text') {
          e.preventDefault();
          setEditingText(hitId);
          editSnapshot.current = ops;
          return;
        }
        drag.current = { mode: 'move', id: hitId, start: p, origin: op, snapshot: ops };
        svgRef.current!.setPointerCapture(e.pointerId);
      } else {
        setSelected(null);
        setEditingText(null);
      }
      return;
    }

    const base = { id: uid(), page: pageIdx };
    let op: EditOp;
    // Impede o mousedown padrão de tirar o foco da caixa recém-criada (ela seria descartada vazia no blur).
    if (tool === 'text' || tool === 'note') e.preventDefault();
    switch (tool) {
      case 'text':
        op = { ...base, type: 'text', x: p.x, y: p.y, w: Math.min(260, size.w - p.x - 8), h: style.size * LINE_HEIGHT, text: '', font: style.font, bold: style.bold, size: style.size, color: style.color, align: style.align, opacity: style.opacity };
        editSnapshot.current = ops;
        setOps([...ops, op]);
        setSelected(op.id);
        setEditingText(op.id);
        setTool('select');
        return;
      case 'note':
        op = { ...base, type: 'note', x: p.x - NOTE_SIZE / 2, y: p.y - NOTE_SIZE / 2, text: '', color: '#FFC233' };
        commit([...ops, op]);
        setSelected(op.id);
        setTool('select');
        return;
      case 'line':
      case 'arrow':
        op = { ...base, type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: style.stroke, strokeWidth: style.strokeWidth, opacity: style.opacity };
        break;
      case 'pen':
        op = { ...base, type: 'ink', points: [p.x, p.y], stroke: style.stroke, strokeWidth: style.strokeWidth, opacity: style.opacity };
        drag.current = { mode: 'draw', id: op.id, start: p, origin: op, snapshot: ops };
        setOps([...ops, op]);
        svgRef.current!.setPointerCapture(e.pointerId);
        return;
      case 'highlight':
        op = { ...base, type: 'highlight', x: p.x, y: p.y, w: 0, h: 0, stroke: null, fill: '#FFE600', strokeWidth: 0, opacity: 0.35 };
        break;
      case 'whiteout':
        op = { ...base, type: 'whiteout', x: p.x, y: p.y, w: 0, h: 0, stroke: null, fill: '#FFFFFF', strokeWidth: 0, opacity: 1 };
        break;
      default:
        op = { ...base, type: tool as 'rect' | 'ellipse', x: p.x, y: p.y, w: 0, h: 0, stroke: style.stroke, fill: style.fill, strokeWidth: style.strokeWidth, opacity: style.opacity };
    }
    drag.current = { mode: 'create', id: op.id, start: p, origin: op, snapshot: ops };
    setOps([...ops, op]);
    svgRef.current!.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = pointOf(e);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    let updated: EditOp;
    if (d.mode === 'move') updated = translateOp(d.origin, dx, dy);
    else if (d.mode === 'draw' && d.origin.type === 'ink') {
      const cur = ops.find((o) => o.id === d.id) as Extract<EditOp, { type: 'ink' }>;
      const pts = cur.points;
      const lx = pts[pts.length - 2];
      const ly = pts[pts.length - 1];
      if (Math.hypot(p.x - lx, p.y - ly) < 1.5) return;
      updated = { ...cur, points: [...pts, p.x, p.y] };
    } else if (d.mode === 'create') {
      const o = d.origin;
      if (o.type === 'line' || o.type === 'arrow') updated = { ...o, x2: p.x, y2: p.y };
      else {
        const b: Bounds = { x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(dx), h: Math.abs(dy) };
        updated = { ...(o as Extract<EditOp, { w: number }>), ...b } as EditOp;
      }
    } else {
      // resize
      const o = d.origin;
      if ((o.type === 'line' || o.type === 'arrow') && (d.handle === 'p1' || d.handle === 'p2')) {
        updated = d.handle === 'p1' ? { ...o, x1: p.x, y1: p.y } : { ...o, x2: p.x, y2: p.y };
      } else {
        const b = boundsOf(o);
        let x1 = b.x;
        let y1 = b.y;
        let x2 = b.x + b.w;
        let y2 = b.y + b.h;
        if (d.handle!.includes('w')) x1 = Math.min(p.x, x2 - 4);
        if (d.handle!.includes('e')) x2 = Math.max(p.x, x1 + 4);
        if (d.handle!.includes('n')) y1 = Math.min(p.y, y2 - 4);
        if (d.handle!.includes('s')) y2 = Math.max(p.y, y1 + 4);
        let nb: Bounds = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        if (o.type === 'image' && b.w && b.h) {
          // imagens mantêm a proporção
          const ratio = b.h / b.w;
          const h = nb.w * ratio;
          nb = { ...nb, h, y: d.handle!.includes('n') ? y2 - h : y1 };
        }
        updated = resizeOp(o, nb);
      }
    }
    setOps((cur) => cur.map((x) => (x.id === d.id ? updated : x)));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const now = ops.find((o) => o.id === d.id);
    if (!now) return;
    const b = boundsOf(now);
    const tiny = d.mode === 'create' && (now.type === 'line' || now.type === 'arrow' ? Math.hypot(b.w, b.h) < 3 : b.w < 3 || b.h < 3);
    if (tiny) {
      setOps(d.snapshot);
      return;
    }
    if (d.mode === 'move' && JSON.stringify(now) === JSON.stringify(d.origin)) return;
    setPast((p) => [...p.slice(-99), d.snapshot]);
    setFuture([]);
    if (d.mode === 'create') {
      setSelected(d.id);
      if (tool !== 'highlight') setTool('select');
    }
  };

  const finishTextEdit = (id: string) => {
    const op = ops.find((o) => o.id === id);
    setEditingText(null);
    const snap = editSnapshot.current ?? ops;
    editSnapshot.current = null;
    if (op && op.type === 'text' && !op.text.trim()) {
      setOps(ops.filter((o) => o.id !== id));
      setSelected(null);
      return;
    }
    if (JSON.stringify(snap) !== JSON.stringify(ops)) {
      setPast((p) => [...p.slice(-99), snap]);
      setFuture([]);
    }
  };

  // ---------- inserções ----------
  const insertImage = async (dataUrl: string, natW: number, natH: number, maxFrac = 0.4) => {
    if (!size) return;
    const [meta, data] = dataUrl.split(',');
    const mime = meta.includes('image/png') ? 'image/png' : 'image/jpeg';
    const w = Math.min(size.w * maxFrac, natW);
    const h = (w * natH) / natW;
    const op: EditOp = { id: uid(), page: pageIdx, type: 'image', x: (size.w - w) / 2, y: (size.h - h) / 2, w, h, data, mime, opacity: 1 };
    commit([...ops, op]);
    setSelected(op.id);
    setTool('select');
  };

  const pickImage = async () => {
    const [f] = await openFiles('image', false);
    if (!f) return;
    try {
      const isPng = /\.png$/i.test(f.name) && f.bytes[0] === 0x89;
      const isJpg = /\.jpe?g$/i.test(f.name) && f.bytes[0] === 0xff;
      const bmp = await createImageBitmap(new Blob([f.bytes]));
      let url: string;
      if (isPng || isJpg) url = `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${bytesToB64(f.bytes)}`;
      else {
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext('2d')!.drawImage(bmp, 0, 0);
        url = c.toDataURL('image/png');
      }
      await insertImage(url, bmp.width, bmp.height);
    } catch (e) {
      actions.toast(`Imagem inválida: ${(e as Error).message}`, 'error');
    }
  };

  // ---------- salvar ----------
  const save = async () => {
    setSaving(true);
    try {
      const [out] = await applyEdits({ name: file.name, bytes: file.bytes, path: file.path, password }, ops);
      const path = await saveFile(out.name, out.bytes);
      setResult({ out, path });
      actions.toast(path ? `PDF editado salvo${/[\\/]/.test(path) ? ` em ${path}` : ''}.` : 'Edição aplicada (não salvo).', 'success');
    } catch (e) {
      actions.toast(e instanceof ToolError ? e.message : `Falha ao aplicar: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- render ----------
  if (needPw) {
    return (
      <div className="page planned-page">
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
          <button className="btn btn-primary">Abrir</button>
        </form>
        {loadError && <p className="err">{loadError}</p>}
      </div>
    );
  }
  if (loadError) return <div className="page"><div className="notice error">{loadError}</div></div>;
  if (!doc || !size) return <div className="page muted">Abrindo {file.name} no editor…</div>;

  const handleSize = 8 / zoom;
  const selBounds = sel && sel.page === pageIdx ? boundsOf(sel) : null;
  const activeHint = TOOLS.find((t) => t.id === tool)?.hint;

  return (
    <div className="editor" ref={rootRef}>
      <EnviarOncoGlobal original={file} documento={doc} obterDerivado={async () => {
        if (!ops.length) return undefined;
        const [out] = await applyEdits({ name: file.name, bytes: file.bytes, path: file.path, password }, ops);
        if (!out) throw new Error('DERIVADO_INDISPONIVEL');
        return { name: out.name, bytes: out.bytes, descricao: 'Edições locais do PDFForge; original preservado separadamente.' };
      }} />
      <div className="ed-toolbar" role="toolbar" aria-label="Ferramentas de edição">
        <div className="ed-group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`ed-tool ${tool === t.id ? 'on' : ''}`}
              aria-label={`${t.label} (${t.key.toUpperCase()})`}
              aria-pressed={tool === t.id}
              title={`${t.label} — tecla ${t.key.toUpperCase()}${t.hint ? `\n${t.hint}` : ''}`}
              onClick={() => setTool(t.id)}
            >
              {t.glyph}
            </button>
          ))}
          <button className="ed-tool" aria-label="Inserir imagem" title="Inserir imagem (PNG/JPG)" onClick={pickImage}>
            🖼
          </button>
          <button className="ed-tool" aria-label="Assinatura" title="Desenhar assinatura e inserir" onClick={() => setSignOpen(true)}>
            ✍
          </button>
        </div>
        <div className="ed-group">
          <button className="ed-tool" aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)" disabled={!past.length} onClick={undo}>
            ↶
          </button>
          <button className="ed-tool" aria-label="Refazer (Ctrl+Y)" title="Refazer (Ctrl+Y)" disabled={!future.length} onClick={redo}>
            ↷
          </button>
          <button className="ed-tool" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
            −
          </button>
          <span className="ed-zoom">{Math.round(zoom * 100)}%</span>
          <button className="ed-tool" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
            +
          </button>
        </div>
        <div className="ed-group ed-right">
          <span className="muted small">
            {ops.length} {ops.length === 1 ? 'edição' : 'edições'}
          </span>
          <button
            className="btn btn-sm btn-ghost"
            disabled={!ops.length}
            onClick={() => {
              commit([]);
              setSelected(null);
            }}
          >
            Limpar tudo
          </button>
          <button className="btn btn-sm btn-primary" disabled={saving || !ops.length} onClick={save}>
            {saving ? 'Aplicando…' : 'Aplicar e salvar'}
          </button>
        </div>
      </div>

      {(activeHint || draftCount > 0 || result) && (
        <div className="ed-banner">
          {activeHint && <span className="ed-warn">⚠ {activeHint}</span>}
          {draftCount > 0 && (
            <span>
              Rascunho restaurado ({draftCount} {draftCount === 1 ? 'edição' : 'edições'}).{' '}
              <button className="link" onClick={() => setDraftCount(0)}>
                ok
              </button>
            </span>
          )}
          {result && (
            <span>
              Resultado: <strong>{result.out.name}</strong>{' '}
              <button className="link" onClick={() => actions.openViewer({ name: result.out.name, bytes: result.out.bytes, path: result.path && /[\\/]/.test(result.path) ? result.path : null })}>
                Abrir no visualizador
              </button>{' '}
              <button className="link" onClick={() => setResult(null)}>
                fechar
              </button>
            </span>
          )}
        </div>
      )}

      <div className="ed-body">
        <aside className="ed-thumbs" aria-label="Páginas">
          {sizes.map((_, i) => {
            const n = ops.filter((o) => o.page === i).length;
            return (
              <button key={i} className={`ed-thumb ${i === pageIdx ? 'on' : ''}`} onClick={() => setPageIdx(i)} aria-label={`Página ${i + 1}`}>
                {thumbs[i] ? <img src={thumbs[i]} alt="" /> : <span className="ed-thumb-ph" />}
                <span>
                  {i + 1}
                  {n > 0 && <em className="ed-count">{n}</em>}
                </span>
              </button>
            );
          })}
        </aside>

        <div className="ed-stage">
          <div className="ed-pagebar">
            <button className="ed-tool" aria-label="Página anterior" disabled={pageIdx === 0} onClick={() => setPageIdx((i) => i - 1)}>
              ‹
            </button>
            <span className="muted small">
              Página {pageIdx + 1} de {sizes.length}
            </span>
            <button className="ed-tool" aria-label="Próxima página" disabled={pageIdx >= sizes.length - 1} onClick={() => setPageIdx((i) => i + 1)}>
              ›
            </button>
          </div>
          <div className="ed-canvas-wrap" style={{ width: size.w * zoom, height: size.h * zoom }}>
            <PageBitmap doc={doc} pageNo={pageIdx + 1} zoom={zoom} size={size} />
            <svg
              ref={svgRef}
              className={`ed-overlay tool-${tool}`}
              width={size.w * zoom}
              height={size.h * zoom}
              viewBox={`0 0 ${size.w} ${size.h}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {pageOps.map((op) => (
                <OpShape
                  key={op.id}
                  op={op}
                  editing={editingText === op.id}
                  registerText={(el) => (el ? textEls.current.set(op.id, el) : textEls.current.delete(op.id))}
                  onText={(text) => setOps((cur) => cur.map((o) => (o.id === op.id && o.type === 'text' ? { ...o, text } : o)))}
                  onDoneText={() => finishTextEdit(op.id)}
                  onEditText={() => {
                    setSelected(op.id);
                    setEditingText(op.id);
                    editSnapshot.current = ops;
                  }}
                />
              ))}
              {selBounds && sel && (
                <g className="ed-selection">
                  <rect x={selBounds.x - 2 / zoom} y={selBounds.y - 2 / zoom} width={selBounds.w + 4 / zoom} height={selBounds.h + 4 / zoom} strokeWidth={1 / zoom} />
                  {(sel.type === 'line' || sel.type === 'arrow'
                    ? [
                        ['p1', sel.x1, sel.y1],
                        ['p2', sel.x2, sel.y2],
                      ]
                    : sel.type === 'note'
                      ? []
                      : [
                          ['nw', selBounds.x, selBounds.y],
                          ['ne', selBounds.x + selBounds.w, selBounds.y],
                          ['sw', selBounds.x, selBounds.y + selBounds.h],
                          ['se', selBounds.x + selBounds.w, selBounds.y + selBounds.h],
                        ]
                  ).map(([h, x, y]) => (
                    <rect
                      key={h as string}
                      data-handle={h as string}
                      className={`ed-handle h-${h}`}
                      x={(x as number) - handleSize / 2}
                      y={(y as number) - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      strokeWidth={1 / zoom}
                    />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>

        <aside className="ed-props" aria-label="Propriedades">
          {sel ? (
            <SelectedProps
              op={sel}
              onChange={(patch, key) => updateOp(sel.id, patch, key)}
              onDuplicate={duplicateSelected}
              onDelete={removeSelected}
              onForward={() => reorder(sel.id, 1)}
              onBackward={() => reorder(sel.id, -1)}
            />
          ) : (
            <DefaultProps style={style} onChange={(s) => setStyle((cur) => ({ ...cur, ...s }))} />
          )}
          <section className="ed-layers">
            <h3>Camadas — página {pageIdx + 1}</h3>
            {pageOps.length === 0 && <p className="muted small">Nenhuma edição nesta página.</p>}
            <ol>
              {[...pageOps].reverse().map((op) => (
                <li key={op.id}>
                  <button className={`ed-layer ${op.id === selected ? 'on' : ''}`} onClick={() => setSelected(op.id)}>
                    <span className="ed-layer-type">{TYPE_LABEL[op.type]}</span>
                    <span className="muted small ed-layer-txt">{op.type === 'text' || op.type === 'note' ? op.text.slice(0, 28) : ''}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {signOpen && (
        <SignatureModal
          onClose={() => setSignOpen(false)}
          onInsert={async (url, w, h) => {
            setSignOpen(false);
            await insertImage(url, w, h, 0.3);
          }}
        />
      )}
    </div>
  );
}

// ---------- página renderizada ----------

function PageBitmap({ doc, pageNo, zoom, size }: { doc: PDFDocumentProxy; pageNo: number; zoom: number; size: { w: number; h: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const dpr = window.devicePixelRatio || 1;
    renderPage(doc, pageNo, zoom * dpr)
      .then((src) => {
        const c = ref.current;
        if (!alive || !c) return;
        c.width = src.width;
        c.height = src.height;
        c.getContext('2d')!.drawImage(src, 0, 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [doc, pageNo, zoom]);
  return <canvas ref={ref} className="ed-page" style={{ width: size.w * zoom, height: size.h * zoom }} aria-label={`Página ${pageNo}`} />;
}

// ---------- operações desenhadas em SVG (mesma ordem da aplicação no PDF) ----------

function arrowHead(x1: number, y1: number, x2: number, y2: number, sw: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(8, sw * 4);
  return [-0.45, 0.45].map((s) => `${x2},${y2} ${x2 - len * Math.cos(ang + s)},${y2 - len * Math.sin(ang + s)}`);
}

function OpShape({
  op,
  editing,
  registerText,
  onText,
  onDoneText,
  onEditText,
}: {
  op: EditOp;
  editing: boolean;
  registerText(el: HTMLDivElement | null): void;
  onText(text: string): void;
  onDoneText(): void;
  onEditText(): void;
}) {
  const opacity = op.opacity ?? 1;
  switch (op.type) {
    case 'rect':
      return <rect data-id={op.id} x={op.x} y={op.y} width={op.w} height={op.h} fill={op.fill ?? 'transparent'} stroke={op.stroke ?? 'none'} strokeWidth={op.stroke ? op.strokeWidth : 0} opacity={opacity} />;
    case 'ellipse':
      return (
        <ellipse data-id={op.id} cx={op.x + op.w / 2} cy={op.y + op.h / 2} rx={op.w / 2} ry={op.h / 2} fill={op.fill ?? 'transparent'} stroke={op.stroke ?? 'none'} strokeWidth={op.stroke ? op.strokeWidth : 0} opacity={opacity} />
      );
    case 'highlight':
      return <rect data-id={op.id} className="ed-hl" x={op.x} y={op.y} width={op.w} height={op.h} fill={op.fill ?? '#FFE600'} opacity={op.opacity ?? 0.35} />;
    case 'whiteout':
      return <rect data-id={op.id} className="ed-wo" x={op.x} y={op.y} width={op.w} height={op.h} fill="#FFFFFF" />;
    case 'line':
    case 'arrow':
      return (
        <g data-id={op.id} opacity={opacity}>
          <line x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke="transparent" strokeWidth={Math.max(10, op.strokeWidth + 8)} />
          <line x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.stroke} strokeWidth={op.strokeWidth} strokeLinecap="round" />
          {op.type === 'arrow' && arrowHead(op.x1, op.y1, op.x2, op.y2, op.strokeWidth).map((pts) => <polyline key={pts} points={pts} stroke={op.stroke} strokeWidth={op.strokeWidth} strokeLinecap="round" fill="none" />)}
        </g>
      );
    case 'ink': {
      const pts = op.points.reduce<string[]>((acc, v, i) => (i % 2 === 0 ? [...acc, `${v}`] : [...acc.slice(0, -1), `${acc[acc.length - 1]},${v}`]), []).join(' ');
      return (
        <g data-id={op.id} opacity={opacity}>
          <polyline points={pts} stroke="transparent" strokeWidth={Math.max(10, op.strokeWidth + 8)} fill="none" />
          <polyline points={pts} stroke={op.stroke} strokeWidth={op.strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      );
    }
    case 'image':
      return <image data-id={op.id} href={`data:${op.mime};base64,${op.data}`} x={op.x} y={op.y} width={op.w} height={op.h} preserveAspectRatio="none" opacity={opacity} />;
    case 'note':
      return (
        <g data-id={op.id} className="ed-note">
          <title>{op.text || 'Nota vazia'}</title>
          <rect x={op.x} y={op.y} width={NOTE_SIZE} height={NOTE_SIZE} rx={3} fill={op.color} stroke="#7a5a00" strokeWidth={0.8} />
          <text x={op.x + NOTE_SIZE / 2} y={op.y + NOTE_SIZE * 0.68} fontSize={NOTE_SIZE * 0.6} textAnchor="middle" fill="#3b2a00">
            ✎
          </text>
        </g>
      );
    case 'text': {
      const css = {
        fontFamily: FONT_CSS[op.font],
        fontWeight: op.bold ? 700 : 400,
        fontSize: op.size,
        lineHeight: LINE_HEIGHT,
        color: op.color,
        textAlign: op.align,
        opacity,
        width: op.w,
      } as const;
      return (
        <foreignObject x={op.x} y={op.y} width={op.w + 2} height={Math.max(op.h, op.size * LINE_HEIGHT) + 2} data-id={op.id}>
          {editing ? (
            <textarea
              className="ed-text-input"
              autoFocus
              value={op.text}
              style={{ ...css, height: Math.max(op.h, op.size * LINE_HEIGHT) }}
              onChange={(e) => onText(e.target.value)}
              onBlur={onDoneText}
              aria-label="Editar texto"
              placeholder="Digite…"
            />
          ) : (
            <div ref={registerText} data-id={op.id} className="ed-text" style={css} onDoubleClick={onEditText}>
              {op.text || ' '}
            </div>
          )}
        </foreignObject>
      );
    }
  }
}

// ---------- painéis de propriedades ----------

function ColorField({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange(v: number): void }) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} />
    </label>
  );
}

function OpacityField({ value, onChange }: { value: number; onChange(v: number): void }) {
  return (
    <label className="ed-field">
      <span>Opacidade</span>
      <input type="range" min={0.1} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{Math.round(value * 100)}%</output>
    </label>
  );
}

function TextStyleFields({
  v,
  onChange,
}: {
  v: { font: FontFamily; bold: boolean; size: number; color: string; align: 'left' | 'center' | 'right' };
  onChange(p: Partial<{ font: FontFamily; bold: boolean; size: number; color: string; align: 'left' | 'center' | 'right' }>, key?: string): void;
}) {
  return (
    <>
      <label className="ed-field">
        <span>Fonte</span>
        <select value={v.font} onChange={(e) => onChange({ font: e.target.value as FontFamily })}>
          <option value="Helvetica">Helvetica</option>
          <option value="Times">Times</option>
          <option value="Courier">Courier</option>
        </select>
      </label>
      <NumberField label="Tamanho (pt)" value={v.size} min={4} max={200} onChange={(size) => onChange({ size }, 'size')} />
      <ColorField label="Cor" value={v.color} onChange={(color) => onChange({ color }, 'color')} />
      <div className="ed-field">
        <span>Estilo</span>
        <div className="segmented">
          <button className={v.bold ? 'on' : ''} aria-pressed={v.bold} onClick={() => onChange({ bold: !v.bold })}>
            <strong>N</strong>
          </button>
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={v.align === a ? 'on' : ''} aria-label={`Alinhar ${a === 'left' ? 'à esquerda' : a === 'center' ? 'ao centro' : 'à direita'}`} onClick={() => onChange({ align: a })}>
              {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function DefaultProps({ style, onChange }: { style: Style; onChange(s: Partial<Style>): void }) {
  return (
    <section>
      <h3>Estilo para novos itens</h3>
      <TextStyleFields v={style} onChange={(p) => onChange(p)} />
      <ColorField label="Traço" value={style.stroke} onChange={(stroke) => onChange({ stroke })} />
      <label className="ed-field">
        <span>Preenchimento</span>
        <input type="checkbox" checked={style.fill !== null} onChange={(e) => onChange({ fill: e.target.checked ? '#FFFFFF' : null })} aria-label="Usar preenchimento" />
        {style.fill !== null && <input type="color" value={style.fill} onChange={(e) => onChange({ fill: e.target.value })} aria-label="Cor de preenchimento" />}
      </label>
      <NumberField label="Espessura" value={style.strokeWidth} min={0.5} max={30} step={0.5} onChange={(strokeWidth) => onChange({ strokeWidth })} />
      <OpacityField value={style.opacity} onChange={(opacity) => onChange({ opacity })} />
      <p className="muted small">Atalhos: V seleção · T texto · R retângulo · O elipse · L linha · A seta · P caneta · H marca-texto · W corretor · N nota · Ctrl+Z/Y · Del · Ctrl+D · setas movem.</p>
    </section>
  );
}

function SelectedProps({
  op,
  onChange,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
}: {
  op: EditOp;
  onChange(patch: Partial<EditOp>, key?: string): void;
  onDuplicate(): void;
  onDelete(): void;
  onForward(): void;
  onBackward(): void;
}) {
  return (
    <section>
      <h3>{TYPE_LABEL[op.type]}</h3>
      {op.type === 'text' && <TextStyleFields v={op} onChange={(p, key) => onChange(p as Partial<EditOp>, key)} />}
      {op.type === 'whiteout' && <p className="ed-warn small">Cobre visualmente; o conteúdo original continua no PDF e pode ser copiado. Para remoção real, use uma tarja segura.</p>}
      {(op.type === 'rect' || op.type === 'ellipse') && (
        <>
          <label className="ed-field">
            <span>Traço</span>
            <input type="checkbox" checked={op.stroke !== null} onChange={(e) => onChange({ stroke: e.target.checked ? '#E5322D' : null })} aria-label="Usar traço" />
            {op.stroke !== null && <input type="color" value={op.stroke} onChange={(e) => onChange({ stroke: e.target.value }, 'stroke')} aria-label="Cor do traço" />}
          </label>
          <label className="ed-field">
            <span>Preenchimento</span>
            <input type="checkbox" checked={op.fill !== null} onChange={(e) => onChange({ fill: e.target.checked ? '#FFFFFF' : null })} aria-label="Usar preenchimento" />
            {op.fill !== null && <input type="color" value={op.fill} onChange={(e) => onChange({ fill: e.target.value }, 'fill')} aria-label="Cor de preenchimento" />}
          </label>
          <NumberField label="Espessura" value={op.strokeWidth} min={0.5} max={30} step={0.5} onChange={(strokeWidth) => onChange({ strokeWidth }, 'sw')} />
        </>
      )}
      {op.type === 'highlight' && <ColorField label="Cor" value={op.fill ?? '#FFE600'} onChange={(fill) => onChange({ fill }, 'fill')} />}
      {(op.type === 'line' || op.type === 'arrow' || op.type === 'ink') && (
        <>
          <ColorField label="Cor" value={op.stroke} onChange={(stroke) => onChange({ stroke }, 'stroke')} />
          <NumberField label="Espessura" value={op.strokeWidth} min={0.5} max={30} step={0.5} onChange={(strokeWidth) => onChange({ strokeWidth }, 'sw')} />
        </>
      )}
      {op.type === 'note' && (
        <>
          <label className="ed-field col">
            <span>Comentário</span>
            <textarea rows={5} autoFocus={!op.text} value={op.text} onChange={(e) => onChange({ text: e.target.value }, 'text')} placeholder="Texto da nota" />
          </label>
          <ColorField label="Cor" value={op.color} onChange={(color) => onChange({ color }, 'color')} />
          <p className="muted small">Vira um comentário nativo do PDF (ícone clicável nos leitores).</p>
        </>
      )}
      {op.type !== 'whiteout' && op.type !== 'note' && <OpacityField value={op.opacity ?? (op.type === 'highlight' ? 0.35 : 1)} onChange={(opacity) => onChange({ opacity }, 'opacity')} />}
      <div className="ed-actions">
        <button className="btn btn-sm" onClick={onDuplicate} aria-label="Duplicar (Ctrl+D)">
          Duplicar
        </button>
        <button className="btn btn-sm" onClick={onForward} aria-label="Trazer para frente">
          Frente
        </button>
        <button className="btn btn-sm" onClick={onBackward} aria-label="Enviar para trás">
          Trás
        </button>
        <button className="btn btn-sm ed-del" onClick={onDelete} aria-label="Excluir (Delete)">
          Excluir
        </button>
      </div>
    </section>
  );
}

// ---------- assinatura ----------

function SignatureModal({ onClose, onInsert }: { onClose(): void; onInsert(url: string, w: number, h: number): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [color, setColor] = useState('#0B2A6B');

  const pos = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / r.width, y: ((e.clientY - r.top) * e.currentTarget.height) / r.height };
  };

  const insert = () => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    // recorta a área desenhada (com margem) para não inserir um retângulo vazio enorme
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
    const pad = 8;
    const w = Math.min(width, maxX + pad) - Math.max(0, minX - pad);
    const h = Math.min(height, maxY + pad) - Math.max(0, minY - pad);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(c, Math.max(0, minX - pad), Math.max(0, minY - pad), w, h, 0, 0, w, h);
    onInsert(out.toDataURL('image/png'), w, h);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ed-sign" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Desenhar assinatura">
        <h2>Assinatura</h2>
        <p className="muted small">Desenhe com o mouse ou caneta. Assinatura desenhada não é assinatura digital certificada.</p>
        <canvas
          ref={ref}
          width={720}
          height={240}
          className="ed-sign-canvas"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const ctx = e.currentTarget.getContext('2d')!;
            const p = pos(e);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext('2d')!;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            setEmpty(false);
          }}
          onPointerUp={() => (drawing.current = false)}
        />
        <div className="row">
          <label className="ed-field">
            <span>Cor</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              const c = ref.current!;
              c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
              setEmpty(true);
            }}
          >
            Limpar
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-sm btn-primary" disabled={empty} onClick={insert}>
            Inserir
          </button>
        </div>
      </div>
    </div>
  );
}
