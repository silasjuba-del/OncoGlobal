import type { ChatRequest, ChatResult } from './bridge';
type Transport = (request: ChatRequest, delta: (text: string) => void) => { done: Promise<ChatResult>; abort: () => void };
export function createRequestLifetime(transport: Transport) {
  let active = true;
  const aborts = new Set<() => void>();
  const cancelled = () => new DOMException('Solicitacao cancelada.', 'AbortError');
  return {
    isActive: () => active,
    start(request: ChatRequest, delta: (text: string) => void) {
      if (!active) throw cancelled();
      const task = transport(request, text => { if (active) delta(text); });
      const abort = () => task.abort();
      aborts.add(abort);
      return { abort, done: task.done.then(result => { if (!active) throw cancelled(); return result; })
        .finally(() => aborts.delete(abort)) };
    },
    dispose() { active = false; for (const abort of aborts) { try { abort(); } catch { /* cancela os demais */ } } aborts.clear(); },
  };
}
