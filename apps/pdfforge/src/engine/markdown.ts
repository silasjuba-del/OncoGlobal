// PDF → Markdown: reconstrói linhas pela posição dos trechos de texto e infere títulos pelo tamanho da fonte.
export interface TextRun {
  str: string;
  x: number;
  /** Base da linha em pontos (origem embaixo, como no PDF). */
  y: number;
  size: number;
  bold?: boolean;
}

interface Line {
  y: number;
  size: number;
  text: string;
  bold: boolean;
}

function toLines(runs: TextRun[]): Line[] {
  const sorted = runs.filter((r) => r.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; runs: TextRun[] }[] = [];
  for (const r of sorted) {
    const tol = Math.max(2, r.size * 0.35);
    const line = lines.find((l) => Math.abs(l.y - r.y) <= tol);
    if (line) line.runs.push(r);
    else lines.push({ y: r.y, runs: [r] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      const runs = l.runs.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEnd = -Infinity;
      for (const r of runs) {
        const gap = r.x - prevEnd;
        if (text && gap > r.size * 0.15 && !text.endsWith(' ') && !r.str.startsWith(' ')) text += ' ';
        text += r.str;
        prevEnd = r.x + r.str.length * r.size * 0.5;
      }
      const size = Math.max(...runs.map((r) => r.size));
      return { y: l.y, size, text: text.replace(/\s+/g, ' ').trim(), bold: runs.every((r) => r.bold) };
    });
}

function median(nums: number[]): number {
  if (!nums.length) return 10;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const BULLET = /^([•▪◦●○■□\-–—*]|\d{1,3}[.)]|[a-z][.)])\s+/i;

/** Converte páginas (trechos com posição e tamanho) em Markdown com títulos, listas e parágrafos. */
export function pagesToMarkdown(pages: TextRun[][], title?: string): string {
  const all = pages.map(toLines);
  const body = median(all.flat().map((l) => Math.round(l.size * 2) / 2));
  const out: string[] = title ? [`# ${title}`, ''] : [];
  all.forEach((lines, pi) => {
    if (pages.length > 1) out.push(`<!-- página ${pi + 1} -->`);
    let para: string[] = [];
    let lastY: number | null = null;
    const flush = () => {
      if (para.length) out.push(para.join(' ').replace(/(\w)- (\w)/g, '$1$2'), '');
      para = [];
    };
    for (const l of lines) {
      const gap = lastY === null ? 0 : lastY - l.y;
      lastY = l.y;
      const ratio = l.size / body;
      const short = l.text.length < 90;
      if (ratio >= 1.45 && short) {
        flush();
        out.push(`## ${l.text}`, '');
        continue;
      }
      if ((ratio >= 1.15 || (l.bold && ratio >= 0.98)) && short && !/[.:;,]$/.test(l.text)) {
        flush();
        out.push(`### ${l.text}`, '');
        continue;
      }
      if (BULLET.test(l.text)) {
        flush();
        out.push(`- ${l.text.replace(BULLET, '')}`);
        continue;
      }
      if (gap > l.size * 1.8) flush();
      para.push(l.text);
    }
    flush();
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
