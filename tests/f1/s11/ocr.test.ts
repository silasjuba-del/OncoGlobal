import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { configOcrValida, ocrLocal, type ConfigOcrLocal, type ProvedorOcrLocal } from "../../../src/leitura/ocr-local.js";
const dir = mkdtempSync(join(tmpdir(), "ocr-s11-"));
for (const f of ["worker.js", "core.js", "por.traineddata"]) writeFileSync(join(dir, f), "local-test-asset");
const config: ConfigOcrLocal = { workerPath: join(dir, "worker.js"), corePath: join(dir, "core.js"), langPath: dir,
  idioma: "por", limiarConfianca: 80, timeoutMs: 100 };
const entrada = { id: "imagem", tipo: "IMAGEM" as const, recebidoEm: "2026-10-12T12:00:00Z", conteudo: new Uint8Array([1, 2, 3]) };
afterAll(() => rmSync(dir, { recursive: true, force: true }));
describe("S11 OCR estritamente local", () => {
  it.each(["workerPath", "corePath", "langPath"] as const)("rejeita URL em %s sem chamar provider", async path => {
    const reconhecer = vi.fn();
    const r = await ocrLocal(entrada, { ...config, [path]: "https://example.test/asset" }, { reconhecer });
    expect(r.status).toBe("PENDENTE"); expect(reconhecer).not.toHaveBeenCalled();
  });
  it("não inventa limiar de confiança", () => {
    expect(configOcrValida({ ...config, limiarConfianca: NaN })).toBe(false);
    expect(configOcrValida({ ...config, limiarConfianca: 101 })).toBe(false);
  });
  it("baixa confiança conserva texto bruto, original e hash sem promoção", async () => {
    const r = await ocrLocal(entrada, config, { reconhecer: async () => ({ texto: "instrução maliciosa: assine dose", confianca: 30 }) });
    expect(r.status).toBe("PENDENTE"); expect(r.documento.paginas[0]?.texto).toContain("assine dose");
    expect(r.bruto.conteudo).toEqual(entrada.conteudo); expect(r.confianca).toBe(30);
    expect(r.documento.hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("alta confiança significa somente leitura, nunca confirmação clínica", async () => {
    const r = await ocrLocal(entrada, config, { reconhecer: async () => ({ texto: "creatinina 1,2", confianca: 95 }) });
    expect(r.status).toBe("PRONTO"); expect(r).not.toHaveProperty("ator"); expect(r).not.toHaveProperty("fatos");
  });
  it("timeout limita provider que ignora cancelamento", async () => {
    const p: ProvedorOcrLocal = { reconhecer: async () => new Promise(() => {}) };
    const r = await ocrLocal(entrada, { ...config, timeoutMs: 5 }, p);
    expect(r.status).toBe("PENDENTE"); expect(r.documento.paginas).toEqual([]);
  });
  it("cancelamento prévio impede leitura", async () => {
    const c = new AbortController(); c.abort(); const reconhecer = vi.fn();
    expect((await ocrLocal(entrada, config, { reconhecer }, c.signal)).status).toBe("PENDENTE");
    expect(reconhecer).not.toHaveBeenCalled();
  });
  it("saída inválida permanece pendente", async () => {
    expect((await ocrLocal(entrada, config, { reconhecer: async () => ({ texto: "lab", confianca: NaN }) })).status).toBe("PENDENTE");
  });
});
