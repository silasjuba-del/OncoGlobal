import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { converterEntradaLocalAsync, type EntradaLeitura, type ResultadoLeitura } from "../../leitura/caixa-unica.js";
import { ocrLocal, type ConfigOcrLocal, type ProvedorOcrLocal } from "../../leitura/ocr-local.js";

export interface OpcoesPdfLocal { ocrConfig?: ConfigOcrLocal; ocr?: ProvedorOcrLocal; signal?: AbortSignal }

/** Kernel port for local digital extraction and optional scan OCR. Never requests a new photo. */
export async function converterPdfLocal(entrada: EntradaLeitura, opcoes: OpcoesPdfLocal = {}): Promise<ResultadoLeitura> {
  const digital = await converterEntradaLocalAsync({ ...entrada, tipo: "PDF_DIGITAL" });
  if (!opcoes.ocrConfig) return digital;
  if (typeof entrada.conteudo === "string") return digital;
  const tarefa = getDocument({ data: new Uint8Array(entrada.conteudo), disableFontFace: true,
    useSystemFonts: false, useWorkerFetch: false, useWasm: false, verbosity: 0 });
  const paginas: { n: number; texto: string }[] = [];
  let incompleto = false;
  try {
    const doc = await tarefa.promise;
    if (doc.numPages > 40) throw Error("PDF_LIMITE_PAGINAS");
    for (let n = 1; n <= doc.numPages; n++) {
      if (opcoes.signal?.aborted) throw Error("CANCELADO");
      const textoDigital = digital.documento.paginas.find(p => p.n === n)?.texto;
      if (textoDigital) { paginas.push({ n, texto: textoDigital }); continue; }
      const pagina = await doc.getPage(n); const viewport = pagina.getViewport({ scale: 2 });
      if (viewport.width * viewport.height > 20_000_000) throw Error("PDF_LIMITE_PIXELS");
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await pagina.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
      const resultado = await ocrLocal({ ...entrada, tipo: "IMAGEM", conteudo: new Uint8Array(canvas.toBuffer("image/png")) },
        opcoes.ocrConfig, opcoes.ocr, opcoes.signal);
      paginas.push(...resultado.documento.paginas.map(p => ({ n, texto: p.texto })));
      if (resultado.status !== "PRONTO") incompleto = true;
    }
    const documento = { ...digital.documento, paginas };
    return incompleto || !paginas.length ? { status: "PENDENTE", documento, motivo: "PDF_OCR_INCOMPLETO_REVISAR_ORIGINAL" }
      : { status: "PRONTO", documento };
  } catch {
    return { status: "PENDENTE", documento: { ...digital.documento, paginas }, motivo: "PDF_OCR_LOCAL_INDISPONIVEL_REVISAR_ORIGINAL" };
  } finally { await tarefa.destroy(); }
}
