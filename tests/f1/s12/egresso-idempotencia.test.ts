import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { sqliteIdempotencia } from "../../../src/kernel/ledger/idempotencia.js";
import { criarGateway } from "../../../src/kernel/gateway/gateway.js";
import { criarRuntimeExtracaoLlm } from "../../../src/kernel/llm/openai/runtime.js";
import type { OpcoesOpenAi } from "../../../src/kernel/llm/openai/index.js";
const agora = "2026-10-12T12:00:00Z";
const env = { ONCOASSIST_OPENAI_ENABLED: "true", ONCOASSIST_OPENAI_DOCUMENTS_ENABLED: "true", ONCOASSIST_OPENAI_MODEL: "modelo-sintetico", OPENAI_API_KEY: "chave-sintetica-nao-real", ONCOASSIST_OPENAI_TIMEOUT_MS: "20" };
const sessao = { medicoId: "medico-sintetico", crm: "CRM-SINTETICO", emitidaEm: agora, expiraEm: "2026-10-12T13:00:00Z" };
const ctx = { patientId: "p-sintetico", encounterId: "e-sintetico", tumorLotId: null };
const chave = "egresso-sintetico-mesma-chave";
const corr = { ...ctx, operationId: chave, revisaoFatos: "r", regras: [], biblioteca: { id: "b", versao: "1", hash: "h" }, proposta: null };
function pdf() {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>"];
  let s = "%PDF-1.4\n"; const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(s)); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const inicio = Buffer.byteLength(s);
  return Buffer.from(`${s}xref\n0 4\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${inicio}\n%%EOF\n`).toString("base64");
}
const base64 = pdf(), trecho = "Hemoglobina 8,2 g/dL.";
type Modo = "original" | "desidentificado";
const saida = (modo: Modo) => modo === "original" ? { paginas: [{ n: 1, texto: trecho }] }
  : { candidatos: [], resumo: [{ texto: trecho, referencias: [{ fonteId: "FONTE_1", pagina: 1, trecho }] }] };
const diretorios: string[] = [];
afterEach(() => { for (const dir of diretorios.splice(0)) {
  const real = realpathSync(dir);
  if (dirname(real) !== realpathSync(tmpdir()) || !basename(real).startsWith("s12-egresso-")) throw Error("TEMP_FORA_ESCOPO");
  rmSync(real, { recursive: true, force: true });
} });
async function preparar(modo: Modo, db: ReturnType<typeof abrirLedger>, transporte: NonNullable<OpcoesOpenAi["transporte"]>, atual = () => true, timeout = "20") {
  const audit = vi.fn();
  const runtime = criarRuntimeExtracaoLlm({ env: { ...env, ONCOASSIST_OPENAI_TIMEOUT_MS: timeout }, transporte, agora: () => agora, auditar: audit });
  const r = modo === "original"
    ? await runtime.prepararDocumentoOriginal(chave, { fonteId: "source", base64, correlacao: corr }, 1, sessao, atual)
    : runtime.preparar(chave, { fonte: { id: "source", paginas: [{ n: 1, texto: trecho }] }, correlacao: corr },
      { dicionario: { nomes: ["Pessoa Sintética"], identificadores: [ctx.patientId] } }, 1, atual);
  expect(r.status).toBe("PRONTO");
  const gateway = criarGateway({ agora: () => agora, auditar: audit, store: sqliteIdempotencia(db), executores: { LLM_EXTRACAO: runtime.executor },
    validarExtracaoLlm: runtime.validarExtracaoLlm, validarDocumentoOriginalLlm: runtime.validarDocumentoOriginalLlm });
  const intent = { verbo: "LLM_EXTRACAO", objeto: { tipo: modo === "original" ? "PDF_ORIGINAL_D_W9_66" : "FONTE", id: "source", versao: 1 },
    escopo: { patientId: ctx.patientId, encounterId: ctx.encounterId }, destino: null, idempotencyKey: chave };
  return { executar: () => gateway.executar(intent, sessao), runtime, audit };
}

describe.each(["original", "desidentificado"] as const)("S12 egresso %s", modo => {
  it.each(["timeout", "erro-transporte", "saida-invalida", "contexto-trocado"])("%s mantém reserva e não reenvia após limpeza do runtime e reinício SQLite", async falha => {
    const dir = mkdtempSync(join(tmpdir(), "s12-egresso-")); diretorios.push(dir);
    const arquivo = join(dir, "ledger.sqlite"); let db = abrirLedger(arquivo), atual = true;
    const extrair = vi.fn(async (payload: Readonly<Record<string, unknown>>) => {
      expect(payload.store).toBe(false); expect(payload.tools).toEqual([]);
      if (falha === "timeout") return new Promise(() => {});
      if (falha === "erro-transporte") throw Error("segredo-sintetico-nao-publicar");
      if (falha === "saida-invalida") return { indevido: "segredo-sintetico-nao-publicar" };
      atual = false; return saida(modo);
    });
    try {
      const a = await preparar(modo, db, { extrair }, () => atual);
      expect(await a.executar()).toMatchObject({ decisao: "OUTCOME_UNKNOWN" });
      expect(sqliteIdempotencia(db).get(chave)?.resultado.decisao).toBe("OUTCOME_UNKNOWN");
      expect(JSON.stringify(a.audit.mock.calls)).not.toContain("segredo-sintetico-nao-publicar");
      a.runtime.descartar(chave); db.close(); db = abrirLedger(arquivo); atual = true;
      const repetida = await preparar(modo, db, { extrair }, () => atual);
      expect(await repetida.executar()).toMatchObject({ decisao: "OUTCOME_UNKNOWN" });
      expect(extrair).toHaveBeenCalledTimes(1);
      expect(db.prepare("SELECT count(*) AS n FROM clinical_event").get()?.n).toBe(0);
    } finally { db.close(); }
  });

  it("falha anterior ao transporte permite retry, sem chamada nem reserva de egresso desconhecido", async () => {
    const db = abrirLedger(":memory:"), extrair = vi.fn(async () => saida(modo));
    try {
      const a = await preparar(modo, db, { extrair }, () => true, "0");
      expect(await a.executar()).toMatchObject({ decisao: "FALHOU" });
      expect(extrair).not.toHaveBeenCalled(); expect(sqliteIdempotencia(db).get(chave)).toBeUndefined();
      a.runtime.descartar(chave);
      const b = await preparar(modo, db, { extrair });
      expect(await b.executar()).toMatchObject({ decisao: "EXECUTADA" });
      expect(extrair).toHaveBeenCalledTimes(1);
      const resultado = modo === "original" ? b.runtime.resultadoDocumentoOriginal(chave) : b.runtime.resultado(chave);
      expect(resultado?.status).toBe(modo === "original" ? "DERIVADO_LLM_NAO_VERIFICADO" : "PROPOSTA");
    } finally { db.close(); }
  });
});
