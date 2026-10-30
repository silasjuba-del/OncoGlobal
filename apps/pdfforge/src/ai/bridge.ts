// Ponte tipada para IA e plugins. No Electron usa window.pdfforge.ai/plugins (processo principal).
// No navegador só funciona o modo simulado (localStorage "pdfforge-mock-llm" = "1"), usado em testes de interface.
export type Provider = 'claude' | 'gpt' | 'grok' | 'gemini';

export const PROVIDERS: { id: Provider; name: string; vendor: string; site: string; color: string }[] = [
  { id: 'claude', name: 'Claude', vendor: 'Anthropic', site: 'https://claude.ai/new', color: '#D97757' },
  { id: 'gpt', name: 'GPT', vendor: 'OpenAI', site: 'https://chatgpt.com/', color: '#10A37F' },
  { id: 'grok', name: 'Grok', vendor: 'xAI', site: 'https://grok.com/', color: '#9AA0A6' },
  { id: 'gemini', name: 'Gemini', vendor: 'Google', site: 'https://gemini.google.com/app', color: '#4285F4' },
];

export const providerInfo = (p: Provider) => PROVIDERS.find((x) => x.id === p)!;

export type ChatBlock = { type: 'text'; text: string } | { type: 'image'; mediaType: string; data: string };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: ChatBlock[];
}

export interface ChatRequest {
  provider: Provider;
  model: string;
  system?: string;
  messages: ChatMessage[];
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
}

export interface ChatResult {
  text: string;
  stopReason: string | null;
  model: string;
  note?: string;
}

export type KeyStatus = Record<Provider, 'saved' | 'env' | 'missing'>;

export interface FolderFile {
  name: string;
  path: string;
  kind: 'pdf' | 'docx' | 'text' | 'audio';
  size: number;
  mtime: number;
}

export interface FolderFileContent {
  name: string;
  path: string;
  kind: 'pdf' | 'docx' | 'text' | 'audio';
  text?: string;
  bytes?: Uint8Array;
}

export interface YoutubeTranscript {
  id: string;
  title: string;
  language: string;
  automatic: boolean;
  url: string;
  text: string;
}

type Wrapped<T> = { ok: true; value: T } | { ok: false; error: string };

interface AiBridge {
  chat(requestId: string, req: ChatRequest): Promise<({ ok: true } & ChatResult) | { ok: false; error: string }>;
  abort(requestId: string): Promise<void>;
  onEvent(cb: (requestId: string, payload: { type: 'delta'; text: string }) => void): () => void;
  models(provider: Provider): Promise<{ ok: true; models: string[] } | { ok: false; error: string }>;
  keyStatus(): Promise<KeyStatus>;
  setKey(provider: Provider, value: string): Promise<KeyStatus>;
  transcribe(payload: { bytes: Uint8Array; name: string; model?: string; language?: string; prompt?: string }): Promise<Wrapped<{ text: string }>>;
  transcribePath(path: string, opts: { model?: string; language?: string; prompt?: string }): Promise<Wrapped<{ text: string }>>;
  youtube(url: string): Promise<Wrapped<YoutubeTranscript>>;
  reels(url: string): Promise<Wrapped<{ url: string; title: string | null; description: string | null; loginWall: boolean }>>;
}

interface PluginsBridge {
  wordExport(payload: { name: string; title?: string; markdown: string }): Promise<Wrapped<string | null>>;
  wordImport(): Promise<Wrapped<{ name: string; path: string; text: string }[]>>;
  detectDrive(): Promise<Wrapped<string | null>>;
  pickFolder(title: string): Promise<Wrapped<string | null>>;
  listFolder(dir: string): Promise<Wrapped<FolderFile[]>>;
  readFolderFile(path: string): Promise<Wrapped<FolderFileContent>>;
  writeFolderFile(dir: string, name: string, content: string | Uint8Array, asDocx?: boolean): Promise<Wrapped<string>>;
  whatsapp(text: string): Promise<Wrapped<'desktop' | 'web'>>;
  libraryGet(): Promise<unknown>;
  librarySet(value: unknown): Promise<boolean>;
}

const ai = (): AiBridge | undefined => (window.pdfforge as unknown as { ai?: AiBridge } | undefined)?.ai;
const plugins = (): PluginsBridge | undefined => (window.pdfforge as unknown as { plugins?: PluginsBridge } | undefined)?.plugins;

export const hasDesktopAi = () => Boolean(ai());
const browserMock = () => {
  try {
    return localStorage.getItem('pdfforge-mock-llm') === '1';
  } catch {
    return false;
  }
};
export const aiAvailable = () => hasDesktopAi() || browserMock();

const DESKTOP_ONLY = 'Disponível no app desktop (npm run dev). No navegador a IA não tem acesso seguro às chaves.';

async function unwrap<T>(p: Promise<Wrapped<T>> | undefined): Promise<T> {
  if (!p) throw new Error(DESKTOP_ONLY);
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

let seq = 0;

/** Envia uma conversa com streaming. onDelta recebe cada trecho; abort() cancela. */
export function chatStream(req: ChatRequest, onDelta: (text: string) => void): { done: Promise<ChatResult>; abort(): void } {
  const id = `r${Date.now().toString(36)}-${++seq}`;
  const bridge = ai();
  if (!bridge) {
    if (!browserMock()) return { done: Promise.reject(new Error(DESKTOP_ONLY)), abort: () => {} };
    let stopped = false;
    const done = (async () => {
      const last = req.messages[req.messages.length - 1];
      const input = last.content.map((b) => (b.type === 'text' ? b.text : '[imagem]')).join(' ');
      const reply = `**[simulado ${req.provider}/${req.model || 'padrão'}]**\n\n- Mensagens: ${req.messages.length}\n- Sistema: ${req.system ? 'sim' : 'não'}\n- Entrada: "${input.slice(0, 140).replace(/\s+/g, ' ')}"\n\n\`\`\`html\n<!doctype html><title>app</title><h1>App simulado</h1>\n\`\`\``;
      for (const w of reply.split(/(?<=\s)/)) {
        if (stopped) throw new Error('Cancelado.');
        onDelta(w);
        await new Promise((r) => setTimeout(r, 3));
      }
      return { text: reply, stopReason: 'end_turn', model: req.model || 'mock' };
    })();
    return { done, abort: () => (stopped = true) };
  }
  const off = bridge.onEvent((rid, payload) => {
    if (rid === id && payload.type === 'delta') onDelta(payload.text);
  });
  const done = bridge
    .chat(id, req)
    .then((r) => {
      if (!r.ok) throw new Error(r.error);
      return { text: r.text, stopReason: r.stopReason, model: r.model, note: r.note };
    })
    .finally(off);
  return { done, abort: () => void bridge.abort(id) };
}

export async function listModels(provider: Provider): Promise<string[]> {
  const b = ai();
  if (!b) {
    if (browserMock()) return [`mock-${provider}-1`];
    throw new Error(DESKTOP_ONLY);
  }
  const r = await b.models(provider);
  if (!r.ok) throw new Error(r.error);
  return r.models;
}

export async function keyStatus(): Promise<KeyStatus | null> {
  return ai()?.keyStatus() ?? (browserMock() ? { claude: 'env', gpt: 'env', grok: 'env', gemini: 'env' } : null);
}

export async function setKey(provider: Provider, value: string): Promise<KeyStatus> {
  const b = ai();
  if (!b) throw new Error(DESKTOP_ONLY);
  return b.setKey(provider, value);
}

export const transcribe = (bytes: Uint8Array, name: string, model?: string, prompt?: string) => {
  if (!ai() && browserMock()) return Promise.resolve({ text: `[transcrição simulada de ${name}] pembrolizumab e pet ct` });
  return unwrap(ai()?.transcribe({ bytes, name, model, language: 'pt', prompt }));
};
export const transcribePath = (path: string, model?: string, prompt?: string) =>
  unwrap(ai()?.transcribePath(path, { model, language: 'pt', prompt }));
export const youtubeTranscript = (url: string) => unwrap(ai()?.youtube(url));
export const reelsMeta = (url: string) => unwrap(ai()?.reels(url));

export const wordExport = (name: string, markdown: string, title?: string) => unwrap(plugins()?.wordExport({ name, title, markdown }));
export const wordImport = () => unwrap(plugins()?.wordImport());
export const detectDrive = () => unwrap(plugins()?.detectDrive());
export const pickFolder = (title: string) => unwrap(plugins()?.pickFolder(title));
export const listFolder = (dir: string) => unwrap(plugins()?.listFolder(dir));
export const readFolderFile = (path: string) => unwrap(plugins()?.readFolderFile(path));
export const writeFolderFile = (dir: string, name: string, content: string | Uint8Array, asDocx = false) =>
  unwrap(plugins()?.writeFolderFile(dir, name, content, asDocx));

export async function shareWhatsApp(text: string): Promise<'desktop' | 'web'> {
  const p = plugins();
  if (p) return unwrap(p.whatsapp(text));
  window.open(`https://wa.me/?text=${encodeURIComponent(text.slice(0, 3500))}`, '_blank', 'noopener');
  return 'web';
}

const LIB_KEY = 'pdfforge-library';

export async function loadLibraryRaw(): Promise<unknown> {
  const p = plugins();
  if (p) return p.libraryGet();
  try {
    const raw = localStorage.getItem(LIB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveLibraryRaw(value: unknown): Promise<void> {
  const p = plugins();
  if (p) {
    await p.librarySet(value);
    return;
  }
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(value));
  } catch {
    // Armazenamento cheio/indisponível no navegador: segue sem persistir.
  }
}

// ---------- Navegador interno e captura de tela ----------

interface WebBridge {
  toPdf(url: string): Promise<Wrapped<{ title: string; text: string; bytes: Uint8Array }>>;
  onOpen(cb: (url: string) => void): () => void;
}

interface CaptureBridge {
  sources(): Promise<{ id: string; name: string; thumb: string }[]>;
  select(id: string): Promise<boolean>;
}

const web = (): WebBridge | undefined => (window.pdfforge as unknown as { web?: WebBridge } | undefined)?.web;
const capture = (): CaptureBridge | undefined => (window.pdfforge as unknown as { capture?: CaptureBridge } | undefined)?.capture;

/** Scraper → PDF: renderiza a URL numa janela oculta e devolve PDF + texto. */
export const urlToPdf = (url: string) => unwrap(web()?.toPdf(url));
export const onBrowserOpen = (cb: (url: string) => void) => web()?.onOpen(cb) ?? (() => {});

export async function captureSources() {
  const c = capture();
  if (!c) throw new Error('Captura de tela disponível no app desktop.');
  return c.sources();
}

/** Escolhe a fonte e abre o fluxo (vídeo + áudio do sistema no Windows). */
export async function openCaptureStream(sourceId: string, withAudio: boolean): Promise<MediaStream> {
  const c = capture();
  if (!c) throw new Error('Captura de tela disponível no app desktop.');
  await c.select(sourceId);
  return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: withAudio });
}
