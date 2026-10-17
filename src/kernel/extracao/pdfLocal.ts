import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { EntradaLeitura, ResultadoLeitura } from "../../leitura/caixa-unica.js";
import { ocrLocal, type ConfigOcrLocal, type ProvedorOcrLocal } from "../../leitura/ocr-local.js";

export interface OpcoesPdfLocal { ocrConfig?: ConfigOcrLocal; ocr?: ProvedorOcrLocal; signal?: AbortSignal }

/** Uma leitura do original, com cobertura por página. PRONTO nunca confirma fatos clínicos. */
export async function converterPdfLocal(entrada: EntradaLeitura, opcoes: OpcoesPdfLocal = {}): Promise<ResultadoLeitura> {
  if (!entrada.id.trim() || !entrada.recebidoEm.trim()) throw Error("ID e recebidoEm obrigatórios");
  const bytes = typeof entrada.conteudo === "string" ? Buffer.from(entrada.conteudo) : new Uint8Array(entrada.conteudo);
  const documento = { id: entrada.id, tipo: entrada.tipo, hash: createHash("sha256").update(bytes).digest("hex"),
    recebidoEm: entrada.recebidoEm, paginas: [] as { n: number; texto: string }[],
    totalPaginas: 0, paginasPendentes: [] as number[] };
  const pendente = (motivo: string): ResultadoLeitura => ({ status: "PENDENTE", documento, motivo });
  if (opcoes.signal?.aborted) return pendente("PDF_LEITURA_CANCELADA");
  const tarefa = getDocument({ data: new Uint8Array(bytes), disableFontFace: true,
    useSystemFonts: false, useWorkerFetch: false, useWasm: false, verbosity: 0 });
  try {
    const doc = await tarefa.promise;
    documento.totalPaginas = doc.numPages;
    documento.paginasPendentes = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    // Limite verificado antes da extração, sem primeira varredura ilimitada.
    if (doc.numPages > 40) return pendente("PDF_LIMITE_40_PAGINAS_REVISAR_ORIGINAL");
    for (let n = 1; n <= doc.numPages; n++) {
      if (opcoes.signal?.aborted) return pendente("PDF_LEITURA_CANCELADA");
      try {
        const pagina = await doc.getPage(n);
        const conteudo = await pagina.getTextContent();
        const texto = conteudo.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
        if (texto) {
          documento.paginas.push({ n, texto });
          documento.paginasPendentes = documento.paginasPendentes.filter(p => p !== n);
          continue;
        }
        if (!opcoes.ocrConfig) continue;
        const viewport = pagina.getViewport({ scale: 2 });
        if (viewport.width * viewport.height > 20_000_000) continue;
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await pagina.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
        const resultado = await ocrLocal({ ...entrada, tipo: "IMAGEM", conteudo: new Uint8Array(canvas.toBuffer("image/png")) },
          opcoes.ocrConfig, opcoes.ocr, opcoes.signal);
        documento.paginas.push(...resultado.documento.paginas.map(p => ({ n, texto: p.texto })));
        if (resultado.status === "PRONTO") documento.paginasPendentes = documento.paginasPendentes.filter(p => p !== n);
      } catch { /* A falha de uma página fica explícita; as demais continuam legíveis. */ }
    }
    return documento.paginasPendentes.length || !documento.paginas.length
      ? pendente("PDF_OCR_INCOMPLETO_REVISAR_ORIGINAL") : { status: "PRONTO", documento };
  } catch {
    return pendente("PDF_OCR_LOCAL_INDISPONIVEL_REVISAR_ORIGINAL");
  } finally { await tarefa.destroy(); }
}
