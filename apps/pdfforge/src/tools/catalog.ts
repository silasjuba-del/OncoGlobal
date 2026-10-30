// Catálogo de ferramentas. Espelha a tabela `Tool` do app original (ver docs/ENGENHARIA-REVERSA.md §2).
// Para adicionar uma ferramenta: acrescente um ToolDef aqui (metadados + fields + run). Ver docs/ADICIONAR-FERRAMENTA.md.
import { comparePageTexts } from '../engine/compare';
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
  type NumberPosition,
  type PagePlanItem,
  type SplitMode,
} from '../engine/ops';
import { extractPageTexts, normalizeImage, ocrPdf, pdfToImages, pdfToMarkdown, rasterCompress } from '../engine/render';
import { urlToPdf } from '../ai/bridge';
import type { InputFile, OutputFile, RunContext } from '../engine/types';
import { ToolError } from '../engine/types';
import type { Options, ToolDef } from './types';

/** Executa uma operação por arquivo, em sequência, com progresso agregado. */
async function perFile(
  files: InputFile[],
  ctx: RunContext,
  fn: (f: InputFile, ctx: RunContext) => Promise<OutputFile[]>,
): Promise<OutputFile[]> {
  const out: OutputFile[] = [];
  for (const [i, f] of files.entries()) {
    const sub: RunContext = {
      progress: (frac, label) => ctx.progress((i + frac) / files.length, label ?? f.name),
    };
    sub.progress(0, f.name);
    out.push(...(await fn(f, sub)));
  }
  return out;
}

const s = (o: Options, k: string) => String(o[k] ?? '');
const n = (o: Options, k: string) => Number(o[k] ?? 0);
const b = (o: Options, k: string) => Boolean(o[k]);

const PAGES_FIELD = {
  key: 'pages',
  label: 'Páginas',
  type: 'text' as const,
  placeholder: 'Todas (ex.: 1-3, 5)',
  help: 'Deixe vazio para aplicar em todas as páginas.',
};

const OFFICE_REASON =
  'Conversão Office exige um motor de layout (o original usa Solid Framework, comercial). Próximo lote: integrar LibreOffice headless.';

const C = {
  organize: '#E5322D',
  optimize: '#4ACD86',
  image: '#FFC233',
  word: '#2B6CD9',
  ppt: '#D9572B',
  excel: '#1D9D58',
  pdfa: '#6C7BD0',
  edit: '#A35FC9',
  security: '#2E7BE6',
};

export const TOOLS: ToolDef[] = [
  // ----- Organizar PDF -----
  {
    id: 'merge',
    name: 'Juntar PDF',
    category: 'Organizar PDF',
    glyph: '⊕',
    color: C.organize,
    actionText: 'Juntar PDF',
    description: 'Combine PDFs na ordem que quiser.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: {},
    run: (files, _o, ctx) => mergePdfs(files, ctx),
  },
  {
    id: 'split',
    name: 'Dividir PDF',
    category: 'Organizar PDF',
    glyph: '⫽',
    color: C.organize,
    actionText: 'Dividir PDF',
    description: 'Separe páginas ou intervalos em PDFs independentes.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: { mode: 'ranges', ranges: '1-2', every: 1 },
    fields: [
      {
        key: 'mode',
        label: 'Modo',
        type: 'select',
        options: [
          { value: 'ranges', label: 'Por intervalos (um PDF por intervalo)' },
          { value: 'every', label: 'A cada N páginas' },
          { value: 'extract-each', label: 'Extrair cada página' },
          { value: 'extract-one', label: 'Extrair páginas para um único PDF' },
        ],
      },
      {
        key: 'ranges',
        label: 'Intervalos',
        type: 'text',
        placeholder: '1-3, 4-6, 7-',
        help: 'Separe por vírgula. "7-" vai até o fim.',
        showIf: (o) => o.mode !== 'every',
      },
      { key: 'every', label: 'Páginas por arquivo', type: 'number', min: 1, step: 1, showIf: (o) => o.mode === 'every' },
    ],
    run: (files, o, ctx) =>
      perFile(files, ctx, (f) =>
        splitPdf(f, { mode: s(o, 'mode') as SplitMode, ranges: s(o, 'ranges'), every: n(o, 'every') }),
      ),
  },
  {
    id: 'remove-pages',
    name: 'Remover páginas',
    category: 'Organizar PDF',
    glyph: '⊖',
    color: C.organize,
    actionText: 'Remover páginas',
    description: 'Exclua páginas individuais ou intervalos.',
    accepts: 'pdf',
    multiple: false,
    status: 'ready',
    defaults: { pages: '' },
    fields: [{ key: 'pages', label: 'Páginas a remover', type: 'text', placeholder: 'ex.: 2, 5-7' }],
    run: (files, o, ctx) => perFile(files, ctx, (f) => removePages(f, s(o, 'pages'))),
  },
  {
    id: 'organize',
    name: 'Organizar PDF',
    category: 'Organizar PDF',
    glyph: '▦',
    color: C.organize,
    actionText: 'Organizar PDF',
    description: 'Reordene, gire, exclua ou insira páginas em branco.',
    accepts: 'pdf',
    multiple: false,
    status: 'ready',
    custom: 'organize',
    defaults: { plan: '' },
    run: async (files, o) => {
      const plan = s(o, 'plan') ? (JSON.parse(s(o, 'plan')) as PagePlanItem[]) : null;
      if (!plan) throw new ToolError('Aguarde o carregamento das páginas.');
      return organizePdf(files[0], plan);
    },
  },
  {
    id: 'scan',
    name: 'Digitalizar para PDF',
    category: 'Organizar PDF',
    glyph: '⎙',
    color: C.organize,
    actionText: 'Salvar em PDF',
    description: 'Capture documentos pelo celular e envie ao desktop.',
    accepts: 'none',
    multiple: false,
    status: 'planned',
    internet: true,
    plannedReason: 'Exige app móvel + servidor local de recepção (o original usa Qt HttpServer).',
    defaults: {},
  },

  // ----- Otimizar PDF -----
  {
    id: 'compress',
    name: 'Comprimir PDF',
    category: 'Otimizar PDF',
    glyph: '⇲',
    color: C.optimize,
    actionText: 'Comprimir PDF',
    description: 'Reduza o tamanho do arquivo.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: { level: 'lossless' },
    fields: [
      {
        key: 'level',
        label: 'Nível de compressão',
        type: 'select',
        options: [
          { value: 'lossless', label: 'Sem perdas — mantém texto selecionável' },
          { value: 'recommended', label: 'Recomendada — 150 dpi (rasteriza páginas)' },
          { value: 'extreme', label: 'Extrema — 96 dpi (rasteriza páginas)' },
        ],
        help: 'Recomendada/Extrema convertem páginas em imagem: o texto deixa de ser selecionável.',
      },
    ],
    run: (files, o, ctx) =>
      perFile(files, ctx, (f, c) => {
        const level = s(o, 'level');
        if (level === 'recommended') return rasterCompress(f, 150, 0.72, c);
        if (level === 'extreme') return rasterCompress(f, 96, 0.55, c);
        return compressLossless(f);
      }),
  },
  {
    id: 'ocr',
    name: 'OCR PDF',
    category: 'Otimizar PDF',
    glyph: 'OCR',
    color: C.optimize,
    actionText: 'OCR PDF',
    description: 'Torne PDFs digitalizados pesquisáveis e selecionáveis.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    internet: true,
    defaults: { lang: 'por+eng', dpi: 200 },
    fields: [
      {
        key: 'lang',
        label: 'Idioma do documento',
        type: 'select',
        options: [
          { value: 'por+eng', label: 'Português + Inglês' },
          { value: 'por', label: 'Português' },
          { value: 'eng', label: 'Inglês' },
          { value: 'spa', label: 'Espanhol' },
        ],
      },
      {
        key: 'dpi',
        label: 'Resolução',
        type: 'segmented',
        options: [
          { value: '150', label: '150 dpi' },
          { value: '200', label: '200 dpi' },
          { value: '300', label: '300 dpi' },
        ],
      },
    ],
    run: (files, o, ctx) => perFile(files, ctx, (f, c) => ocrPdf(f, { lang: s(o, 'lang'), dpi: n(o, 'dpi') }, c)),
  },
  {
    id: 'repair',
    name: 'Reparar PDF',
    category: 'Otimizar PDF',
    glyph: '✚',
    color: C.optimize,
    actionText: 'Reparar PDF',
    description: 'Recupere páginas de PDFs danificados.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: {},
    run: (files, _o, ctx) => perFile(files, ctx, (f) => repairPdf(f)),
  },

  // ----- Converter para PDF -----
  {
    id: 'image-to-pdf',
    name: 'Imagem para PDF',
    category: 'Converter para PDF',
    glyph: 'IMG',
    color: C.image,
    actionText: 'Converter para PDF',
    description: 'Converta JPG, PNG, WEBP e outras imagens em PDF.',
    accepts: 'image',
    multiple: true,
    status: 'ready',
    defaults: { pageSize: 'A4', orientation: 'auto', margin: 'small', merge: true },
    fields: [
      {
        key: 'pageSize',
        label: 'Tamanho da página',
        type: 'select',
        options: [
          { value: 'A4', label: 'A4 (297×210 mm)' },
          { value: 'Letter', label: 'Carta (US Letter)' },
          { value: 'fit', label: 'Mesmo tamanho da imagem' },
        ],
      },
      {
        key: 'orientation',
        label: 'Orientação',
        type: 'segmented',
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'portrait', label: 'Retrato' },
          { value: 'landscape', label: 'Paisagem' },
        ],
        showIf: (o) => o.pageSize !== 'fit',
      },
      {
        key: 'margin',
        label: 'Margem',
        type: 'segmented',
        options: [
          { value: 'none', label: 'Sem' },
          { value: 'small', label: 'Pequena' },
          { value: 'large', label: 'Grande' },
        ],
      },
      { key: 'merge', label: 'Juntar todas as imagens em um único PDF', type: 'checkbox' },
    ],
    run: async (files, o) => {
      const images = await Promise.all(files.map(normalizeImage));
      const margin = { none: 0, small: 20, large: 50 }[s(o, 'margin') as 'none' | 'small' | 'large'] ?? 0;
      return imagesToPdf(images, {
        pageSize: s(o, 'pageSize') as 'fit' | 'A4' | 'Letter',
        orientation: s(o, 'orientation') as 'auto' | 'portrait' | 'landscape',
        margin,
        merge: b(o, 'merge'),
      });
    },
  },
  planned('word-to-pdf', 'Word para PDF', 'Converter para PDF', 'W', C.word, 'Converta DOC e DOCX em PDF.', OFFICE_REASON),
  planned('powerpoint-to-pdf', 'PowerPoint para PDF', 'Converter para PDF', 'P', C.ppt, 'Converta PPT e PPTX em PDF.', OFFICE_REASON),
  planned('excel-to-pdf', 'Excel para PDF', 'Converter para PDF', 'X', C.excel, 'Converta planilhas Excel em PDF.', OFFICE_REASON),
  {
    id: 'html-to-pdf',
    name: 'Site → PDF (scraper)',
    category: 'Converter para PDF',
    glyph: '</>',
    color: C.image,
    actionText: 'Capturar em PDF',
    description: 'Renderiza uma página web (com sua sessão do navegador interno) e salva como PDF + texto.',
    accepts: 'none',
    multiple: false,
    status: 'ready',
    defaults: { url: '' },
    fields: [{ key: 'url', label: 'Endereço da página', type: 'text', placeholder: 'https://…', help: 'Páginas que exigem login usam a sessão aberta na aba Navegador.' }],
    run: async (_files, o, ctx) => {
      const url = s(o, 'url').trim();
      if (!/^https?:\/\//i.test(url)) throw new ToolError('Informe um endereço começando com http:// ou https://');
      ctx.progress(0.2, 'Carregando a página…');
      const page = await urlToPdf(url);
      const base = (page.title || new URL(url).hostname).replace(/[<>:"/\\|?*]+/g, ' ').trim().slice(0, 80) || 'pagina';
      const md = `# ${page.title}\n\nFonte: ${url}\n\n${page.text}`;
      return [
        { name: `${base}.pdf`, bytes: page.bytes, mime: 'application/pdf' },
        { name: `${base}.md`, bytes: new TextEncoder().encode(md), mime: 'text/markdown' },
      ];
    },
  },

  // ----- Converter de PDF -----
  {
    id: 'pdf-to-jpg',
    name: 'PDF para JPG',
    category: 'Converter de PDF',
    glyph: 'JPG',
    color: C.image,
    actionText: 'Converter para JPG',
    description: 'Converta cada página do PDF em imagem.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: { format: 'jpg', dpi: 150, quality: 0.85 },
    fields: [
      {
        key: 'format',
        label: 'Formato',
        type: 'segmented',
        options: [
          { value: 'jpg', label: 'JPG' },
          { value: 'png', label: 'PNG' },
        ],
      },
      {
        key: 'dpi',
        label: 'Resolução',
        type: 'segmented',
        options: [
          { value: '96', label: 'Normal (96)' },
          { value: '150', label: 'Alta (150)' },
          { value: '300', label: 'Máxima (300)' },
        ],
      },
      {
        key: 'quality',
        label: 'Qualidade JPG',
        type: 'slider',
        min: 0.4,
        max: 1,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`,
        showIf: (o) => o.format === 'jpg',
      },
    ],
    run: (files, o, ctx) =>
      perFile(files, ctx, (f, c) =>
        pdfToImages(f, { dpi: n(o, 'dpi'), quality: n(o, 'quality'), format: s(o, 'format') as 'jpg' | 'png' }, c),
      ),
  },
  planned('pdf-to-word', 'PDF para Word', 'Converter de PDF', 'W', C.word, 'Converta PDF em DOCX editável.', OFFICE_REASON),
  planned('pdf-to-powerpoint', 'PDF para PowerPoint', 'Converter de PDF', 'P', C.ppt, 'Converta PDF em PPTX.', OFFICE_REASON),
  planned('pdf-to-excel', 'PDF para Excel', 'Converter de PDF', 'X', C.excel, 'Extraia tabelas do PDF para Excel.', OFFICE_REASON),
  {
    id: 'pdf-to-md',
    name: 'PDF → Markdown',
    category: 'Converter de PDF',
    glyph: 'MD',
    color: '#5C6BC0',
    actionText: 'Converter para MD',
    description: 'Extrai o texto com títulos, listas e parágrafos em Markdown (para IA, Obsidian, NotebookLM).',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: {},
    run: (files, _o, ctx) => perFile(files, ctx, (f) => pdfToMarkdown(f)),
  },
  planned('pdf-to-pdfa', 'PDF para PDF/A', 'Converter de PDF', 'A', C.pdfa, 'Converta para arquivamento de longo prazo.', 'PDF/A exige incorporação de fontes, perfil ICC e validação; previsto via Ghostscript.'),

  // ----- Editar PDF -----
  {
    id: 'rotate',
    name: 'Girar PDF',
    category: 'Editar PDF',
    glyph: '↻',
    color: C.edit,
    actionText: 'Girar PDF',
    description: 'Gire páginas de um ou vários PDFs.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: { angle: '90', pages: '' },
    fields: [
      {
        key: 'angle',
        label: 'Rotação',
        type: 'segmented',
        options: [
          { value: '90', label: '↻ 90°' },
          { value: '180', label: '180°' },
          { value: '270', label: '↺ 90°' },
        ],
      },
      PAGES_FIELD,
    ],
    run: (files, o, ctx) => perFile(files, ctx, (f) => rotatePdf(f, n(o, 'angle'), s(o, 'pages'))),
  },
  {
    id: 'page-numbers',
    name: 'Números de página',
    category: 'Editar PDF',
    glyph: '#',
    color: C.edit,
    actionText: 'Adicionar números',
    description: 'Numere páginas escolhendo posição, formato e tamanho.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: { position: 'bottom-center', format: 'n', start: 1, fontSize: 11, margin: 'medium', pages: '' },
    fields: [
      {
        key: 'position',
        label: 'Posição',
        type: 'select',
        options: [
          { value: 'bottom-center', label: 'Rodapé — centro' },
          { value: 'bottom-right', label: 'Rodapé — direita' },
          { value: 'bottom-left', label: 'Rodapé — esquerda' },
          { value: 'top-center', label: 'Cabeçalho — centro' },
          { value: 'top-right', label: 'Cabeçalho — direita' },
          { value: 'top-left', label: 'Cabeçalho — esquerda' },
        ],
      },
      {
        key: 'format',
        label: 'Formato',
        type: 'select',
        options: [
          { value: 'n', label: '1, 2, 3…' },
          { value: 'page-n', label: 'Página 1' },
          { value: 'n-of-total', label: '1 de 10' },
        ],
      },
      {
        key: 'margin',
        label: 'Margem',
        type: 'segmented',
        options: [
          { value: 'small', label: 'Pequena' },
          { value: 'medium', label: 'Média' },
          { value: 'large', label: 'Grande' },
        ],
      },
      { key: 'start', label: 'Primeiro número', type: 'number', min: 0, step: 1 },
      { key: 'fontSize', label: 'Tamanho da fonte', type: 'number', min: 6, max: 48, step: 1, unit: 'pt' },
      PAGES_FIELD,
    ],
    run: (files, o, ctx) =>
      perFile(files, ctx, (f) =>
        pageNumbersPdf(f, {
          position: s(o, 'position') as NumberPosition,
          format: s(o, 'format') as 'n' | 'page-n' | 'n-of-total',
          start: n(o, 'start'),
          fontSize: n(o, 'fontSize'),
          margin: { small: 18, medium: 32, large: 54 }[s(o, 'margin') as 'small' | 'medium' | 'large'] ?? 32,
          pages: s(o, 'pages'),
        }),
      ),
  },
  {
    id: 'watermark',
    name: 'Marca d’água',
    category: 'Editar PDF',
    glyph: '≋',
    color: C.edit,
    actionText: 'Adicionar marca d’água',
    description: 'Carimbe um texto sobre o PDF, com cor, opacidade e ângulo.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: { text: 'CONFIDENCIAL', fontSize: 54, opacity: 0.25, angle: 45, color: '#E5322D', layout: 'center', pages: '' },
    fields: [
      { key: 'text', label: 'Texto', type: 'text', placeholder: 'CONFIDENCIAL' },
      {
        key: 'layout',
        label: 'Disposição',
        type: 'segmented',
        options: [
          { value: 'center', label: 'Centro' },
          { value: 'tile', label: 'Mosaico' },
        ],
      },
      { key: 'fontSize', label: 'Tamanho', type: 'number', min: 8, max: 200, step: 2, unit: 'pt' },
      { key: 'opacity', label: 'Opacidade', type: 'slider', min: 0.05, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
      { key: 'angle', label: 'Ângulo', type: 'slider', min: -90, max: 90, step: 15, format: (v) => `${v}°` },
      { key: 'color', label: 'Cor', type: 'color' },
      PAGES_FIELD,
    ],
    run: (files, o, ctx) =>
      perFile(files, ctx, (f) =>
        watermarkPdf(f, {
          text: s(o, 'text'),
          fontSize: n(o, 'fontSize'),
          opacity: n(o, 'opacity'),
          angle: n(o, 'angle'),
          color: s(o, 'color'),
          layout: s(o, 'layout') as 'center' | 'tile',
          pages: s(o, 'pages'),
        }),
      ),
  },
  {
    id: 'crop',
    name: 'Recortar PDF',
    category: 'Editar PDF',
    glyph: '⌗',
    color: C.edit,
    actionText: 'Recortar PDF',
    description: 'Recorte as margens das páginas.',
    accepts: 'pdf',
    multiple: false,
    status: 'ready',
    defaults: { top: 10, right: 10, bottom: 10, left: 10, pages: '' },
    fields: [
      { key: 'top', label: 'Superior', type: 'number', min: 0, step: 1, unit: 'mm' },
      { key: 'right', label: 'Direita', type: 'number', min: 0, step: 1, unit: 'mm' },
      { key: 'bottom', label: 'Inferior', type: 'number', min: 0, step: 1, unit: 'mm' },
      { key: 'left', label: 'Esquerda', type: 'number', min: 0, step: 1, unit: 'mm' },
      PAGES_FIELD,
    ],
    run: (files, o, ctx) =>
      perFile(files, ctx, (f) =>
        cropPdf(f, { top: n(o, 'top'), right: n(o, 'right'), bottom: n(o, 'bottom'), left: n(o, 'left'), pages: s(o, 'pages') }),
      ),
  },
  {
    id: 'edit',
    name: 'Editar PDF',
    category: 'Editar PDF',
    glyph: '✎',
    color: C.edit,
    actionText: 'Abrir editor',
    description: 'Texto, imagens, formas, caneta, marca-texto, corretor e assinatura sobre o PDF.',
    accepts: 'pdf',
    multiple: false,
    status: 'ready',
    custom: 'editor',
    defaults: {},
  },

  // ----- Segurança do PDF -----
  {
    id: 'unlock',
    name: 'Desbloquear PDF',
    category: 'Segurança do PDF',
    glyph: '🔓︎',
    color: C.security,
    actionText: 'Desbloquear PDF',
    description: 'Remova a senha de PDFs dos quais você conhece a senha.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: {},
    run: (files, _o, ctx) => perFile(files, ctx, (f) => unlockPdf(f)),
  },
  {
    id: 'protect',
    name: 'Proteger PDF',
    category: 'Segurança do PDF',
    glyph: '🔒︎',
    color: C.security,
    actionText: 'Proteger PDF',
    description: 'Criptografe PDFs com senha.',
    accepts: 'pdf',
    multiple: true,
    status: 'ready',
    defaults: { password: '', confirm: '', allowPrinting: true, allowCopying: false },
    fields: [
      { key: 'password', label: 'Senha', type: 'password' },
      { key: 'confirm', label: 'Repita a senha', type: 'password' },
      { key: 'allowPrinting', label: 'Permitir impressão', type: 'checkbox' },
      { key: 'allowCopying', label: 'Permitir copiar texto', type: 'checkbox' },
    ],
    run: (files, o, ctx) =>
      perFile(files, ctx, (f) =>
        protectPdf(f, {
          password: s(o, 'password'),
          confirm: s(o, 'confirm'),
          allowPrinting: b(o, 'allowPrinting'),
          allowCopying: b(o, 'allowCopying'),
        }),
      ),
  },
  planned('sign', 'Assinar PDF', 'Segurança do PDF', '✍', C.security, 'Assine com assinatura eletrônica ou certificado.', 'Assinatura desenhada/imagem e certificado digital (PAdES) — próximo lote.'),
  planned('redact', 'Ocultar dados (tarja)', 'Segurança do PDF', '▬', C.security, 'Remova permanentemente informações sensíveis.', 'Tarja segura exige remover o conteúdo sob a área, não só cobri-lo — próximo lote.'),
  {
    id: 'compare',
    name: 'Comparar PDF',
    category: 'Segurança do PDF',
    glyph: '⇆',
    color: C.security,
    actionText: 'Gerar relatório',
    description: 'Compare o texto de duas versões e destaque as mudanças.',
    accepts: 'pdf',
    multiple: true,
    exactFiles: 2,
    status: 'ready',
    defaults: {},
    run: async (files, _o, ctx) => {
      ctx.progress(0.1, 'Extraindo texto do original');
      const a = await extractPageTexts(files[0].bytes, files[0].password);
      ctx.progress(0.5, 'Extraindo texto da revisão');
      const bTexts = await extractPageTexts(files[1].bytes, files[1].password);
      const result = comparePageTexts(a, bTexts, files[0].name, files[1].name);
      const name = `comparacao_${files[0].name.replace(/\.pdf$/i, '')}.html`;
      return [{ name, bytes: new TextEncoder().encode(result.html), mime: 'text/html' }];
    },
  },
];

function planned(
  id: string,
  name: string,
  category: ToolDef['category'],
  glyph: string,
  color: string,
  description: string,
  plannedReason: string,
): ToolDef {
  return {
    id,
    name,
    category,
    glyph,
    color,
    actionText: name,
    description,
    accepts: category === 'Converter para PDF' ? 'office' : 'pdf',
    multiple: true,
    status: 'planned',
    plannedReason,
    defaults: {},
  };
}

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
