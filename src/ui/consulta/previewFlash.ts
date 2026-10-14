import type { BundleExibidoVisao, FlashPreparada } from "../api/porta.js";

export interface DocumentoPreviewFlash { documentId: string; documentVersion: number; titulo: string; texto: string }
/** Valida o conteúdo que será de fato renderizado. Buscar um bundle não equivale a mostrá-lo. */
export function conferirPreviewFlash(preparada: FlashPreparada, bundle: BundleExibidoVisao,
  contexto: { patientId: string; encounterId: string; tumorLotId: string | null }): DocumentoPreviewFlash[] {
  if (bundle.patientId !== contexto.patientId || bundle.encounterId !== contexto.encounterId
    || !preparada.documentos.length || bundle.documentos.length !== preparada.documentos.length)
    throw new Error("BUNDLE_DIVERGENTE");
  const ids = new Set<string>();
  return bundle.documentos.map((doc) => {
    const esperado = preparada.documentos.find((d) => d.documentId === doc.documentId && d.documentVersion === doc.documentVersion);
    const corpo = doc.conteudo && typeof doc.conteudo === "object" && !Array.isArray(doc.conteudo)
      ? doc.conteudo as Record<string, unknown> : null;
    const ctx = corpo?.contexto as Record<string, unknown> | undefined;
    if (!esperado || ids.has(doc.documentId) || !doc.draftId
      || !preparada.registros.some((r) => r.id === doc.draftId)
      || !doc.conteudoHash || !/^[a-f0-9]{64}$/.test(doc.conteudoHash)
      || typeof corpo?.texto !== "string" || !ctx || ctx.encounterId !== contexto.encounterId
      || ctx.tumorLotId !== contexto.tumorLotId
      || (ctx.patientId !== undefined && ctx.patientId !== contexto.patientId)) throw new Error("CONTEUDO_NAO_EXIBIVEL");
    ids.add(doc.documentId);
    return { documentId: doc.documentId, documentVersion: doc.documentVersion, titulo: esperado.titulo, texto: corpo.texto };
  });
}
