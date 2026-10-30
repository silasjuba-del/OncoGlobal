// Camada de plataforma: Electron (via preload) ou navegador (fallback para desenvolvimento/testes).
export interface FilePayload {
  name: string;
  path?: string | null;
  bytes: Uint8Array;
}

export type OpenKind = 'pdf' | 'image' | 'any';
export type MenuChannel = 'menu:open' | 'menu:tools' | 'menu:about' | 'menu:newtab' | 'menu:palette' | 'menu:closetab';

interface ElectronBridge {
  exportarOncoGlobal?: (entrada: unknown) => Promise<{ ok: boolean; caminho?: string; codigo?: string; pacoteId?: string }>;
  openFiles(opts: { kind: OpenKind; multiple: boolean }): Promise<FilePayload[]>;
  readFile(path: string): Promise<FilePayload>;
  saveFile(name: string, bytes: Uint8Array): Promise<string | null>;
  saveMany(files: { name: string; bytes: Uint8Array }[]): Promise<string[] | null>;
  showInFolder(path: string): Promise<void>;
  storeGet(): Promise<unknown>;
  storeSet(value: unknown): Promise<boolean>;
  pathForFile(file: File): string | null;
  onMenu(channel: MenuChannel, cb: () => void): () => void;
}

declare global {
  interface Window {
    pdfforge?: ElectronBridge;
  }
}

const bridge = (): ElectronBridge | undefined => window.pdfforge;
const STORE_KEY = 'pdfforge-store';

export const isDesktop = () => Boolean(bridge());

const ACCEPT: Record<OpenKind, string> = {
  pdf: 'application/pdf,.pdf',
  image: 'image/*',
  any: '*/*',
};

export async function openFiles(kind: OpenKind, multiple: boolean): Promise<FilePayload[]> {
  const b = bridge();
  if (b) return b.openFiles({ kind, multiple });
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT[kind];
    input.multiple = multiple;
    input.onchange = async () => resolve(await fromFileList(input.files));
    input.click();
  });
}

export async function fromFileList(list: FileList | File[] | null): Promise<FilePayload[]> {
  if (!list) return [];
  const b = bridge();
  return Promise.all(
    Array.from(list).map(async (f) => ({
      name: f.name,
      path: b?.pathForFile(f) ?? null,
      bytes: new Uint8Array(await f.arrayBuffer()),
    })),
  );
}

export async function readPath(path: string): Promise<FilePayload | null> {
  const b = bridge();
  if (!b) return null;
  try {
    return await b.readFile(path);
  } catch {
    return null;
  }
}

/** Salva um arquivo; retorna o caminho gravado (desktop) ou o nome baixado (navegador). */
export async function saveFile(name: string, bytes: Uint8Array): Promise<string | null> {
  const b = bridge();
  if (b) return b.saveFile(name, bytes);
  download(name, bytes);
  return name;
}

export async function saveMany(files: { name: string; bytes: Uint8Array }[]): Promise<string[] | null> {
  const b = bridge();
  if (b) return b.saveMany(files);
  files.forEach((f) => download(f.name, f.bytes));
  return files.map((f) => f.name);
}

export function showInFolder(path: string) {
  bridge()?.showInFolder(path);
}

export async function loadStore<T>(): Promise<T | null> {
  const b = bridge();
  if (b) return (await b.storeGet()) as T | null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function persistStore(value: unknown): Promise<void> {
  const b = bridge();
  if (b) {
    await b.storeSet(value);
    return;
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível (janela privada): segue sem persistir.
  }
}

export function onMenu(channel: MenuChannel, cb: () => void) {
  return bridge()?.onMenu(channel, cb) ?? (() => {});
}

function download(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes]));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
