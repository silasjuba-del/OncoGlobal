// Edição visual de PDF: modelo de operações (coordenadas visuais) e aplicação com pdf-lib. Puro, testável em Node.
// Coordenadas: pontos PDF no espaço VISUAL da página (como aparece, já com /Rotate e CropBox),
// origem no canto superior esquerdo, y para baixo — o mesmo referencial da interface.
import {
  BlendMode,
  LineCapStyle,
  PDFArray,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
} from '@cantoo/pdf-lib';
import { hexToRgb, loadPdf, outName } from './ops';
import { InputFile, OutputFile, PDF_MIME, ToolError } from './types';

export type FontFamily = 'Helvetica' | 'Times' | 'Courier';

interface OpBase {
  id: string;
  /** índice 0-based da página */
  page: number;
  /** 0–1 */
  opacity?: number;
}

export interface TextOp extends OpBase {
  type: 'text';
  x: number;
  y: number;
  /** largura da caixa (quebra de linha automática); 0 = sem quebra */
  w: number;
  h: number;
  text: string;
  font: FontFamily;
  bold: boolean;
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageOp extends OpBase {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  /** base64 sem prefixo data: */
  data: string;
  mime: 'image/png' | 'image/jpeg';
}

export interface BoxOp extends OpBase {
  type: 'rect' | 'ellipse' | 'highlight' | 'whiteout';
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string | null;
  fill: string | null;
  strokeWidth: number;
}

export interface LineOp extends OpBase {
  type: 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface InkOp extends OpBase {
  type: 'ink';
  /** pares x,y achatados: [x0, y0, x1, y1, …] */
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export interface NoteOp extends OpBase {
  type: 'note';
  x: number;
  y: number;
  text: string;
  color: string;
}

export type EditOp = TextOp | ImageOp | BoxOp | LineOp | InkOp | NoteOp;

export const LINE_HEIGHT = 1.2;
export const NOTE_SIZE = 22;

// ---------- geometria ----------

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boundsOf(op: EditOp): Bounds {
  switch (op.type) {
    case 'line':
    case 'arrow':
      return { x: Math.min(op.x1, op.x2), y: Math.min(op.y1, op.y2), w: Math.abs(op.x2 - op.x1), h: Math.abs(op.y2 - op.y1) };
    case 'ink': {
      const xs = op.points.filter((_, i) => i % 2 === 0);
      const ys = op.points.filter((_, i) => i % 2 === 1);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case 'note':
      return { x: op.x, y: op.y, w: NOTE_SIZE, h: NOTE_SIZE };
    default:
      return { x: op.x, y: op.y, w: op.w, h: op.h };
  }
}

/** Desloca a operação (dx, dy) no espaço visual. */
export function translateOp<T extends EditOp>(op: T, dx: number, dy: number): T {
  switch (op.type) {
    case 'line':
    case 'arrow':
      return { ...op, x1: op.x1 + dx, y1: op.y1 + dy, x2: op.x2 + dx, y2: op.y2 + dy };
    case 'ink':
      return { ...op, points: op.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    default:
      return { ...op, x: (op as { x: number }).x + dx, y: (op as { y: number }).y + dy };
  }
}

/** Redimensiona para uma nova caixa (linhas e traços são escalonados proporcionalmente). */
export function resizeOp<T extends EditOp>(op: T, to: Bounds): T {
  const from = boundsOf(op);
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  const mapX = (v: number) => to.x + (v - from.x) * sx;
  const mapY = (v: number) => to.y + (v - from.y) * sy;
  switch (op.type) {
    case 'line':
    case 'arrow':
      return { ...op, x1: mapX(op.x1), y1: mapY(op.y1), x2: mapX(op.x2), y2: mapY(op.y2) };
    case 'ink':
      return { ...op, points: op.points.map((v, i) => (i % 2 === 0 ? mapX(v) : mapY(v))) };
    case 'note':
      return { ...op, x: to.x, y: to.y };
    default:
      return { ...op, x: to.x, y: to.y, w: Math.max(4, to.w), h: Math.max(4, to.h) };
  }
}

// ---------- texto ----------

/** Quebra o texto em linhas que cabem em `width` (0 = só quebras explícitas). Palavras longas são cortadas. */
export function wrapLines(text: string, measure: (s: string) => number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    if (width <= 0 || measure(para) <= width) {
      out.push(para);
      continue;
    }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const candidate = line + word;
      if (measure(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line.trim()) out.push(line.trimEnd());
      line = word.trimStart();
      // palavra maior que a caixa: corta por caracteres
      while (line && measure(line) > width) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

const FONT_KEYS: Record<FontFamily, [StandardFonts, StandardFonts]> = {
  Helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  Times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  Courier: [StandardFonts.Courier, StandardFonts.CourierBold],
};

/** Remove caracteres que a fonte padrão (WinAnsi) não codifica, em vez de falhar. */
export function safeText(font: PDFFont, text: string): string {
  // encodeText troca caracteres desconhecidos por "?" sem erro; o conjunto de caracteres da fonte é a fonte da verdade.
  const charset = new Set(font.getCharacterSet());
  return [...text].filter((ch) => ch === '\n' || charset.has(ch.codePointAt(0)!)).join('');
}

// ---------- referencial visual (mesma matemática de ops.ts/frame) ----------

interface Frame {
  vw: number;
  vh: number;
  r: number;
  /** ponto visual (origem superior esquerda, y para baixo) → espaço do usuário PDF */
  pt(x: number, yTop: number): { x: number; y: number };
}

const norm = (a: number) => ((a % 360) + 360) % 360;

export function pageFrame(page: PDFPage): Frame {
  const b = page.getCropBox();
  const r = norm(page.getRotation().angle);
  const swap = r === 90 || r === 270;
  const vw = swap ? b.height : b.width;
  const vh = swap ? b.width : b.height;
  return {
    vw,
    vh,
    r,
    pt(x, yTop) {
      const vx = x;
      const vy = vh - yTop;
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

const b64ToBytes = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// ---------- aplicação ----------

export async function applyEdits(input: InputFile, ops: EditOp[]): Promise<OutputFile[]> {
  const doc = await loadPdf(input);
  const pages = doc.getPages();
  const fontCache = new Map<string, PDFFont>();
  const fontFor = async (fam: FontFamily, bold: boolean) => {
    const key = FONT_KEYS[fam]?.[bold ? 1 : 0] ?? StandardFonts.Helvetica;
    if (!fontCache.has(key)) fontCache.set(key, await doc.embedFont(key));
    return fontCache.get(key)!;
  };

  for (const op of ops) {
    const page = pages[op.page];
    if (!page) throw new ToolError(`Uma edição aponta para a página ${op.page + 1}, que não existe neste PDF.`);
    const f = pageFrame(page);
    const rot = degrees(f.r);
    const opacity = op.opacity ?? 1;

    switch (op.type) {
      case 'text': {
        const font = await fontFor(op.font, op.bold);
        const text = safeText(font, op.text);
        const lines = wrapLines(text, (s) => font.widthOfTextAtSize(s, op.size), op.w);
        const ascent = font.heightAtSize(op.size, { descender: false });
        const color = hexToRgb(op.color);
        lines.forEach((line, i) => {
          if (!line) return;
          const lw = font.widthOfTextAtSize(line, op.size);
          const dx = op.align === 'center' ? (op.w - lw) / 2 : op.align === 'right' ? op.w - lw : 0;
          const o = f.pt(op.x + Math.max(0, op.w ? dx : 0), op.y + ascent + i * op.size * LINE_HEIGHT);
          page.drawText(line, { x: o.x, y: o.y, size: op.size, font, color, opacity, rotate: rot });
        });
        break;
      }
      case 'image': {
        const bytes = b64ToBytes(op.data);
        const img = op.mime === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const o = f.pt(op.x, op.y + op.h);
        page.drawImage(img, { x: o.x, y: o.y, width: op.w, height: op.h, rotate: rot, opacity });
        break;
      }
      case 'rect':
      case 'highlight':
      case 'whiteout': {
        const o = f.pt(op.x, op.y + op.h);
        const style =
          op.type === 'whiteout'
            ? { color: rgb(1, 1, 1), opacity: 1 }
            : op.type === 'highlight'
              ? { color: hexToRgb(op.fill ?? '#FFE600'), opacity: op.opacity ?? 0.35, blendMode: BlendMode.Multiply }
              : {
                  color: op.fill ? hexToRgb(op.fill) : undefined,
                  opacity,
                  borderColor: op.stroke ? hexToRgb(op.stroke) : undefined,
                  borderWidth: op.stroke ? op.strokeWidth : 0,
                  borderOpacity: opacity,
                };
        page.drawRectangle({ x: o.x, y: o.y, width: op.w, height: op.h, rotate: rot, ...style });
        break;
      }
      case 'ellipse': {
        const c = f.pt(op.x + op.w / 2, op.y + op.h / 2);
        page.drawEllipse({
          x: c.x,
          y: c.y,
          xScale: op.w / 2,
          yScale: op.h / 2,
          rotate: rot,
          color: op.fill ? hexToRgb(op.fill) : undefined,
          opacity,
          borderColor: op.stroke ? hexToRgb(op.stroke) : undefined,
          borderWidth: op.stroke ? op.strokeWidth : 0,
          borderOpacity: opacity,
        });
        break;
      }
      case 'line':
      case 'arrow': {
        const color = hexToRgb(op.stroke);
        const seg = (x1: number, y1: number, x2: number, y2: number) =>
          page.drawLine({ start: f.pt(x1, y1), end: f.pt(x2, y2), thickness: op.strokeWidth, color, opacity, lineCap: LineCapStyle.Round });
        seg(op.x1, op.y1, op.x2, op.y2);
        if (op.type === 'arrow') {
          const ang = Math.atan2(op.y2 - op.y1, op.x2 - op.x1);
          const len = Math.max(8, op.strokeWidth * 4);
          for (const s of [-0.45, 0.45]) {
            seg(op.x2, op.y2, op.x2 - len * Math.cos(ang + s), op.y2 - len * Math.sin(ang + s));
          }
        }
        break;
      }
      case 'ink': {
        const color = hexToRgb(op.stroke);
        const p = op.points;
        if (p.length === 2) {
          const c = f.pt(p[0], p[1]);
          page.drawCircle({ x: c.x, y: c.y, size: op.strokeWidth / 2, color, opacity });
          break;
        }
        for (let i = 2; i + 1 < p.length; i += 2) {
          page.drawLine({ start: f.pt(p[i - 2], p[i - 1]), end: f.pt(p[i], p[i + 1]), thickness: op.strokeWidth, color, opacity, lineCap: LineCapStyle.Round });
        }
        break;
      }
      case 'note': {
        // Anotação de texto nativa (/Subtype /Text): aparece como ícone de comentário nos leitores de PDF.
        const a = f.pt(op.x, op.y + NOTE_SIZE);
        const b = f.pt(op.x + NOTE_SIZE, op.y);
        const [r, g, bl] = (() => {
          const c = hexToRgb(op.color) as unknown as { red: number; green: number; blue: number };
          return [c.red, c.green, c.blue];
        })();
        const ctx = doc.context;
        const annot = ctx.obj({
          Type: 'Annot',
          Subtype: 'Text',
          Rect: [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)],
          Contents: PDFHexString.fromText(op.text),
          T: PDFHexString.fromText('PDFForge'),
          Name: 'Comment',
          F: 4 | 8 | 16,
          Open: false,
        });
        annot.set(PDFName.of('C'), ctx.obj([PDFNumber.of(r), PDFNumber.of(g), PDFNumber.of(bl)]) as PDFArray);
        page.node.addAnnot(ctx.register(annot));
        break;
      }
    }
  }
  return [{ name: outName(input.name, 'edited'), bytes: await doc.save(), mime: PDF_MIME }];
}
