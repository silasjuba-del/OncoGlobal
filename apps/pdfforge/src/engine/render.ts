// Operações que precisam de DOM/canvas: renderização via pdf.js, rasterização, OCR e texto.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFDocument } from '@cantoo/pdf-lib';
import { ImageInput, outName } from './ops';
import { pagesToMarkdown, type TextRun } from './markdown';
import { InputFile, OutputFile, PDF_MIME, RunContext, ToolError } from './types';

// Worker criado na inicialização e compartilhado por todos os documentos. Carregá-lo sob demanda
// fazia a 1ª abertura de PDF falhar se o servidor de desenvolvimento já tivesse parado.
let workerFailed = false;
if (typeof Worker !== 'undefined') {
  const worker = new Worker(workerUrl, { type: 'module' });
  worker.addEventListener('error', () => {
    workerFailed = true;
  });
  pdfjs.GlobalWorkerOptions.workerPort = worker;
} else {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

const WORKER_ERROR =
  'O motor de PDF não carregou. Se estiver usando "npm run dev", o servidor Vite parou: reinicie-o e recarregue a página (Ctrl+R).';

export async function openPdfjs(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  // pdf.js transfere (desanexa) o buffer recebido; sempre passe uma cópia.
  try {
    return await pdfjs.getDocument({ data: bytes.slice(), password }).promise;
  } catch (err) {
    if ((err as { name?: string }).name === 'PasswordException') {
      throw new ToolError(password ? 'Senha incorreta.' : 'Este PDF está protegido por senha.');
    }
    if (workerFailed || /worker/i.test(String((err as Error).message))) throw new ToolError(WORKER_ERROR);
    throw new ToolError(`PDF inválido: ${(err as Error).message}`);
  }
}

export async function renderPage(doc: PDFDocumentProxy, pageNo: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // intent 'print' evita requestAnimationFrame: a renderização não congela com a janela minimizada.
  await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
  page.cleanup();
  return canvas;
}

/** Miniatura da primeira página (ou de uma imagem) como data URL JPEG. */
export async function thumbnail(file: { name: string; bytes: Uint8Array; password?: string }, maxWidth = 180): Promise<string | null> {
  try {
    if (isImageName(file.name)) {
      const bmp = await createImageBitmap(new Blob([file.bytes]));
      const scale = Math.min(1, maxWidth / bmp.width);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * scale));
      c.height = Math.max(1, Math.round(bmp.height * scale));
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.75);
    }
    const doc = await openPdfjs(file.bytes, file.password);
    const page = await doc.getPage(1);
    const scale = maxWidth / page.getViewport({ scale: 1 }).width;
    const canvas = await renderPage(doc, 1, scale);
    const url = canvas.toDataURL('image/jpeg', 0.75);
    await doc.destroy();
    return url;
  } catch {
    return null;
  }
}

export interface PdfProbe {
  locked: boolean;
  pages: number;
  thumb: string | null;
}

/** Abre o PDF para descobrir nº de páginas, miniatura e se exige senha. */
export async function probePdf(bytes: Uint8Array, password?: string, maxWidth = 180): Promise<PdfProbe> {
  let doc: PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: bytes.slice(), password }).promise;
  } catch (err) {
    if ((err as { name?: string }).name === 'PasswordException') return { locked: true, pages: 0, thumb: null };
    if (workerFailed || /worker/i.test(String((err as Error).message))) throw new ToolError(WORKER_ERROR);
    return { locked: false, pages: 0, thumb: null };
  }
  try {
    const page = await doc.getPage(1);
    const scale = maxWidth / page.getViewport({ scale: 1 }).width;
    const thumb = (await renderPage(doc, 1, scale)).toDataURL('image/jpeg', 0.75);
    return { locked: false, pages: doc.numPages, thumb };
  } finally {
    await doc.destroy();
  }
}

export async function pageThumbnails(bytes: Uint8Array, maxWidth: number, password?: string): Promise<string[]> {
  const doc = await openPdfjs(bytes, password);
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const scale = maxWidth / page.getViewport({ scale: 1 }).width;
    out.push((await renderPage(doc, i, scale)).toDataURL('image/jpeg', 0.7));
  }
  await doc.destroy();
  return out;
}

const canvasToBytes = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      async (blob) => (blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('Falha ao gerar imagem'))),
      type,
      quality,
    ),
  );

export interface PdfToImageOptions {
  dpi: number;
  quality: number;
  format: 'jpg' | 'png';
}

export async function pdfToImages(input: InputFile, o: PdfToImageOptions, ctx: RunContext): Promise<OutputFile[]> {
  const doc = await openPdfjs(input.bytes, input.password);
  const out: OutputFile[] = [];
  const mime = o.format === 'png' ? 'image/png' : 'image/jpeg';
  for (let i = 1; i <= doc.numPages; i++) {
    ctx.progress((i - 1) / doc.numPages, `${input.name}: página ${i}/${doc.numPages}`);
    const canvas = await renderPage(doc, i, o.dpi / 72);
    const bytes = await canvasToBytes(canvas, mime, o.quality);
    const pad = String(i).padStart(String(doc.numPages).length, '0');
    out.push({ name: outName(input.name, `pagina-${pad}`, o.format), bytes, mime });
  }
  await doc.destroy();
  return out;
}

/** Compressão com perdas: rasteriza cada página como JPEG. Mantém o original se não reduzir. */
export async function rasterCompress(input: InputFile, dpi: number, quality: number, ctx: RunContext): Promise<OutputFile[]> {
  const doc = await openPdfjs(input.bytes, input.password);
  const dst = await PDFDocument.create();
  for (let i = 1; i <= doc.numPages; i++) {
    ctx.progress((i - 1) / doc.numPages, `${input.name}: página ${i}/${doc.numPages}`);
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const canvas = await renderPage(doc, i, dpi / 72);
    const jpg = await dst.embedJpg(await canvasToBytes(canvas, 'image/jpeg', quality));
    dst.addPage([vp.width, vp.height]).drawImage(jpg, { x: 0, y: 0, width: vp.width, height: vp.height });
  }
  await doc.destroy();
  const bytes = await dst.save({ useObjectStreams: true });
  const best = bytes.length < input.bytes.length ? bytes : input.bytes;
  return [{ name: outName(input.name, 'compressed'), bytes: best, mime: PDF_MIME }];
}

/** Normaliza imagens para JPG/PNG (formatos que pdf-lib incorpora). */
export async function normalizeImage(file: InputFile): Promise<ImageInput> {
  const lower = file.name.toLowerCase();
  if (/\.(jpe?g)$/.test(lower) && isJpeg(file.bytes)) return { name: file.name, bytes: file.bytes, type: 'jpg' };
  if (/\.png$/.test(lower) && isPng(file.bytes)) return { name: file.name, bytes: file.bytes, type: 'png' };
  const bmp = await createImageBitmap(new Blob([file.bytes]));
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  return { name: file.name, bytes: await canvasToBytes(c, 'image/png'), type: 'png' };
}

export async function extractPageTexts(bytes: Uint8Array, password?: string): Promise<string[]> {
  const doc = await openPdfjs(bytes, password);
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(
      tc.items
        .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : ''))
        .join('')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    );
  }
  await doc.destroy();
  return pages;
}

export interface OcrOptions {
  lang: string;
  dpi: number;
}

/** OCR: rasteriza cada página e gera PDF pesquisável (imagem + camada de texto) via tesseract.js. */
export async function ocrPdf(input: InputFile, o: OcrOptions, ctx: RunContext): Promise<OutputFile[]> {
  const { createWorker } = await import('tesseract.js');
  ctx.progress(0, 'Carregando modelo de OCR (requer internet na 1ª vez)…');
  const worker = await createWorker(o.lang);
  try {
    const doc = await openPdfjs(input.bytes, input.password);
    const dst = await PDFDocument.create();
    for (let i = 1; i <= doc.numPages; i++) {
      ctx.progress((i - 1) / doc.numPages, `${input.name}: reconhecendo página ${i}/${doc.numPages}`);
      const canvas = await renderPage(doc, i, o.dpi / 72);
      const res = await worker.recognize(canvas, {}, { pdf: true, text: false, blocks: false });
      const pagePdf = res.data.pdf;
      if (!pagePdf) throw new ToolError('O motor de OCR não devolveu PDF.');
      const src = await PDFDocument.load(new Uint8Array(pagePdf));
      const [copied] = await dst.copyPages(src, [0]);
      // Restaura o tamanho original da página (o PDF do OCR usa a resolução da imagem).
      const vp = (await doc.getPage(i)).getViewport({ scale: 1 });
      const { width, height } = copied.getSize();
      copied.scaleContent(vp.width / width, vp.height / height);
      copied.setSize(vp.width, vp.height);
      dst.addPage(copied);
    }
    await doc.destroy();
    return [{ name: outName(input.name, 'ocr'), bytes: await dst.save(), mime: PDF_MIME }];
  } finally {
    await worker.terminate();
  }
}

export function isImageName(name: string) {
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(name);
}

function isJpeg(b: Uint8Array) {
  return b[0] === 0xff && b[1] === 0xd8;
}

function isPng(b: Uint8Array) {
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

/** Trechos de texto com posição e tamanho de fonte, por página (para PDF → Markdown). */
export async function extractRuns(bytes: Uint8Array, password?: string): Promise<TextRun[][]> {
  const doc = await openPdfjs(bytes, password);
  const pages: TextRun[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(
      tc.items.flatMap((it) =>
        'str' in it && it.str
          ? [{ str: it.str, x: it.transform[4], y: it.transform[5], size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10 }]
          : [],
      ),
    );
  }
  await doc.destroy();
  return pages;
}

export async function pdfToMarkdown(input: InputFile): Promise<OutputFile[]> {
  const pages = await extractRuns(input.bytes, input.password);
  if (pages.every((p) => p.length === 0)) throw new ToolError(`"${input.name}" não tem texto extraível. Rode OCR PDF antes.`);
  const md = pagesToMarkdown(pages, input.name.replace(/\.pdf$/i, ''));
  return [{ name: outName(input.name, '', 'md'), bytes: new TextEncoder().encode(md), mime: 'text/markdown' }];
}
