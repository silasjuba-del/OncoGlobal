import type { Hit } from './rag';
/** O mesmo snapshot numerado exibido acompanha toda exportacao da resposta. */
export function answerWithSources(message: { display: string; sourceSnapshot?: string }): string {
  return message.sourceSnapshot ? `${message.display}\n\n## Fontes desta resposta\n${message.sourceSnapshot}` : message.display;
}

/** IDs monotônicos por conversa: uma nova busca nunca reutiliza [1] de outra fonte. */
export function appendSourceContext(previous: readonly string[], hits: readonly Hit[], titleOf: (docId: string) => string) {
  const added = hits.map((h, i) => `[${previous.length + i + 1}] ${titleOf(h.chunk.docId)}${h.chunk.page ? `, p. ${h.chunk.page}` : ''}\n${h.chunk.text}`);
  const entries = [...previous, ...added];
  return { entries, current: added.join('\n\n'), snapshot: entries.join('\n\n') };
}
