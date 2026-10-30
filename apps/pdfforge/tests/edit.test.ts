import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { Util, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applyEdits, boundsOf, resizeOp, translateOp, wrapLines, type EditOp } from '../src/engine/edit';
import type { InputFile } from '../src/engine/types';

async function blank(pages = 1, rotate = 0): Promise<InputFile> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([595, 842]);
    if (rotate) p.setRotation(degrees(rotate));
  }
  return { name: 'base.pdf', bytes: await doc.save() };
}

/** Itens de texto com posição VISUAL (origem superior esquerda), como a interface vê a página. */
async function visualText(bytes: Uint8Array, pageNo = 1) {
  const pdf = await getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const page = await pdf.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = tc.items
    .filter((it) => 'str' in it && it.str.trim())
    .map((it) => {
      const t = Util.transform(vp.transform, (it as { transform: number[] }).transform);
      return { str: (it as { str: string }).str, x: t[4], y: t[5] };
    });
  const annots = await page.getAnnotations();
  await pdf.destroy();
  return { items, annots, size: { w: vp.width, h: vp.height } };
}

const textOp = (over: Partial<Extract<EditOp, { type: 'text' }>> = {}): EditOp => ({
  id: 't1',
  page: 0,
  type: 'text',
  x: 50,
  y: 60,
  w: 0,
  h: 20,
  text: 'Olá edição',
  font: 'Helvetica',
  bold: false,
  size: 14,
  color: '#112233',
  align: 'left',
  ...over,
});

// PNG 2x1 válido
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DAwPCfAQAG/AH/gPdJ5QAAAABJRU5ErkJggg==';

describe('applyEdits', () => {
  it('sem operações devolve cópia válida com sufixo _edited', async () => {
    const [out] = await applyEdits(await blank(2), []);
    expect(out.name).toBe('base_edited.pdf');
    expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(2);
  });

  it('escreve texto com acentos na posição visual da página', async () => {
    const [out] = await applyEdits(await blank(), [textOp()]);
    const { items } = await visualText(out.bytes);
    const t = items.find((i) => i.str.includes('Olá'))!;
    expect(t.str).toBe('Olá edição');
    expect(t.x).toBeCloseTo(50, 0);
    // linha de base fica abaixo do topo da caixa, dentro da altura da fonte
    expect(t.y).toBeGreaterThan(60);
    expect(t.y).toBeLessThan(60 + 14);
  });

  it.each([90, 180, 270])('posiciona corretamente em página girada %i°', async (rot) => {
    const [out] = await applyEdits(await blank(1, rot), [textOp({ x: 80, y: 100, text: 'Girada' })]);
    const { items, size } = await visualText(out.bytes);
    expect(size.w).toBe(rot === 180 ? 595 : 842);
    const t = items.find((i) => i.str === 'Girada')!;
    expect(t.x).toBeCloseTo(80, 0);
    expect(t.y).toBeGreaterThan(100);
    expect(t.y).toBeLessThan(114);
  });

  it('quebra linhas na largura da caixa e alinha à direita', async () => {
    const [out] = await applyEdits(await blank(), [
      textOp({ text: 'um dois tres quatro cinco seis sete oito', w: 120, align: 'right', font: 'Times', bold: true }),
    ]);
    const { items } = await visualText(out.bytes);
    expect(items.length).toBeGreaterThan(1);
    const rights = items.map((i) => i.x);
    expect(Math.min(...rights)).toBeGreaterThanOrEqual(50 - 0.5);
    const ys = [...new Set(items.map((i) => Math.round(i.y)))];
    expect(ys.length).toBe(items.length);
  });

  it('remove caracteres fora do WinAnsi em vez de falhar', async () => {
    const [out] = await applyEdits(await blank(), [textOp({ text: 'Dose 2 mg 💊 ok' })]);
    const { items } = await visualText(out.bytes);
    const s = items.map((i) => i.str).join('');
    expect(s).toMatch(/^Dose 2 mg\s+ok$/);
    expect(s).not.toContain('?');
  });

  it('incorpora imagem, formas, traço, marca-texto e corretor', async () => {
    const src = await blank();
    const ops: EditOp[] = [
      { id: 'i', page: 0, type: 'image', x: 10, y: 10, w: 100, h: 50, data: PNG_B64, mime: 'image/png' },
      { id: 'r', page: 0, type: 'rect', x: 10, y: 100, w: 80, h: 40, stroke: '#ff0000', fill: null, strokeWidth: 2 },
      { id: 'e', page: 0, type: 'ellipse', x: 100, y: 100, w: 80, h: 40, stroke: '#0000ff', fill: '#00ff00', strokeWidth: 1, opacity: 0.5 },
      { id: 'l', page: 0, type: 'arrow', x1: 10, y1: 200, x2: 200, y2: 260, stroke: '#000000', strokeWidth: 2 },
      { id: 'k', page: 0, type: 'ink', points: [10, 300, 20, 310, 35, 305, 50, 330], stroke: '#333333', strokeWidth: 3 },
      { id: 'h', page: 0, type: 'highlight', x: 10, y: 400, w: 200, h: 16, stroke: null, fill: '#FFE600', strokeWidth: 0 },
      { id: 'w', page: 0, type: 'whiteout', x: 10, y: 450, w: 200, h: 16, stroke: null, fill: null, strokeWidth: 0 },
    ];
    const [out] = await applyEdits(src, ops);
    expect(out.bytes.length).toBeGreaterThan(src.bytes.length + 500);
    const raw = Buffer.from(out.bytes).toString('latin1');
    expect(raw).toMatch(/\/Subtype\s*\/Image/);
    // estados gráficos de opacidade/blend gerados para marca-texto e elipse
    expect(raw).toMatch(/\/BM\s*\/Multiply/);
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('cria nota como anotação de texto nativa', async () => {
    const [out] = await applyEdits(await blank(), [{ id: 'n', page: 0, type: 'note', x: 300, y: 50, text: 'Conferir dose', color: '#FFC233' }]);
    const { annots } = await visualText(out.bytes);
    expect(annots).toHaveLength(1);
    expect(annots[0].subtype).toBe('Text');
    expect(annots[0].contentsObj?.str ?? annots[0].contents).toBe('Conferir dose');
  });

  it('aplica em várias páginas e recusa página inexistente', async () => {
    const [out] = await applyEdits(await blank(3), [textOp({ page: 0, text: 'P1' }), textOp({ page: 2, text: 'P3' })]);
    expect((await visualText(out.bytes, 1)).items.map((i) => i.str)).toEqual(['P1']);
    expect((await visualText(out.bytes, 2)).items).toHaveLength(0);
    expect((await visualText(out.bytes, 3)).items.map((i) => i.str)).toEqual(['P3']);
    await expect(applyEdits(await blank(1), [textOp({ page: 5 })])).rejects.toThrow(/página 6/);
  });

  it('respeita CropBox deslocada', async () => {
    const doc = await PDFDocument.create();
    const p = doc.addPage([595, 842]);
    p.setCropBox(100, 100, 300, 400);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    p.drawText('ref', { x: 100, y: 490, size: 10, font });
    const [out] = await applyEdits({ name: 'c.pdf', bytes: await doc.save() }, [textOp({ x: 20, y: 30, text: 'Crop' })]);
    const { items, size } = await visualText(out.bytes);
    expect(size).toEqual({ w: 300, h: 400 });
    const t = items.find((i) => i.str === 'Crop')!;
    expect(t.x).toBeCloseTo(20, 0);
    expect(t.y).toBeGreaterThan(30);
    expect(t.y).toBeLessThan(44);
  });
});

describe('geometria das operações', () => {
  it('move, redimensiona e calcula limites de linha e traço', () => {
    const line: EditOp = { id: 'l', page: 0, type: 'line', x1: 50, y1: 80, x2: 10, y2: 20, stroke: '#000', strokeWidth: 1 };
    expect(boundsOf(line)).toEqual({ x: 10, y: 20, w: 40, h: 60 });
    expect(boundsOf(translateOp(line, 5, -5))).toEqual({ x: 15, y: 15, w: 40, h: 60 });
    const ink: EditOp = { id: 'k', page: 0, type: 'ink', points: [0, 0, 10, 20], stroke: '#000', strokeWidth: 1 };
    expect(resizeOp(ink, { x: 100, y: 100, w: 20, h: 40 })).toMatchObject({ points: [100, 100, 120, 140] });
  });

  it('quebra texto por largura e corta palavras longas', () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapLines('aa bb cc', measure, 50)).toEqual(['aa bb', 'cc']);
    expect(wrapLines('abcdefgh', measure, 30)).toEqual(['abc', 'def', 'gh']);
    expect(wrapLines('linha1\nlinha2', measure, 0)).toEqual(['linha1', 'linha2']);
  });
});
