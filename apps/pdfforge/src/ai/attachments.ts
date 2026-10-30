// Anexos de conversa: PDFs (texto por página), imagens (visão) e textos (transcrições, Word, biblioteca).
import { extractPageTexts } from '../engine/render';
import type { ChatBlock } from './bridge';

export interface Attachment {
  id: string;
  kind: 'doc' | 'image';
  name: string;
  /** Texto com marcadores [p. N] quando vier de PDF. */
  text?: string;
  pages?: number;
  image?: { mediaType: string; data: string; preview: string };
  source?: string;
}

const uid = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function pdfAttachment(name: string, bytes: Uint8Array, password?: string): Promise<Attachment> {
  const pages = await extractPageTexts(bytes, password);
  const text = pages.map((t, i) => `[p. ${i + 1}]\n${t}`).join('\n\n');
  const empty = pages.every((t) => !t.trim());
  return {
    id: uid(),
    kind: 'doc',
    name,
    pages: pages.length,
    text: empty ? `[${name}: sem texto extraível — rode OCR PDF antes de enviar à IA]` : text,
  };
}

export function textAttachment(name: string, text: string, source?: string): Attachment {
  return { id: uid(), kind: 'doc', name, text, source };
}

/** Reduz a imagem para no máximo 1568 px no maior lado (tamanho recomendado para visão) e gera JPEG/PNG base64. */
export async function imageAttachment(name: string, bytes: Uint8Array, type: string): Promise<Attachment> {
  const bmp = await createImageBitmap(new Blob([bytes], { type }));
  const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const mediaType = type === 'image/png' ? 'image/png' : 'image/jpeg';
  const url = canvas.toDataURL(mediaType, 0.88);
  return { id: uid(), kind: 'image', name, image: { mediaType, data: url.split(',')[1], preview: url } };
}

export function docsText(atts: Attachment[]): { documento: string; titulo: string } {
  const docs = atts.filter((a) => a.kind === 'doc');
  return {
    titulo: docs.map((d) => d.name).join(' + '),
    documento: docs.map((d) => (docs.length > 1 ? `=== ${d.name} ===\n${d.text}` : d.text ?? '')).join('\n\n'),
  };
}

export const imageBlocks = (atts: Attachment[]): ChatBlock[] =>
  atts.filter((a) => a.kind === 'image' && a.image).map((a) => ({ type: 'image', mediaType: a.image!.mediaType, data: a.image!.data }));

/** Divide o texto de um anexo de PDF ("[p. N]") em páginas, para indexar com número de página. */
export function attachmentPages(a: Attachment): { page?: number; text: string }[] {
  if (!a.pages || !a.text) return [{ text: a.text ?? '' }];
  const parts = a.text.split(/\n?\[p\. (\d+)\]\n/).slice(1);
  const out: { page: number; text: string }[] = [];
  for (let i = 0; i < parts.length; i += 2) out.push({ page: Number(parts[i]), text: parts[i + 1] ?? '' });
  return out;
}

export const approxTokens = (chars: number) => Math.round(chars / 3.6);
