// Estado persistente (recentes, uso de ferramentas, histórico). Espelha as tabelas
// Document/Tool/History do original, gravadas em JSON no userData (desktop) ou localStorage (web).
import { useSyncExternalStore } from 'react';
import { loadStore, persistStore } from '../platform/platform';
import type { Provider } from '../ai/bridge';
import { DEFAULT_LEXICON } from '../ai/lexicon';

export interface AiSettings {
  models: Record<Provider, string>;
  modes: Record<Provider | 'notebooklm', 'api' | 'site'>;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  transcribeModel: string;
  lexicon: string;
  driveFolder: string;
  plaudFolder: string;
}

export const DEFAULT_AI: AiSettings = {
  // Claude: padrão oficial. Demais: escolher em Configurações → "Listar modelos" (IDs mudam com frequência).
  models: { claude: 'claude-opus-5-5', gpt: '', grok: '', gemini: '' },
  modes: { claude: 'api', gpt: 'api', grok: 'api', gemini: 'api', notebooklm: 'site' },
  effort: 'high',
  transcribeModel: 'whisper-1',
  lexicon: DEFAULT_LEXICON,
  driveFolder: '',
  plaudFolder: '',
};

export interface LauncherItem {
  id: string;
  name: string;
  /** URL (abre na aba Navegador) ou destino interno "app:<aba>" (ex.: app:claude, app:oncoglobal). */
  target: string;
  color: string;
}

export interface UiSettings {
  appName: string;
  accent: string;
  density: 'compact' | 'normal';
  radius: number;
  fontSize: number;
  cardSize: 'small' | 'medium';
  sidebarCollapsed: boolean;
  hiddenNav: string[];
  launcher: LauncherItem[];
  favorites: { name: string; url: string }[];
  homeUrl: string;
  oncoglobalUrl: string;
}

export const DEFAULT_UI: UiSettings = {
  appName: 'Browser IA OncoGlobal',
  accent: '#E5322D',
  density: 'compact',
  radius: 10,
  fontSize: 14,
  cardSize: 'small',
  sidebarCollapsed: false,
  hiddenNav: [],
  launcher: [
    { id: 'l-claude', name: 'Claude', target: 'app:claude', color: '#D97757' },
    { id: 'l-gpt', name: 'GPT', target: 'app:gpt', color: '#10A37F' },
    { id: 'l-gemini', name: 'Gemini', target: 'app:gemini', color: '#4285F4' },
    { id: 'l-grok', name: 'Grok', target: 'app:grok', color: '#9AA0A6' },
    { id: 'l-nblm', name: 'NotebookLM', target: 'app:notebooklm', color: '#1A73E8' },
    { id: 'l-onco', name: 'OncoGlobal', target: 'app:oncoglobal', color: '#0F9D8A' },
    { id: 'l-yt', name: 'YouTube', target: 'https://www.youtube.com/', color: '#FF0000' },
    { id: 'l-drive', name: 'Drive', target: 'https://drive.google.com/', color: '#1FA463' },
    { id: 'l-pubmed', name: 'PubMed', target: 'https://pubmed.ncbi.nlm.nih.gov/', color: '#20558A' },
  ],
  favorites: [
    { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { name: 'NCCN', url: 'https://www.nccn.org/guidelines/category_1' },
  ],
  homeUrl: 'https://www.google.com/',
  oncoglobalUrl: 'http://127.0.0.1:5173/',
};

export interface RecentFile {
  key: string;
  name: string;
  path: string | null;
  size: number;
  openedAt: number;
  thumb: string | null;
}

export interface HistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  at: number;
  durationMs: number;
  inputs: string[];
  outputs: { name: string; path: string | null; size: number }[];
  status: 'ok' | 'error';
  error?: string;
}

export interface AppState {
  version: 1;
  recents: RecentFile[];
  toolUsage: Record<string, { count: number; lastUse: number }>;
  history: HistoryEntry[];
  settings: { theme: 'dark' | 'light'; ai: AiSettings; ui: UiSettings };
}

const MAX_RECENTS = 24;
const MAX_HISTORY = 200;

let state: AppState = { version: 1, recents: [], toolUsage: {}, history: [], settings: { theme: 'dark', ai: DEFAULT_AI, ui: DEFAULT_UI } };
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function set(next: AppState) {
  state = next;
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persistStore(state), 300);
}

export async function hydrate() {
  const saved = await loadStore<AppState>();
  if (saved && saved.version === 1) {
    const ai = { ...DEFAULT_AI, ...saved.settings?.ai };
    ai.models = { ...DEFAULT_AI.models, ...saved.settings?.ai?.models };
    ai.modes = { ...DEFAULT_AI.modes, ...saved.settings?.ai?.modes };
    const ui = { ...DEFAULT_UI, ...saved.settings?.ui };
    state = { ...state, ...saved, settings: { ...state.settings, ...saved.settings, ai, ui } };
    listeners.forEach((l) => l());
  }
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const getState = () => state;

export function addRecent(file: Omit<RecentFile, 'key' | 'openedAt'>) {
  const key = file.path ?? `mem:${file.name}:${file.size}`;
  const prev = state.recents.find((r) => r.key === key);
  const entry: RecentFile = { ...file, thumb: file.thumb ?? prev?.thumb ?? null, key, openedAt: Date.now() };
  set({ ...state, recents: [entry, ...state.recents.filter((r) => r.key !== key)].slice(0, MAX_RECENTS) });
}

export function removeRecent(key: string) {
  set({ ...state, recents: state.recents.filter((r) => r.key !== key) });
}

export function clearRecents() {
  set({ ...state, recents: [] });
}

export function markToolUsed(toolId: string) {
  const u = state.toolUsage[toolId] ?? { count: 0, lastUse: 0 };
  set({ ...state, toolUsage: { ...state.toolUsage, [toolId]: { count: u.count + 1, lastUse: Date.now() } } });
}

export function addHistory(entry: Omit<HistoryEntry, 'id'>): string {
  const id = `${entry.at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  set({ ...state, history: [{ ...entry, id }, ...state.history].slice(0, MAX_HISTORY) });
  return id;
}

/** Registra onde os resultados de uma tarefa foram gravados (para "Mostrar na pasta"). */
export function attachSavedPaths(historyId: string, paths: string[]) {
  set({
    ...state,
    history: state.history.map((h) =>
      h.id === historyId ? { ...h, outputs: h.outputs.map((o, i) => ({ ...o, path: paths[i] ?? paths[0] ?? o.path })) } : h,
    ),
  });
}

export function clearHistory() {
  set({ ...state, history: [] });
}

export function setTheme(theme: 'dark' | 'light') {
  set({ ...state, settings: { ...state.settings, theme } });
}

export function setAi(patch: Partial<AiSettings>) {
  set({ ...state, settings: { ...state.settings, ai: { ...state.settings.ai, ...patch } } });
}

export function setUi(patch: Partial<UiSettings>) {
  set({ ...state, settings: { ...state.settings, ui: { ...state.settings.ui, ...patch } } });
}

export function resetUi() {
  set({ ...state, settings: { ...state.settings, ui: DEFAULT_UI } });
}
