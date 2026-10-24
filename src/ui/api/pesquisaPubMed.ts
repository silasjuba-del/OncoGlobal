import { ReadIntent } from "../../contracts/w10/closure.js";

function bloco(texto: string, semente: number): string {
  let hash = semente >>> 0;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Pedido READ sem paciente, sessão ou URL. A mesma consulta reutiliza o mesmo requestId. */
export function montarPedidoPubMed(consulta: string) {
  const query = consulta.trim();
  const requestId = `pubmed.${bloco(query, 0x811c9dc5)}${bloco(query, 0x811c9dc5 ^ 0x9e3779b9)}${bloco(`#${query}`, 0x811c9dc5)}`;
  return ReadIntent.parse({
    requestId, purpose: "RESEARCH", destination: "PUBMED", payload: { query }, timeoutMs: 8000,
  });
}
