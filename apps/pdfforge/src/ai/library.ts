// Biblioteca Memo-RAG: documentos fragmentados, anotações por página e prompts/skills do usuário.
// Persistida em userData/pdfforge-library.json (desktop) ou localStorage (navegador).
import { useSyncExternalStore } from 'react';
import { loadLibraryRaw, saveLibraryRaw } from './bridge';
import { BUILTIN_PROMPTS, BUILTIN_SKILLS, type PromptTemplate } from './prompts';
import { chunkPages, searchBM25, type Chunk, type Hit, type PageText } from './rag';

export type DocKind = 'pdf' | 'resposta' | 'transcricao' | 'youtube' | 'reels' | 'plaud' | 'word' | 'nota' | 'texto';

export interface LibDoc {
  id: string;
  title: string;
  kind: DocKind;
  source?: string;
  createdAt: number;
  chars: number;
  chunks: Chunk[];
}

export interface Annotation {
  id: string;
  docKey: string;
  docName: string;
  page: number;
  text: string;
  source: 'user' | 'ai';
  createdAt: number;
}

export interface LibraryState {
  version: 1;
  docs: LibDoc[];
  annotations: Annotation[];
  prompts: PromptTemplate[];
}

let state: LibraryState = { version: 1, docs: [], annotations: [], prompts: [] };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let hydrated = false;

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function set(next: LibraryState) {
  state = next;
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => void saveLibraryRaw(state), 400);
}

export async function hydrateLibrary() {
  if (hydrated) return;
  hydrated = true;
  const saved = (await loadLibraryRaw()) as LibraryState | null;
  if (saved?.version === 1) {
    state = { version: 1, docs: saved.docs ?? [], annotations: saved.annotations ?? [], prompts: saved.prompts ?? [] };
    listeners.forEach((l) => l());
  }
}

export function useLibrary(): LibraryState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const getLibrary = () => state;

export function addDoc(title: string, kind: DocKind, pages: PageText[], source?: string): LibDoc {
  const id = uid();
  const chunks = chunkPages(id, pages);
  const doc: LibDoc = { id, title, kind, source, createdAt: Date.now(), chars: pages.reduce((s, p) => s + p.text.length, 0), chunks };
  set({ ...state, docs: [doc, ...state.docs] });
  return doc;
}

export function removeDoc(id: string) {
  set({ ...state, docs: state.docs.filter((d) => d.id !== id) });
}

export function searchLibrary(query: string, k = 8, docIds?: string[]): Hit[] {
  const docs = docIds?.length ? state.docs.filter((d) => docIds.includes(d.id)) : state.docs;
  return searchBM25(query, docs.flatMap((d) => d.chunks), k);
}

export const docTitle = (docId: string) => state.docs.find((d) => d.id === docId)?.title ?? 'documento';

export function docText(doc: LibDoc): string {
  return doc.chunks.map((c) => (c.page ? `[p. ${c.page}] ${c.text}` : c.text)).join('\n\n');
}

// ---------- anotações ----------

export function addAnnotation(a: Omit<Annotation, 'id' | 'createdAt'>): Annotation {
  const note = { ...a, id: uid(), createdAt: Date.now() };
  set({ ...state, annotations: [...state.annotations, note] });
  return note;
}

export function updateAnnotation(id: string, text: string) {
  set({ ...state, annotations: state.annotations.map((a) => (a.id === id ? { ...a, text } : a)) });
}

export function removeAnnotation(id: string) {
  set({ ...state, annotations: state.annotations.filter((a) => a.id !== id) });
}

/** Identidade por conteudo; notas legadas permanecem guardadas, sem atribuicao automatica. */
export async function docKeyOf(file: { name: string; path?: string | null; bytes: Uint8Array }): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(file.bytes));
  return `sha256:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- prompts e skills ----------

export function allTemplates(kind?: PromptTemplate['kind']): PromptTemplate[] {
  const builtin = [...BUILTIN_PROMPTS, ...BUILTIN_SKILLS].map((p) => ({ ...p, builtin: true }));
  // Um prompt do usuário com o mesmo id substitui o embutido (edição de prompt padrão).
  const overridden = new Set(state.prompts.map((p) => p.id));
  const list = [...state.prompts, ...builtin.filter((p) => !overridden.has(p.id))];
  return kind ? list.filter((p) => p.kind === kind) : list;
}

export function saveTemplate(t: Omit<PromptTemplate, 'id' | 'builtin'> & { id?: string }): PromptTemplate {
  const { builtin: _builtin, ...rest } = t as PromptTemplate;
  const tpl: PromptTemplate = { ...rest, id: t.id ?? `u-${uid()}` };
  set({ ...state, prompts: [tpl, ...state.prompts.filter((p) => p.id !== tpl.id)] });
  return tpl;
}

export function deleteTemplate(id: string) {
  set({ ...state, prompts: state.prompts.filter((p) => p.id !== id) });
}
