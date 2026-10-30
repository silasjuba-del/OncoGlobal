export interface InputFile {
  name: string;
  bytes: Uint8Array;
  path?: string | null;
  /** Senha para abrir PDFs protegidos, quando informada pelo usuário. */
  password?: string;
}

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
  mime: string;
}

export interface RunContext {
  /** fraction entre 0 e 1; label opcional descreve a etapa atual. */
  progress(fraction: number, label?: string): void;
}

export const PDF_MIME = 'application/pdf';

export class ToolError extends Error {}

export const noopContext: RunContext = { progress: () => {} };
