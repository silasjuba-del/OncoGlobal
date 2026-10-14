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
  it("PDF híbrido (texto + página escaneada) sem OCR fica pendente e não descarta a página (P1 PR #13)", async () => {
    const r = await converterPdfLocal({ id: "hibrido", tipo: "PDF_DIGITAL", conteudo: pdfHibrido(), recebidoEm: "2026-10-12T12:00:00Z" });
    expect(r.status).toBe("PENDENTE"); expect(r.documento.paginas.map(p => p.n)).toEqual([1]);
  });
});

/** Página 1 com texto digital; página 2 sem texto (simula página escaneada). */
function pdfHibrido(): Uint8Array {
  const conteudo = "BT /F1 12 Tf 72 720 Td (Creatinina 1,2 mg/dL) Tj ET", n = "\n";
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${conteudo.length} >>${n}stream${n}${conteudo}${n}endstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let s = `%PDF-1.4${n}`; const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(s.length); s += `${i + 1} 0 obj${n}${o}${n}endobj${n}`; });
  const xref = s.length;
  s += `xref${n}0 ${objs.length + 1}${n}0000000000 65535 f ${n}` + offsets.map(o => `${String(o).padStart(10, "0")} 00000 n ${n}`).join("")
    + `trailer${n}<< /Size ${objs.length + 1} /Root 1 0 R >>${n}startxref${n}${xref}${n}%%EOF`;
  return new Uint8Array(Buffer.from(s, "latin1"));
}
