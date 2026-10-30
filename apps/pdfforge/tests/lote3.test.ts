import { describe, expect, it } from 'vitest';
import { pagesToMarkdown, type TextRun } from '../src/engine/markdown';
import { applyLexicon, DEFAULT_LEXICON, parseLexicon, transcriptionPrompt } from '../src/ai/lexicon';
import { BUILTIN_PROMPTS } from '../src/ai/prompts';

const run = (str: string, y: number, size = 10, x = 50): TextRun => ({ str, x, y, size });

describe('PDF → Markdown', () => {
  it('infere títulos pelo tamanho, junta parágrafos e converte listas', () => {
    const md = pagesToMarkdown(
      [
        [
          run('Sarcomas ósseos', 780, 20),
          run('Tratamento sistêmico', 740, 13),
          run('O esquema MAP inclui metotrexato', 720),
          run('em alta dose e cisplatina.', 708),
          run('• Doxorrubicina', 680),
          run('• Cisplatina', 668),
          run('Fim', 600),
        ],
        [run('Segunda página', 780)],
      ],
      'Diretriz',
    );
    expect(md).toContain('# Diretriz');
    expect(md).toContain('## Sarcomas ósseos');
    expect(md).toContain('### Tratamento sistêmico');
    expect(md).toContain('O esquema MAP inclui metotrexato em alta dose e cisplatina.');
    expect(md).toContain('- Doxorrubicina\n- Cisplatina');
    expect(md).toContain('<!-- página 2 -->');
    expect(md.indexOf('Fim')).toBeGreaterThan(md.indexOf('- Cisplatina'));
  });

  it('une trechos da mesma linha na ordem horizontal', () => {
    const md = pagesToMarkdown([[run('dose', 700, 10, 120), run('Ajuste de', 700, 10, 50)]]);
    expect(md.trim()).toBe('Ajuste de dose');
  });
});

describe('léxico de transcrição', () => {
  it('separa termos e correções, ignora comentários', () => {
    const lex = parseLexicon('# comentário\nRECIST\npet ct => PET-CT\n\n  nivolumab  =>  nivolumabe ');
    expect(lex.terms).toEqual(['RECIST']);
    expect(lex.rules).toEqual([
      ['pet ct', 'PET-CT'],
      ['nivolumab', 'nivolumabe'],
    ]);
  });

  it('corrige palavras inteiras sem diferenciar maiúsculas', () => {
    const lex = parseLexicon('pembrolizumab => pembrolizumabe\npet ct => PET-CT');
    expect(applyLexicon('Iniciou Pembrolizumab após PET CT; pembrolizumabe mantido.', lex)).toBe(
      'Iniciou pembrolizumabe após PET-CT; pembrolizumabe mantido.',
    );
  });

  it('léxico padrão tem vocabulário oncológico e prompt dentro do limite', () => {
    const lex = parseLexicon(DEFAULT_LEXICON);
    expect(lex.terms).toContain('trastuzumabe deruxtecana');
    expect(lex.rules.length).toBeGreaterThan(5);
    const p = transcriptionPrompt(lex);
    expect(p.length).toBeLessThanOrEqual(900);
    expect(p).toContain('ECOG');
  });
});

describe('prompts do Lote 3', () => {
  it('inclui Foto → Prompt, Frames de exame e Reconciliar', () => {
    const ids = BUILTIN_PROMPTS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['foto-prompt', 'frames-exame', 'reconciliar']));
    expect(BUILTIN_PROMPTS.find((p) => p.id === 'frames-exame')!.template).toMatch(/não constitui laudo/);
  });
});
