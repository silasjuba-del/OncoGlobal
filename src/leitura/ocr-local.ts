import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createWorker } from "tesseract.js";
import type { EntradaLeitura, ResultadoLeitura } from "./caixa-unica.js";

export interface ConfigOcrLocal {
  workerPath: string; corePath: string; langPath: string; idioma: string;
  limiarConfianca: number; timeoutMs: number;
}
export interface ProvedorOcrLocal {
  reconhecer(bytes: Uint8Array, config: ConfigOcrLocal, signal: AbortSignal): Promise<{ texto: string; confianca: number }>;
}
export type ResultadoOcrLocal = ResultadoLeitura & { readonly confianca: number | null; readonly bruto: EntradaLeitura };

export function configOcrValida(c: ConfigOcrLocal): boolean {
  return Number.isFinite(c.limiarConfianca) && c.limiarConfianca >= 0 && c.limiarConfianca <= 100
    && Number.isInteger(c.timeoutMs) && c.timeoutMs > 0 && c.timeoutMs <= 2_147_483_647
    && /^[a-z]{3}(?:\+[a-z]{3})*$/.test(c.idioma)
    && [c.workerPath, c.corePath, c.langPath].every(p => isAbsolute(p) && existsSync(p))
    && statSync(c.workerPath).isFile()
    && (c.idioma.split("+").every(lang => existsSync(join(c.langPath, `${lang}.traineddata`)))
      || c.idioma.split("+").every(lang => existsSync(join(c.langPath, `${lang}.traineddata.gz`))));
}
export const tesseractLocal: ProvedorOcrLocal = {
  async reconhecer(bytes, config, signal) {
    // Every asset is already on disk; no CDN fallback or cache download.
    const worker = await createWorker(config.idioma, 1, { workerPath: config.workerPath,
      corePath: config.corePath, langPath: config.langPath, cacheMethod: "none", workerBlobURL: false,
      gzip: config.idioma.split("+").every(lang => existsSync(join(config.langPath, `${lang}.traineddata.gz`))) });
    const abortar = () => { void worker.terminate().catch(() => {}); };
    signal.addEventListener("abort", abortar, { once: true });
    try {
      if (signal.aborted) throw Error("CANCELADO");
      const r = await worker.recognize(Buffer.from(bytes));
      return { texto: r.data.text, confianca: r.data.confidence };
    } finally { signal.removeEventListener("abort", abortar); await worker.terminate(); }
  },
};

export async function ocrLocal(entrada: EntradaLeitura, config: ConfigOcrLocal,
  provedor: ProvedorOcrLocal = tesseractLocal, signal?: AbortSignal): Promise<ResultadoOcrLocal> {
  const bruto = structuredClone(entrada);
  const bytes = typeof entrada.conteudo === "string" ? Buffer.from(entrada.conteudo) : new Uint8Array(entrada.conteudo);
  const documento = { id: entrada.id, tipo: entrada.tipo, paginas: [] as { n: number; texto: string }[],
    hash: createHash("sha256").update(bytes).digest("hex"), recebidoEm: entrada.recebidoEm };
  const pendente = (motivo: string, confianca: number | null = null): ResultadoOcrLocal => ({ status: "PENDENTE", documento, motivo, confianca, bruto });
  if (!configOcrValida(config)) return pendente("OCR_LOCAL_SEM_ASSETS_OU_CONFIGURACAO");
  if (entrada.tipo !== "IMAGEM" || typeof entrada.conteudo === "string") return pendente("OCR_EXIGE_IMAGEM_LOCAL_BINARIA");
  if (signal?.aborted) return pendente("OCR_CANCELADO");
  const controller = new AbortController();
  const cancelar = () => controller.abort(); signal?.addEventListener("abort", cancelar, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let interromper: (() => void) | undefined;
  try {
    const interrupcao = new Promise<never>((_, reject) => {
      interromper = () => reject(Error("OCR_CANCELADO"));
      controller.signal.addEventListener("abort", interromper, { once: true });
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { reject(Error("OCR_TIMEOUT")); controller.abort(); }, config.timeoutMs);
    });
    const r = await Promise.race([provedor.reconhecer(bytes, config, controller.signal), timeout, interrupcao]);
    if (!Number.isFinite(r.confianca) || r.confianca < 0 || r.confianca > 100 || typeof r.texto !== "string") return pendente("OCR_SAIDA_INVALIDA");
    documento.paginas = r.texto.trim() ? [{ n: 1, texto: r.texto }] : [];
    if (!documento.paginas.length || r.confianca < config.limiarConfianca) return pendente("OCR_BAIXA_CONFIANCA_REVISAR_ORIGINAL", r.confianca);
    return { status: "PRONTO", documento, confianca: r.confianca, bruto };
  } catch { return pendente(controller.signal.aborted ? "OCR_CANCELADO_OU_TIMEOUT" : "OCR_INDISPONIVEL"); }
  finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", cancelar);
    if (interromper) controller.signal.removeEventListener("abort", interromper);
  }
}
