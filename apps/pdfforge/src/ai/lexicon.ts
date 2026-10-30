// Léxico de transcrição: vocabulário (contexto enviado ao motor) + regras "errado => certo" aplicadas depois.
import DEFAULT_LEXICON from './lexico-oncologia.txt?raw';

export { DEFAULT_LEXICON };

export interface Lexicon {
  terms: string[];
  rules: [string, string][];
}

export function parseLexicon(text: string): Lexicon {
  const terms: string[] = [];
  const rules: [string, string][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const rule = line.split(/\s*=>\s*/);
    if (rule.length === 2 && rule[0] && rule[1]) rules.push([rule[0], rule[1]]);
    else terms.push(line);
  }
  return { terms, rules };
}

/** Contexto para a transcrição (o motor aceita um prompt curto; limitamos a ~900 caracteres). */
export function transcriptionPrompt(lex: Lexicon, max = 900): string {
  let out = 'Consulta/aula de oncologia em português do Brasil. Termos: ';
  for (const t of lex.terms) {
    if (out.length + t.length + 2 > max) break;
    out += `${t}, `;
  }
  return out.replace(/, $/, '.');
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Aplica as correções como palavras inteiras, sem diferenciar maiúsculas e acentos no lado errado. */
export function applyLexicon(text: string, lex: Lexicon): string {
  let out = text;
  for (const [wrong, right] of lex.rules) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(wrong)}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, right);
  }
  return out;
}
