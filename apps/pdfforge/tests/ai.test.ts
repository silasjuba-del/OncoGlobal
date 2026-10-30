import { describe, expect, it } from 'vitest';
import { buildContext, chunkPages, searchBM25, tokenize } from '../src/ai/rag';
import { BUILTIN_PROMPTS, BUILTIN_SKILLS, fillTemplate, usesVar } from '../src/ai/prompts';
import { attachmentPages } from '../src/ai/attachments';

describe('páginas de anexo', () => {
  it('reconstrói páginas a partir dos marcadores [p. N]', () => {
    const pages = attachmentPages({ id: 'x', kind: 'doc', name: 'a.pdf', pages: 2, text: '[p. 1]\nUm\n\n[p. 2]\nDois [p. 9] no meio' });
    expect(pages).toEqual([
      { page: 1, text: 'Um\n' },
      { page: 2, text: 'Dois [p. 9] no meio' },
    ]);
    expect(attachmentPages({ id: 'y', kind: 'doc', name: 't', text: 'livre' })).toEqual([{ text: 'livre' }]);
  });
});

describe('tokenização', () => {
  it('remove acentos, maiúsculas e stopwords', () => {
    expect(tokenize('A Quimioterapia é indicada no Sarcoma de Ewing!')).toEqual(['quimioterapia', 'indicada', 'sarcoma', 'ewing']);
  });
});

describe('fragmentação', () => {
  it('mantém página, respeita tamanho e sobrepõe trechos', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Frase número ${i} sobre osteossarcoma e metotrexato.`).join(' ');
    const chunks = chunkPages('d1', [{ page: 3, text: long }, { page: 4, text: '' }, { page: 5, text: 'curto' }], 400, 60);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.text.length <= 400)).toBe(true);
    expect(chunks.filter((c) => c.page === 3).length).toBe(chunks.length - 1);
    expect(chunks.at(-1)).toMatchObject({ page: 5, text: 'curto' });
    expect(chunks.some((c) => c.page === 4)).toBe(false);
    // sobreposição: o início de um trecho repete o fim do anterior
    expect(chunks[0].text.includes(chunks[1].text.slice(0, 20))).toBe(true);
  });
});

describe('BM25', () => {
  const chunks = chunkPages('doc', [
    { page: 1, text: 'Osteossarcoma: esquema MAP com metotrexato em alta dose, doxorrubicina e cisplatina.' },
    { page: 2, text: 'Sarcoma de Ewing: esquema VDC/IE com compressão de intervalo.' },
    { page: 3, text: 'Condrossarcoma tem baixa resposta à quimioterapia; cirurgia é o pilar.' },
  ]);

  it('ranqueia o trecho mais relevante primeiro e ignora irrelevantes', () => {
    const hits = searchBM25('metotrexato alta dose osteossarcoma', chunks);
    expect(hits[0].chunk.page).toBe(1);
    expect(hits.find((h) => h.chunk.page === 3)).toBeUndefined();
  });

  it('é insensível a acentos e devolve vazio sem termos úteis', () => {
    expect(searchBM25('QUIMIOTERÁPIA condrossarcoma', chunks)[0].chunk.page).toBe(3);
    expect(searchBM25('de para com', chunks)).toEqual([]);
  });

  it('monta contexto numerado com título e página', () => {
    const ctx = buildContext(searchBM25('Ewing', chunks), () => 'Diretriz');
    expect(ctx.startsWith('[1] Diretriz, p. 2\n')).toBe(true);
  });
});

describe('templates', () => {
  it('há 10+ prompts operacionais e skills, com ids únicos', () => {
    expect(BUILTIN_PROMPTS.length).toBeGreaterThanOrEqual(10);
    const ids = [...BUILTIN_PROMPTS, ...BUILTIN_SKILLS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BUILTIN_PROMPTS.filter((p) => usesVar(p.template, 'documento')).length).toBeGreaterThanOrEqual(10);
    expect(BUILTIN_SKILLS.every((s) => usesVar(s.template, 'selecao'))).toBe(true);
  });

  it('preenche variáveis e remove as ausentes', () => {
    const out = fillTemplate('Tarefa: {{entrada}}\n\n\n\n--- {{titulo}} ---\n{{documento}}', { documento: 'texto', titulo: 'T' });
    expect(out).toBe('Tarefa:\n\n--- T ---\ntexto');
  });
});
