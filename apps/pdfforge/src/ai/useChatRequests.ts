import { useCallback, useEffect, useRef } from 'react';
import { chatStream, type ChatRequest } from './bridge';
import { createRequestLifetime } from './requestLifetime';
export function useChatRequests(scope?: unknown) {
  const ref = useRef<ReturnType<typeof createRequestLifetime> | null>(null);
  if (!ref.current) ref.current = createRequestLifetime(chatStream);
  useEffect(() => {
    if (!ref.current?.isActive()) ref.current = createRequestLifetime(chatStream);
    const current = ref.current!;
    window.addEventListener('pagehide', current.dispose);
    return () => { window.removeEventListener('pagehide', current.dispose); current.dispose(); };
  }, [scope]);
  return useCallback((request: ChatRequest, delta: (text: string) => void) => ref.current!.start(request, delta), []);
}
