// Operações PDF puras (sem DOM) sobre pdf-lib. Testáveis em Node.
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
  EncryptedPDFError,
} from '@cantoo/pdf-lib';
import { parsePageList, parseRangeGroups } from './ranges';
import { InputFile, OutputFile, PDF_MIME, RunContext, ToolError, noopContext } from './types';

export const MM = 72 / 25.4;

export function baseName(name: string): string {
  return name.replace(/\.[^.\\/]+$/, '');
}

export function outName(source: string, suffix: string, ext = 'pdf'): string {
  const base = baseName(source);
  return suffix ? `${base}_${suffix}.${ext}` : `${base}.${ext}`;
}

const pdfOut = (name: string, bytes: Uint8Array): OutputFile => ({ name, bytes, mime: PDF_MIME });

/** Abre um PDF; tenta senha vazia (só senha de proprietário) antes de exigir senha do usuário. */
export async function loadPdf(input: InputFile): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(input.bytes, { password: input.password });
  } catch (err) {
    if (!(err instanceof EncryptedPDFError) && !/encrypt|password/i.test(String(err))) {
      throw new ToolError(`"${input.name}" não pôde ser lido como PDF (${(err as Error).message}).`);
    }
    if (input.password === undefined) {
      try {
        return await PDFDocument.load(input.bytes, { password: '' });
      } catch {
        /* exige senha do usuário */
      }
    }
    throw new ToolError(
      input.password
        ? `Senha incorreta para "${input.name}".`
        : `"${input.name}" está protegido por senha. Informe a senha no cartão do arquivo.`,
    );
  }
}

/** Copia páginas para um documento novo (descarta criptografia e objetos órfãos). */
async function rebuild(src: PDFDocument, indices = src.getPageIndices()): Promise<PDFDocument> {
  const dst = await PDFDocument.create();
  const pages = await dst.copyPages(src, indices);
  pages.forEach((p) => dst.addPage(p));
  return dst;
}

// ---------- Organizar ----------

export async function mergePdfs(inputs: InputFile[], ctx: RunContext = noopContext): Promise<OutputFile[]> {
  if (inputs.length < 2) throw new ToolError('Selecione pelo menos dois PDFs para juntar.');
  const dst = await PDFDocument.create();
  for (const [i, input] of inputs.entries()) {
    ctx.progress(i / inputs.length, `Juntando ${input.name}`);
    const src = await loadPdf(input);
    (await dst.copyPages(src, src.getPageIndices())).forEach((p) => dst.addPage(p));
  }
  return [pdfOut(outName(inputs[0].name, 'merged'), await dst.save())];
}

export type SplitMode = 'ranges' | 'every' | 'extract-each' | 'extract-one';

export interface SplitOptions {
  mode: SplitMode;
  ranges?: string;
  every?: number;
}

export async function splitPdf(input: InputFile, opts: SplitOptions): Promise<OutputFile[]> {
  const src = await loadPdf(input);
  const total = src.getPageCount();
  let groups: number[][];
  switch (opts.mode) {
    case 'ranges':
      groups = parseRangeGroups(opts.ranges ?? '', total);
      break;
    case 'every': {
      const n = Math.max(1, Math.floor(opts.every ?? 1));
      groups = [];
      for (let i = 0; i < total; i += n) groups.push(range(i, Math.min(i + n, total)));
      break;
    }
    case 'extract-each':
      groups = (opts.ranges?.trim() ? parsePageList(opts.ranges, total) : range(0, total)).map((i) => [i]);
      break;
    case 'extract-one':
      groups = [parsePageList(opts.ranges ?? '', total)];
      break;
  }
  const out: OutputFile[] = [];
  for (const g of groups) {
    const doc = await rebuild(src, g);
    const label = g.length === 1 ? `${g[0] + 1}` : `${g[0] + 1}-${g[g.length - 1] + 1}`;
    out.push(pdfOut(outName(input.name, `p${label}`), await doc.save()));
  }
  return out;
}

export async function removePages(input: InputFile, spec: string): Promise<OutputFile[]> {
  const src = await loadPdf(input);
  const remove = new Set(parsePageList(spec, src.getPageCount()));
  const keep = src.getPageIndices().filter((i) => !remove.has(i));
  if (keep.length === 0) throw new ToolError('Não é possível remover todas as páginas.');
  return [pdfOut(outName(input.name, 'removed'), await (await rebuild(src, keep)).save())];
}

export interface PagePlanItem {
  /** índice 0-based na origem, ou -1 para página em branco */
  index: number;
  /** rotação adicional em graus (múltiplo de 90) */
  rotate: number;
}

export async function organizePdf(input: InputFile, plan: PagePlanItem[]): Promise<OutputFile[]> {
  if (plan.length === 0) throw new ToolError('O documento ficaria sem páginas.');
  const src = await loadPdf(input);
  const dst = await PDFDocument.create();
  const copied = await dst.copyPages(src, plan.filter((p) => p.index >= 0).map((p) => p.index));
  let c = 0;
  for (const item of plan) {
    if (item.index < 0) {
      const ref = src.getPage(0).getSize();
      dst.addPage([ref.width, ref.height]);
      continue;
    }
    const page = dst.addPage(copied[c++]);
    if (item.rotate) page.setRotation(degrees(norm(page.getRotation().angle + item.rotate)));
  }
  return [pdfOut(outName(input.name, 'organized'), await dst.save())];
}

// ---------- Editar ----------

export async function rotatePdf(input: InputFile, angle: number, spec = ''): Promise<OutputFile[]> {
  const doc = await loadPdf(input);
  const pages = selectPages(doc, spec);
  pages.forEach((p) => p.setRotation(degrees(norm(p.getRotation().angle + angle))));
  return [pdfOut(outName(input.name, 'rotated'), await doc.save())];
}

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number;
  /** ângulo visual em graus, sentido anti-horário */
  angle: number;
  color: string;
  layout: 'center' | 'tile';
  pages?: string;
}

export async function watermarkPdf(input: InputFile, o: WatermarkOptions): Promise<OutputFile[]> {
  if (!o.text.trim()) throw new ToolError('Digite o texto da marca d’água.');
  const doc = await loadPdf(input);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = safeText(font, o.text);
  const color = hexToRgb(o.color);
  for (const page of selectPages(doc, o.pages ?? '')) {
    const f = frame(page);
    const w = font.widthOfTextAtSize(text, o.fontSize);
    const h = o.fontSize * 0.7;
    const centers: [number, number][] = [];
    if (o.layout === 'tile') {
      const stepX = w + o.fontSize * 3;
      const stepY = o.fontSize * 5;
      for (let y = stepY / 2; y < f.vh + stepY; y += stepY)
        for (let x = (y / stepY) % 2 ? 0 : stepX / 2; x < f.vw + stepX; x += stepX) centers.push([x, y]);
    } else centers.push([f.vw / 2, f.vh / 2]);
    for (const [cx, cy] of centers) {
      const t = (o.angle * Math.PI) / 180;
      const vx = cx - ((w / 2) * Math.cos(t) - (h / 2) * Math.sin(t));
      const vy = cy - ((w / 2) * Math.sin(t) + (h / 2) * Math.cos(t));
      drawVisualText(page, f, text, vx, vy, o.angle, { font, size: o.fontSize, color, opacity: o.opacity });
    }
  }
  return [pdfOut(outName(input.name, 'watermark'), await doc.save())];
}

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';

export interface PageNumberOptions {
  position: NumberPosition;
  start: number;
  format: 'n' | 'page-n' | 'n-of-total';
  fontSize: number;
  margin: number;
  pages?: string;
}

export async function pageNumbersPdf(input: InputFile, o: PageNumberOptions): Promise<OutputFile[]> {
  const doc = await loadPdf(input);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const all = doc.getPages();
  const targets = new Set(selectPages(doc, o.pages ?? ''));
  const total = targets.size;
  let n = o.start;
  for (const page of all) {
    if (!targets.has(page)) continue;
    const label =
      o.format === 'page-n' ? `Página ${n}` : o.format === 'n-of-total' ? `${n} de ${total + o.start - 1}` : `${n}`;
    n++;
    const f = frame(page);
    const w = font.widthOfTextAtSize(label, o.fontSize);
    const [vert, horiz] = o.position.split('-');
    const vx = horiz === 'left' ? o.margin : horiz === 'right' ? f.vw - o.margin - w : (f.vw - w) / 2;
    const vy = vert === 'top' ? f.vh - o.margin - o.fontSize * 0.7 : o.margin;
    drawVisualText(page, f, label, vx, vy, 0, { font, size: o.fontSize, color: rgb(0.1, 0.1, 0.1), opacity: 1 });
  }
  return [pdfOut(outName(input.name, 'pagenumber'), await doc.save())];
}

export interface CropOptions {
  /** margens visuais em milímetros */
  top: number;
  right: number;
  bottom: number;
  left: number;
  pages?: string;
}

export async function cropPdf(input: InputFile, o: CropOptions): Promise<OutputFile[]> {
  const doc = await loadPdf(input);
  for (const page of selectPages(doc, o.pages ?? '')) {
    const box = page.getCropBox();
    const r = norm(page.getRotation().angle);
    const [t, ri, b, l] = [o.top, o.right, o.bottom, o.left].map((v) => Math.max(0, v) * MM);
    // Margens visuais → margens no espaço do usuário, conforme a rotação da página.
    const u =
      r === 90 ? { left: t, top: ri, right: b, bottom: l }
      : r === 180 ? { bottom: t, left: ri, top: b, right: l }
      : r === 270 ? { right: t, bottom: ri, left: b, top: l }
      : { top: t, right: ri, bottom: b, left: l };
    const width = box.width - u.left - u.right;
    const height = box.height - u.top - u.bottom;
    if (width < 10 || height < 10) throw new ToolError('As margens de corte são maiores que a página.');
    page.setCropBox(box.x + u.left, box.y + u.bottom, width, height);
  }
  return [pdfOut(outName(input.name, 'cropped'), await doc.save())];
}

// ---------- Converter ----------

export interface ImageInput {
  name: string;
  bytes: Uint8Array;
  type: 'jpg' | 'png';
}

export interface ImagesToPdfOptions {
  pageSize: 'fit' | 'A4' | 'Letter';
  orientation: 'auto' | 'portrait' | 'landscape';
  margin: number;
  merge: boolean;
}

const PAGE_SIZES = { A4: [595.28, 841.89], Letter: [612, 792] } as const;

export async function imagesToPdf(images: ImageInput[], o: ImagesToPdfOptions): Promise<OutputFile[]> {
  if (images.length === 0) throw new ToolError('Selecione ao menos uma imagem.');
  const build = async (batch: ImageInput[]) => {
    const doc = await PDFDocument.create();
    for (const img of batch) {
      const embedded = img.type === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
      const landscapeImg = embedded.width > embedded.height;
      let pw: number;
      let ph: number;
      if (o.pageSize === 'fit') {
        pw = embedded.width + o.margin * 2;
        ph = embedded.height + o.margin * 2;
      } else {
        const [a, b] = PAGE_SIZES[o.pageSize];
        const landscape = o.orientation === 'landscape' || (o.orientation === 'auto' && landscapeImg);
        [pw, ph] = landscape ? [b, a] : [a, b];
      }
      const page = doc.addPage([pw, ph]);
      const scale = Math.min((pw - o.margin * 2) / embedded.width, (ph - o.margin * 2) / embedded.height, o.pageSize === 'fit' ? 1 : Infinity);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    return doc.save();
  };
  if (o.merge) return [pdfOut(outName(images[0].name, ''), await build(images))];
  return Promise.all(images.map(async (img) => pdfOut(outName(img.name, ''), await build([img]))));
}

// ---------- Otimizar / segurança ----------

export async function compressLossless(input: InputFile): Promise<OutputFile[]> {
  const doc = await loadPdf(input);
  const rebuilt = await rebuild(doc);
  const bytes = await rebuilt.save({ useObjectStreams: true });
  return [pdfOut(outName(input.name, 'compressed'), bytes.length < input.bytes.length ? bytes : input.bytes)];
}

export async function repairPdf(input: InputFile): Promise<OutputFile[]> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(input.bytes, {
      password: input.password,
      throwOnInvalidObject: false,
      warnOnInvalidObjects: false,
      updateMetadata: false,
    });
  } catch (err) {
    throw new ToolError(`Não foi possível recuperar "${input.name}": ${(err as Error).message}`);
  }
  const dst = await PDFDocument.create();
  let lost = 0;
  for (const i of src.getPageIndices()) {
    try {
      const [p] = await dst.copyPages(src, [i]);
      dst.addPage(p);
    } catch {
      lost++;
    }
  }
  if (dst.getPageCount() === 0) throw new ToolError(`Nenhuma página recuperável em "${input.name}".`);
  const name = outName(input.name, lost ? `repaired_${lost}lost` : 'repaired');
  return [pdfOut(name, await dst.save())];
}

export interface ProtectOptions {
  password: string;
  confirm: string;
  allowPrinting: boolean;
  allowCopying: boolean;
}

export async function protectPdf(input: InputFile, o: ProtectOptions): Promise<OutputFile[]> {
  if (o.password.length < 4) throw new ToolError('A senha precisa ter pelo menos 4 caracteres.');
  if (o.password !== o.confirm) throw new ToolError('As senhas não coincidem.');
  const doc = await rebuild(await loadPdf(input));
  doc.encrypt({
    userPassword: o.password,
    ownerPassword: o.password,
    permissions: {
      printing: o.allowPrinting ? 'highResolution' : false,
      copying: o.allowCopying,
      modifying: false,
      annotating: false,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });
  return [pdfOut(outName(input.name, 'protected'), await doc.save())];
}

export async function unlockPdf(input: InputFile): Promise<OutputFile[]> {
  const doc = await rebuild(await loadPdf(input));
  return [pdfOut(outName(input.name, 'unlocked'), await doc.save())];
}

export async function pageCount(input: InputFile): Promise<number> {
  return (await loadPdf(input)).getPageCount();
}

// ---------- utilitários ----------

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i);
}

function norm(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function selectPages(doc: PDFDocument, spec: string): PDFPage[] {
  const pages = doc.getPages();
  if (!spec.trim()) return pages;
  return parsePageList(spec, pages.length).map((i) => pages[i]);
}

interface Frame {
  vw: number;
  vh: number;
  r: number;
  toUser(vx: number, vy: number): { x: number; y: number };
}

/** Sistema de coordenadas "visual" (como a página aparece) para páginas com /Rotate. */
function frame(page: PDFPage): Frame {
  const b = page.getCropBox();
  const r = norm(page.getRotation().angle);
  const swap = r === 90 || r === 270;
  return {
    vw: swap ? b.height : b.width,
    vh: swap ? b.width : b.height,
    r,
    toUser(vx, vy) {
      switch (r) {
        case 90:
          return { x: b.x + b.width - vy, y: b.y + vx };
        case 180:
          return { x: b.x + b.width - vx, y: b.y + b.height - vy };
        case 270:
          return { x: b.x + vy, y: b.y + b.height - vx };
        default:
          return { x: b.x + vx, y: b.y + vy };
      }
    },
  };
}

function drawVisualText(
  page: PDFPage,
  f: Frame,
  text: string,
  vx: number,
  vy: number,
  angle: number,
  style: { font: PDFFont; size: number; color: ReturnType<typeof rgb>; opacity: number },
) {
  const { x, y } = f.toUser(vx, vy);
  page.drawText(text, { x, y, rotate: degrees(angle + f.r), ...style });
}

/** Remove caracteres que a fonte padrão (WinAnsi) não codifica, em vez de falhar. */
function safeText(font: PDFFont, text: string): string {
  return [...text]
    .filter((ch) => {
      try {
        font.encodeText(ch);
        return true;
      } catch {
        return false;
      }
    })
    .join('');
}

export function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return rgb(0.9, 0.2, 0.18);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}
