import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  compressLossless,
  cropPdf,
  imagesToPdf,
  mergePdfs,
  organizePdf,
  pageNumbersPdf,
  protectPdf,
  removePages,
  repairPdf,
  rotatePdf,
  splitPdf,
  unlockPdf,
  watermarkPdf,
  MM,
} from '../src/engine/ops';
import { formatPageList, parsePageList, parseRangeGroups } from '../src/engine/ranges';
import { comparePageTexts } from '../src/engine/compare';
import { ToolError, type InputFile } from '../src/engine/types';

/** PDF sintético: cada página contém "Pagina N <tag>". */
async function makePdf(pages: number, tag = 'doc', opts: { rotate?: number } = {}): Promise<InputFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Pagina ${i} ${tag}`, { x: 60, y: 760, size: 18, font });
    if (opts.rotate) p.setRotation(degrees(opts.rotate));
  }
  return { name: `${tag}.pdf`, bytes: await doc.save() };
}

async function texts(bytes: Uint8Array, password?: string): Promise<string[]> {
  const pdf = await getDocument({ data: bytes.slice(), password, verbosity: 0 }).promise;
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    out.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  await pdf.destroy();
  return out;
}

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('intervalos de páginas', () => {
  it('interpreta grupos, aberturas e listas', () => {
    expect(parseRangeGroups('1-3, 5, 8-', 10)).toEqual([[0, 1, 2], [4], [7, 8, 9]]);
    expect(parseRangeGroups('-2', 5)).toEqual([[0, 1]]);
    expect(parsePageList('3,1-2,2', 5)).toEqual([0, 1, 2]);
    expect(formatPageList([0, 1, 2, 4, 6, 7])).toBe('1-3, 5, 7-8');
  });
  it('rejeita intervalos inválidos', () => {
    expect(() => parseRangeGroups('0-2', 5)).toThrow(ToolError);
    expect(() => parseRangeGroups('4-2', 5)).toThrow(/invertido/);
    expect(() => parseRangeGroups('9', 5)).toThrow(/fora/);
    expect(() => parseRangeGroups('a', 5)).toThrow(/inválido/);
    expect(() => parseRangeGroups(' ', 5)).toThrow(ToolError);
  });
});

describe('organizar', () => {
  it('junta PDFs preservando a ordem', async () => {
    const [out] = await mergePdfs([await makePdf(2, 'A'), await makePdf(3, 'B')]);
    expect(out.name).toBe('A_merged.pdf');
    const t = await texts(out.bytes);
    expect(t).toHaveLength(5);
    expect(t[0]).toContain('Pagina 1 A');
    expect(t[2]).toContain('Pagina 1 B');
  });

  it('exige dois arquivos para juntar', async () => {
    await expect(mergePdfs([await makePdf(1)])).rejects.toThrow(ToolError);
  });

  it('divide por intervalos, a cada N e extrai páginas', async () => {
    const src = await makePdf(5);
    const byRange = await splitPdf(src, { mode: 'ranges', ranges: '1-2, 4-' });
    expect(byRange.map((o) => o.name)).toEqual(['doc_p1-2.pdf', 'doc_p4-5.pdf']);
    expect(await pages(byRange[1].bytes)).toBe(2);

    const every = await splitPdf(src, { mode: 'every', every: 2 });
    expect(await Promise.all(every.map((o) => pages(o.bytes)))).toEqual([2, 2, 1]);

    const each = await splitPdf(src, { mode: 'extract-each', ranges: '' });
    expect(each).toHaveLength(5);

    const one = await splitPdf(src, { mode: 'extract-one', ranges: '2,4' });
    expect(await texts(one[0].bytes)).toEqual([expect.stringContaining('Pagina 2'), expect.stringContaining('Pagina 4')]);
  });

  it('remove páginas e impede documento vazio', async () => {
    const src = await makePdf(4);
    const [out] = await removePages(src, '2-3');
    const t = await texts(out.bytes);
    expect(t.map((s) => s.match(/Pagina \d/)![0])).toEqual(['Pagina 1', 'Pagina 4']);
    await expect(removePages(src, '1-4')).rejects.toThrow(/todas/);
  });

  it('reordena, gira e insere página em branco', async () => {
    const src = await makePdf(3);
    const [out] = await organizePdf(src, [
      { index: 2, rotate: 90 },
      { index: -1, rotate: 0 },
      { index: 0, rotate: 0 },
    ]);
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    const t = await texts(out.bytes);
    expect(t[0]).toContain('Pagina 3');
    expect(t[1].trim()).toBe('');
    expect(t[2]).toContain('Pagina 1');
  });
});

describe('editar', () => {
  it('gira apenas as páginas selecionadas, acumulando rotação', async () => {
    const src = await makePdf(3, 'doc', { rotate: 90 });
    const [out] = await rotatePdf(src, 270, '2');
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 0, 90]);
  });

  it('aplica marca d’água com acentos', async () => {
    const [out] = await watermarkPdf(await makePdf(2), {
      text: 'CONFIDENCIAL — Revisão',
      fontSize: 40,
      opacity: 0.3,
      angle: 45,
      color: '#E5322D',
      layout: 'center',
    });
    const t = await texts(out.bytes);
    expect(t.every((s) => s.includes('Revisão'))).toBe(true);
  });

  it('marca d’água vazia é recusada', async () => {
    await expect(
      watermarkPdf(await makePdf(1), { text: '  ', fontSize: 10, opacity: 1, angle: 0, color: '#000000', layout: 'center' }),
    ).rejects.toThrow(ToolError);
  });

  it('numera páginas no formato "n de total", inclusive páginas giradas', async () => {
    const [out] = await pageNumbersPdf(await makePdf(3, 'doc', { rotate: 90 }), {
      position: 'bottom-right',
      start: 1,
      format: 'n-of-total',
      fontSize: 11,
      margin: 30,
    });
    const t = await texts(out.bytes);
    expect(t[0]).toContain('1 de 3');
    expect(t[2]).toContain('3 de 3');
  });

  it('recorta margens em mm considerando a rotação', async () => {
    const [plain] = await cropPdf(await makePdf(1), { top: 10, right: 20, bottom: 0, left: 0 });
    const box = (await PDFDocument.load(plain.bytes)).getPage(0).getCropBox();
    expect(box.width).toBeCloseTo(595 - 20 * MM, 1);
    expect(box.height).toBeCloseTo(842 - 10 * MM, 1);
    expect(box.y).toBeCloseTo(0, 1);

    // Página com /Rotate 90: margem visual superior corresponde à esquerda do espaço do usuário.
    const [rot] = await cropPdf(await makePdf(1, 'r', { rotate: 90 }), { top: 10, right: 0, bottom: 0, left: 0 });
    const rbox = (await PDFDocument.load(rot.bytes)).getPage(0).getCropBox();
    expect(rbox.x).toBeCloseTo(10 * MM, 1);
    expect(rbox.width).toBeCloseTo(595 - 10 * MM, 1);
    expect(rbox.height).toBeCloseTo(842, 1);

    await expect(cropPdf(await makePdf(1), { top: 200, right: 0, bottom: 200, left: 0 })).rejects.toThrow(/maiores/);
  });
});

describe('converter', () => {
  // PNG 2x1 válido (vermelho/azul).
  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DAwPCfAQAG/AH/gPdJ5QAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0),
  );

  it('converte imagens em PDF A4 paisagem automático e em arquivos separados', async () => {
    const imgs = [
      { name: 'a.png', bytes: png, type: 'png' as const },
      { name: 'b.png', bytes: png, type: 'png' as const },
    ];
    const [merged] = await imagesToPdf(imgs, { pageSize: 'A4', orientation: 'auto', margin: 20, merge: true });
    const doc = await PDFDocument.load(merged.bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height); // imagem larga → paisagem

    const separate = await imagesToPdf(imgs, { pageSize: 'fit', orientation: 'auto', margin: 0, merge: false });
    expect(separate.map((o) => o.name)).toEqual(['a.pdf', 'b.pdf']);
    expect((await PDFDocument.load(separate[0].bytes)).getPage(0).getSize()).toEqual({ width: 2, height: 1 });
  });
});

describe('segurança e otimização', () => {
  it('protege com senha e desbloqueia com a senha correta', async () => {
    await expect(protectPdf(await makePdf(1), { password: 'abc', confirm: 'abc', allowPrinting: true, allowCopying: false })).rejects.toThrow(/4 caracteres/);
    await expect(protectPdf(await makePdf(1), { password: 'abcd', confirm: 'abce', allowPrinting: true, allowCopying: false })).rejects.toThrow(/coincidem/);

    const [locked] = await protectPdf(await makePdf(2, 'segredo'), { password: 's3nh4', confirm: 's3nh4', allowPrinting: true, allowCopying: false });
    expect(Buffer.from(locked.bytes).toString('latin1')).toContain('/Encrypt');
    await expect(unlockPdf({ name: locked.name, bytes: locked.bytes })).rejects.toThrow(/protegido por senha/);
    await expect(unlockPdf({ name: locked.name, bytes: locked.bytes, password: 'errada' })).rejects.toThrow(/incorreta/);

    const [open] = await unlockPdf({ name: locked.name, bytes: locked.bytes, password: 's3nh4' });
    expect(Buffer.from(open.bytes).toString('latin1')).not.toContain('/Encrypt');
    expect((await texts(open.bytes))[1]).toContain('Pagina 2 segredo');
  });

  it('desbloqueia PDF só com senha de proprietário sem pedir senha', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.encrypt({ ownerPassword: 'dono', userPassword: '' });
    const [out] = await unlockPdf({ name: 'x.pdf', bytes: await doc.save() });
    expect(Buffer.from(out.bytes).toString('latin1')).not.toContain('/Encrypt');
  });

  it('compressão sem perdas nunca aumenta o arquivo', async () => {
    const src = await makePdf(5);
    const [out] = await compressLossless(src);
    expect(out.bytes.length).toBeLessThanOrEqual(src.bytes.length);
    expect(await pages(out.bytes)).toBe(5);
  });

  it('repara PDF com xref corrompida', async () => {
    const src = await makePdf(3);
    const raw = Buffer.from(src.bytes).toString('latin1');
    const broken = raw.replace(/startxref\s+\d+/, 'startxref\n999999');
    const [out] = await repairPdf({ name: 'quebrado.pdf', bytes: Uint8Array.from(Buffer.from(broken, 'latin1')) });
    expect(await pages(out.bytes)).toBe(3);
  });

  it('rejeita arquivo que não é PDF com mensagem clara', async () => {
    await expect(rotatePdf({ name: 'nota.pdf', bytes: new TextEncoder().encode('não sou pdf') }, 90)).rejects.toThrow(/não pôde ser lido/);
  });
});

describe('comparar', () => {
  it('conta palavras adicionadas/removidas e escapa HTML', () => {
    const r = comparePageTexts(['o paciente <b> recebeu dose'], ['o paciente <b> recebeu nova dose', 'pagina extra'], 'v1.pdf', 'v2.pdf');
    expect(r.totalAdded).toBe(3);
    expect(r.totalRemoved).toBe(0);
    expect(r.pages).toHaveLength(2);
    expect(r.html).toContain('&lt;b&gt;');
    expect(r.html).not.toContain('<b> recebeu');
  });
});
