import { describe, expect, it } from "vitest";
import { converterPdfLocal } from "../../../src/kernel/extracao/pdfLocal.js";
import type { ConfigOcrLocal } from "../../../src/leitura/ocr-local.js";
describe("S11 kernel PDF local", () => {
  it("arquivo ilegível conserva hash original e fica pendente sem pedir nova foto", async () => {
    const r = await converterPdfLocal({ id: "pdf", tipo: "PDF_DIGITAL", conteudo: new Uint8Array([1, 2, 3]), recebidoEm: "2026-10-12T12:00:00Z" });
    expect(r.status).toBe("PENDENTE"); expect(r.documento.hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("scan não renderizável não finge OCR operacional", async () => {
    const config: ConfigOcrLocal = { workerPath: "/ausente/worker", corePath: "/ausente/core", langPath: "/ausente/lang", idioma: "por", limiarConfianca: 80, timeoutMs: 10 };
    const r = await converterPdfLocal({ id: "scan", tipo: "PDF_ESCANEADO", conteudo: new Uint8Array([1, 2, 3]), recebidoEm: "2026-10-12T12:00:00Z" }, { ocrConfig: config });
    expect(r.status).toBe("PENDENTE"); expect(r.documento.paginas).toEqual([]);
  });
});
