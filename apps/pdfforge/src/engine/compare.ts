// Comparação semântica de texto entre duas versões de um PDF (relatório HTML autocontido).
import { diffWords } from 'diff';

export interface PageDiff {
  page: number;
  added: number;
  removed: number;
  html: string;
}

export interface CompareResult {
  pages: PageDiff[];
  totalAdded: number;
  totalRemoved: number;
  html: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function comparePageTexts(a: string[], b: string[], nameA: string, nameB: string): CompareResult {
  const pages: PageDiff[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const parts = diffWords(a[i] ?? '', b[i] ?? '');
    let added = 0;
    let removed = 0;
    const html = parts
      .map((p) => {
        const words = p.value.trim() ? p.value.trim().split(/\s+/).length : 0;
        if (p.added) {
          added += words;
          return `<ins>${esc(p.value)}</ins>`;
        }
        if (p.removed) {
          removed += words;
          return `<del>${esc(p.value)}</del>`;
        }
        return esc(p.value);
      })
      .join('');
    pages.push({ page: i + 1, added, removed, html });
  }
  const totalAdded = pages.reduce((s, p) => s + p.added, 0);
  const totalRemoved = pages.reduce((s, p) => s + p.removed, 0);
  const changed = pages.filter((p) => p.added || p.removed);
  const body = changed.length
    ? changed
        .map(
          (p) =>
            `<section><h2>Página ${p.page} <small>+${p.added} / −${p.removed} palavras</small></h2><pre>${p.html}</pre></section>`,
        )
        .join('')
    : '<p class="same">Nenhuma diferença de texto encontrada.</p>';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comparação de PDF</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#161616;background:#f5f5fa}
h1{font-size:20px}h2{font-size:15px;margin:0 0 8px}small{color:#707078;font-weight:400}
section{background:#fff;border-radius:8px;padding:16px;margin:12px 0;box-shadow:0 1px 3px #0001}
pre{white-space:pre-wrap;font:inherit;margin:0}ins{background:#d4f5e2;color:#0b6b37;text-decoration:none}
del{background:#ffe0de;color:#b3261e}.meta{color:#5c5c64}.same{padding:16px;background:#fff;border-radius:8px}</style></head>
<body><h1>Comparação de texto</h1><p class="meta">Original: <b>${esc(nameA)}</b> (${a.length} pág.) · Revisado: <b>${esc(nameB)}</b> (${b.length} pág.)<br>
Total: <ins>+${totalAdded}</ins> palavras adicionadas, <del>−${totalRemoved}</del> removidas, em ${changed.length} página(s).</p>${body}
<p class="meta">Comparação apenas do texto extraível; imagens e layout não são avaliados.</p></body></html>`;
  return { pages, totalAdded, totalRemoved, html };
}
