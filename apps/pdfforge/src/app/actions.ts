import { createContext, useContext } from 'react';
import type { FilePayload } from '../platform/platform';
import type { Provider } from '../ai/bridge';
import type { Attachment } from '../ai/attachments';

export interface ChatInit {
  attachments?: Attachment[];
  promptId?: string;
  text?: string;
}

export type AiTabKind = 'notebooklm' | 'library' | 'prompts' | 'settings' | 'round' | 'capture' | 'oncoglobal';
export type HomeSection = 'recents' | 'tools' | 'history';

export type Tab =
  | { id: 'home'; kind: 'home' }
  | { id: string; kind: 'tool'; toolId: string; initialFiles?: FilePayload[] }
  | { id: string; kind: 'viewer'; file: FilePayload }
  | { id: string; kind: 'llm'; provider: Provider; init?: ChatInit; initSeq?: number }
  | { id: string; kind: 'web'; url: string }
  | { id: string; kind: 'editor'; file: FilePayload }
  | { id: string; kind: AiTabKind };

export interface AppActions {
  openTool(toolId: string, files?: FilePayload[]): void;
  openViewer(file: FilePayload): void;
  /** Abre (ou foca) a aba de um LLM; init anexa documentos/prompt à conversa. */
  openLlm(provider: Provider, init?: ChatInit): void;
  openAiTab(kind: AiTabKind): void;
  /** Nova aba de navegador dentro do app. */
  openWeb(url: string): void;
  /** Editor visual de PDF. */
  openEditor(file: FilePayload): void;
  goHome(section: HomeSection): void;
  /** Abre o seletor do sistema e mostra os PDFs escolhidos no visualizador. */
  pickAndOpen(): void;
  /** Registra arquivos abertos em "Arquivos recentes" (com miniatura). */
  rememberFiles(files: FilePayload[]): void;
  closeTab(id: string): void;
  toast(message: string, kind?: 'info' | 'error' | 'success'): void;
}

export const ActionsContext = createContext<AppActions | null>(null);

export function useActions(): AppActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('ActionsContext ausente');
  return ctx;
}
