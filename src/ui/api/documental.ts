import { z } from "zod";
import { DocumentoDocumentalResposta, DocumentosDocumentaisResposta, ImportacaoDocumentalResposta,
  type ApiDocumental } from "../../contracts/api/importacaoDocumental.js";

export type EnviarDocumental = (rota: string, corpo: unknown, signal?: AbortSignal) => Promise<{ status: number; json: unknown }>;
/** Reusa transporte autenticado; pacote exportado não contém token ou identidade clínica. */
export function criarApiDocumental(enviar: EnviarDocumental): ApiDocumental {
  async function ler<T>(rota: string, pedido: unknown, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
    const r = await enviar(rota, pedido, signal);
    if (r.status < 200 || r.status >= 300) {
      const codigo = r.json && typeof r.json === "object" && "codigo" in r.json ? String(r.json.codigo) : "DOCUMENTO_INDISPONIVEL";
      throw new Error(codigo);
    }
    const parsed = schema.parse(r.json);
    const esperado = pedido && typeof pedido === "object" && "contexto" in pedido ? pedido.contexto : pedido;
    const recebido = parsed && typeof parsed === "object" && "contexto" in parsed ? parsed.contexto : null;
    const contexto = (v: unknown) => v && typeof v === "object" && "patientId" in v && "encounterId" in v && "tumorLotId" in v
      ? JSON.stringify([v.patientId, v.encounterId, v.tumorLotId]) : null;
    if (!contexto(esperado) || contexto(esperado) !== contexto(recebido)) throw new Error("CONTEXTO_DOCUMENTAL_DIVERGENTE");
    return parsed;
  }
  return {
    importar: (pedido, signal) => ler("/consulta/documental/importar", pedido, ImportacaoDocumentalResposta, signal),
    listar: (contexto, signal) => ler("/consulta/documental/listar", contexto, DocumentosDocumentaisResposta, signal),
    async abrir(pedido, signal) {
      const r = await ler("/consulta/documental/abrir", pedido, DocumentoDocumentalResposta, signal);
      if (r.pacote.pacoteId !== pedido.pacoteId || r.documento.pacoteId !== pedido.pacoteId) throw new Error("DOCUMENTO_DIVERGENTE");
      return r;
    },
  };
}
