// proveniência: dados sintéticos — não utilizar em produção
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Correlacao } from "../../src/contracts/f1/correlacao.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarTranscritorDocumentoOriginal } from "../../src/kernel/llm/openai/documentoOriginal.js";
import { criarRuntimeExtracaoLlm } from "../../src/kernel/llm/openai/runtime.js";

const agora = "2026-10-12T12:00:00Z";
const env = { ONCOASSIST_OPENAI_ENABLED: "true", ONCOASSIST_OPENAI_DOCUMENTS_ENABLED: "true",
  ONCOASSIST_OPENAI_MODEL: "modelo-sintetico", OPENAI_API_KEY: "key-test" };
const sessao = { medicoId: "m", crm: "CRM", emitidaEm: agora, expiraEm: "2026-10-12T13:00:00Z" };
const ctx = { patientId: "patient-rt05", encounterId: "e", tumorLotId: null };
const corr: Correlacao = { ...ctx, operationId: "rt05-000001", revisaoFatos: "r", regras: [],
  biblioteca: { id: "b", versao: "1", hash: "h" }, proposta: null };
const intent = { verbo: "LLM_EXTRACAO", objeto: { tipo: "PDF_ORIGINAL_D_W9_66", id: "source", versao: 1 },
  escopo: { patientId: ctx.patientId, encounterId: ctx.encounterId }, destino: null, idempotencyKey: "rt05-000001" };
function pdf() {
  const objs = ["", "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>"];
  let texto = "%PDF-1.4\n"; const offsets = [0];
  for (let n = 1; n < objs.length; n++) { offsets.push(Buffer.byteLength(texto)); texto += `${n} 0 obj\n${objs[n]}\nendobj\n`; }
  const xref = Buffer.byteLength(texto); texto += "xref\n0 4\n0000000000 65535 f \n";
  for (const o of offsets.slice(1)) texto += `${String(o).padStart(10, "0")} 00000 n \n`;
  return Buffer.from(`${texto}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
const base64 = pdf().toString("base64");

afterEach(() => vi.restoreAllMocks());

// RT-ADV-05: PDF bruto (PHI por exceção D-W9-66) só sai com transporte atestado e lease
// humana válida, do mesmo médico, não usada e não expirada.
describe("RT-ADV-05 · DOCUMENTO_ORIGINAL não contorna D_F1_40_LLM_SO_LOCAL", () => {
  it("chave e flags ligadas sem transporte injetado: PENDENTE e nenhuma chamada de rede", async () => {
    const rede = vi.spyOn(globalThis, "fetch");
    const t = criarTranscritorDocumentoOriginal({ env });
    expect(t.status()).toEqual({ status: "PENDENTE", codigo: "D_F1_40_LLM_SO_LOCAL" });
    const r = await t.transcrever(JSON.stringify({ input: [{ content: [{ file_data: `data:application/pdf;base64,${base64}` }] }] }),
      createHash("sha256").update("x").digest("hex"), 1);
    expect(r).toEqual({ status: "PENDENTE", codigo: "D_F1_40_LLM_SO_LOCAL" });
    const runtime = criarRuntimeExtracaoLlm({ env, agora: () => agora });
    const p = await runtime.prepararDocumentoOriginal(intent.idempotencyKey, { fonteId: "source", base64, correlacao: corr }, 1, sessao, () => true);
    expect(p).toEqual({ status: "PENDENTE", codigo: "D_F1_40_LLM_SO_LOCAL" });
    expect(rede).not.toHaveBeenCalled();
  });

  it.each([
    ["sem validador de prova no servidor", { semValidador: true }],
    ["lease de outro médico", { sessao: { ...sessao, medicoId: "outro" } }],
    ["lease expirada", { depois: "2026-10-12T12:01:01Z" }],
  ])("%s: gateway nega e o PDF nunca chega ao transporte", async (_nome, caso: {
    semValidador?: boolean; sessao?: typeof sessao; depois?: string;
  }) => {
    let relogio = agora;
    const extrair = vi.fn(async () => ({ paginas: [{ n: 1, texto: "x" }] }));
    const runtime = criarRuntimeExtracaoLlm({ env, transporte: { extrair }, agora: () => relogio });
    const p = await runtime.prepararDocumentoOriginal(intent.idempotencyKey, { fonteId: "source", base64, correlacao: corr }, 1, sessao, () => true);
    expect(p.status).toBe("PRONTO");
    if (caso.depois) relogio = caso.depois;
    const gateway = criarGateway({ agora: () => relogio, auditar: () => {}, store: memoriaIdempotencia(),
      executores: { LLM_EXTRACAO: runtime.executor },
      ...(caso.semValidador ? {} : { validarDocumentoOriginalLlm: runtime.validarDocumentoOriginalLlm }) });
    const r = await gateway.executar(intent, caso.sessao ?? sessao);
    expect(r.decisao).toBe("NEGADA");
    expect(extrair).not.toHaveBeenCalled();
  });
});
