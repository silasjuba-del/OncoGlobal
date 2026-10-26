import { ConfiguracaoConversaResposta, EventoConversa, HistoricoConversa, RespostaConversa,
  type ApiConversaOncoassist } from "../../contracts/api/conversaOncoassist.js";

export type EnviarConversaAutenticado = (url: string, body: unknown, signal?: AbortSignal) => Promise<{ status: number; json: unknown }>;
export type StreamConversaAutenticado = (url: string, body: unknown, signal: AbortSignal | undefined,
  aoEvento: (evento: EventoConversa) => void) => Promise<RespostaConversa>;
function aceitar(r: { status: number; json: unknown }) {
  if (![200, 202].includes(r.status)) {
    const p = r.json as { codigo?: unknown } | null;
    throw Error(typeof p?.codigo === "string" ? p.codigo : "CONVERSA_INDISPONIVEL");
  }
  return r.json;
}
/** Parses the authenticated NDJSON response. A partial delta is never a completed proposal. */
export async function lerStreamConversa(response: Response, aoEvento: (evento: EventoConversa) => void): Promise<RespostaConversa> {
  if (!response.ok || !response.body) {
    let erro: unknown; try { erro = await response.json(); } catch { erro = null; }
    aceitar({ status: response.status, json: erro }); throw Error("CONVERSA_STREAM_AUSENTE");
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", bytes = 0, final: RespostaConversa | null = null;
  const linha = (texto: string) => {
    if (!texto.trim()) return;
    const evento = EventoConversa.parse(JSON.parse(texto));
    if (final) throw Error("CONVERSA_EVENTO_APOS_FINAL");
    aoEvento(evento);
    if (evento.tipo === "erro") throw Error(evento.codigo);
    if (evento.tipo === "final") final = evento.resposta;
  };
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength; if (bytes > 2_000_000) throw Error("CONVERSA_STREAM_EXCESSIVO");
      buffer += decoder.decode(chunk.value, { stream: true });
      let i: number;
      while ((i = buffer.indexOf("\n")) >= 0) { linha(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
    }
    linha(buffer + decoder.decode());
    if (!final) throw Error("CONVERSA_STREAM_INCOMPLETO");
    return final;
  } finally { await reader.cancel().catch(() => {}); }
}
export function criarApiConversaOncoassist(enviar: EnviarConversaAutenticado, stream?: StreamConversaAutenticado): ApiConversaOncoassist {
  return {
    async historico(contexto, signal) { return HistoricoConversa.parse(aceitar(await enviar("/consulta/assistente/historico", contexto, signal))); },
    async configurar(pedido, signal) { return ConfiguracaoConversaResposta.parse(aceitar(await enviar("/consulta/assistente/configurar", pedido, signal))); },
    async cancelar(pedido, signal) { return RespostaConversa.parse(aceitar(await enviar("/consulta/assistente/cancelar", pedido, signal))); },
    async responder(pedido, signal, aoEvento) {
      if (stream && aoEvento) return stream("/consulta/assistente/responder-stream", pedido, signal, aoEvento);
      const resposta = RespostaConversa.parse(aceitar(await enviar("/consulta/assistente/responder", pedido, signal)));
      aoEvento?.({ tipo: "final", resposta }); return resposta;
    },
  };
}
