export interface CaptureFrame { url: string; bytes: Uint8Array; t: number; keep: boolean }
/** Acrescenta amostra sem substituir escolhas feitas sobre os frames anteriores. */
export function appendCaptureFrame(current: readonly CaptureFrame[], next: Omit<CaptureFrame, 'keep'>): CaptureFrame[] {
  return [...current, { ...next, keep: true }];
}
