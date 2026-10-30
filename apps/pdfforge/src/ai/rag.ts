// Memo-RAG local: fragmentação de texto e busca lexical BM25 (sem embeddings, funciona offline).
export interface Chunk {
  id: string;
  docId: string;
  text: string;
  page?: number;
}

export interface PageText {
  page?: number;
  text: string;
}

const STOP = new Set(
  (
    'a o as os um uma uns umas de do da dos das em no na nos nas por para pelo pela pelos pelas com sem sob sobre entre ' +
    'e ou mas que se como mais menos muito muita já não sim ao aos à às é são foi ser ter tem há isso este esta esse essa ' +
    'the of and or to in on for with by is are was be this that it as at from an'
  ).split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Divide páginas em trechos de ~size caracteres, respeitando parágrafos, com sobreposição. */
export function chunkPages(docId: string, pages: PageText[], size = 1200, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  for (const p of pages) {
    const text = p.text.replace(/[ \t]+/g, ' ').trim();
    if (!text) continue;
    if (text.length <= size) {
      chunks.push({ id: `${docId}:${chunks.length}`, docId, text, page: p.page });
      continue;
    }
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + size);
      if (end < text.length) {
        const cut = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end));
        if (cut > start + size * 0.5) end = cut + 1;
      }
      chunks.push({ id: `${docId}:${chunks.length}`, docId, text: text.slice(start, end).trim(), page: p.page });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return chunks;
}

export interface Hit {
  chunk: Chunk;
  score: number;
}

/** BM25 (k1=1.2, b=0.75) sobre os trechos fornecidos. */
export function searchBM25(query: string, chunks: Chunk[], k = 8): Hit[] {
  const q = [...new Set(tokenize(query))];
  if (!q.length || !chunks.length) return [];
  const docs = chunks.map((c) => tokenize(c.text));
  const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const hits: Hit[] = [];
  docs.forEach((d, i) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += (idf * f * 2.2) / (f + 1.2 * (1 - 0.75 + (0.75 * d.length) / avg));
    }
    if (score > 0) hits.push({ chunk: chunks[i], score });
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}

/** Monta o contexto numerado [1], [2]… para a resposta com citações. */
export function buildContext(hits: Hit[], titleOf: (docId: string) => string): string {
  return hits
    .map((h, i) => `[${i + 1}] ${titleOf(h.chunk.docId)}${h.chunk.page ? `, p. ${h.chunk.page}` : ''}\n${h.chunk.text}`)
    .join('\n\n');
}

export const RAG_SYSTEM =
  'Responda em português usando SOMENTE os trechos numerados da biblioteca. Cite as fontes como [n] após cada afirmação. ' +
  'Se os trechos não contiverem a resposta, diga claramente que a biblioteca não tem essa informação. Não invente dados.';
