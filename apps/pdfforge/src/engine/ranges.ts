import { ToolError } from './types';

/**
 * Converte "1-3, 5, 8-" em grupos de índices 0-based, um grupo por item separado por vírgula.
 * "8-" vai até a última página; "-3" começa na primeira.
 */
export function parseRangeGroups(spec: string, total: number): number[][] {
  const parts = spec
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new ToolError('Informe ao menos um intervalo de páginas.');
  return parts.map((part) => {
    const m = part.match(/^(\d*)\s*(?:-\s*(\d*))?$/);
    if (!m || (m[1] === '' && m[2] === undefined)) throw new ToolError(`Intervalo inválido: "${part}"`);
    const isRange = part.includes('-');
    const start = m[1] === '' ? 1 : Number(m[1]);
    const end = isRange ? (m[2] === '' || m[2] === undefined ? total : Number(m[2])) : start;
    if (start < 1 || end < 1 || start > total || end > total) {
      throw new ToolError(`Intervalo "${part}" fora do documento (1–${total}).`);
    }
    if (start > end) throw new ToolError(`Intervalo "${part}" está invertido.`);
    return Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
  });
}

/** Lista única e ordenada de índices 0-based. */
export function parsePageList(spec: string, total: number): number[] {
  return [...new Set(parseRangeGroups(spec, total).flat())].sort((a, b) => a - b);
}

/** Converte índices 0-based em texto compacto 1-based ("1-3, 5"). */
export function formatPageList(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    out.push(start === sorted[i] ? `${start + 1}` : `${start + 1}-${sorted[i] + 1}`);
  }
  return out.join(', ');
}
