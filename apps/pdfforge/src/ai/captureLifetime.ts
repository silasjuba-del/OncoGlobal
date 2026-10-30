/** Recursos da aba: fechar ou substituir encerra gravacao e todas as faixas. */
export function createCaptureLifetime() {
  let active = true, stream: Pick<MediaStream, 'getTracks'> | null = null, stopRecording: (() => void) | null = null;
  const stop = () => { const fn = stopRecording; stopRecording = null; fn?.(); };
  const clear = () => { try { stop(); } finally { stream?.getTracks().forEach(t => t.stop()); stream = null; } };
  return {
    isActive: () => active,
    replaceStream(next: Pick<MediaStream, 'getTracks'>) {
      if (!active) { next.getTracks().forEach(t => t.stop()); return false; }
      clear(); stream = next; return true;
    },
    setStopRecording(fn: () => void) { if (!active) { fn(); return; } stop(); stopRecording = fn; },
    stop,
    dispose() { active = false; clear(); },
  };
}
