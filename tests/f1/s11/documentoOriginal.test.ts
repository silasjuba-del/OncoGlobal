import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarRuntimeExtracaoLlm } from "../../../src/kernel/llm/openai/runtime.js";
import { criarGateway, memoriaIdempotencia, type EvidenciaDocumentoOriginalLlm } from "../../../src/kernel/gateway/gateway.js";
import { criarTranscritorDocumentoOriginal, payloadDocumentoOriginal } from "../../../src/kernel/llm/openai/documentoOriginal.js";
import type { Correlacao } from "../../../src/contracts/f1/correlacao.js";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft, listarDrafts } from "../../../src/kernel/comandos/portas.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { executarDocumentoOriginalLlm } from "../../../src/server/extracaoLlm.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { criarMotorF1 } from "../../../src/kernel/orquestracao/runtime.js";
import type { ServidorDeps } from "../../../src/server/rotas.js";

const agora = "2026-10-12T12:00:00Z", modelo = "modelo-sintetico", nome = "Nome Sintetico";
const env = { ONCOASSIST_OPENAI_ENABLED: "true", ONCOASSIST_OPENAI_DOCUMENTS_ENABLED: "true", ONCOASSIST_OPENAI_MODEL: modelo, OPENAI_API_KEY: "key-test" };
const sessao = { medicoId: "m", crm: "CRM", emitidaEm: agora, expiraEm: "2026-10-12T13:00:00Z" };
const ctx = { patientId: "patient-s11-original", encounterId: "e", tumorLotId: null };
const corr: Correlacao = { ...ctx, operationId: "orig-000001", revisaoFatos: "r", regras: [], biblioteca: { id: "b", versao: "1", hash: "h" }, proposta: null };
const intent = { verbo: "LLM_EXTRACAO", objeto: { tipo: "PDF_ORIGINAL_D_W9_66", id: "source", versao: 1 }, escopo: { patientId: ctx.patientId, encounterId: ctx.encounterId }, destino: null, idempotencyKey: "orig-000001" };
function pdf() {
  const objs = ["", "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>"];
  let texto = "%PDF-1.4\n"; const offsets = [0];
  for (let n = 1; n < objs.length; n++) { offsets.push(Buffer.byteLength(texto)); texto += `${n} 0 obj\n${objs[n]}\nendobj\n`; }
  const xref = Buffer.byteLength(texto); texto += "xref\n0 4\n0000000000 65535 f \n";
  for (const o of offsets.slice(1)) texto += `${String(o).padStart(10, "0")} 00000 n \n`;
  return Buffer.from(`${texto}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
const bytes = pdf(), base64 = bytes.toString("base64"), sourceHash = createHash("sha256").update(bytes).digest("hex");
const saida = () => ({ paginas: [{ n: 1, texto: `${nome}. Dado ilegível [ILEGIVEL].` }] });
async function preparar(opcoes: { env?: typeof env; resposta?: unknown; atual?: () => boolean; agora?: () => string } = {}) {
  const extrair = vi.fn(async (payload: Readonly<Record<string, unknown>>) => { expect(payload.store).toBe(false); return opcoes.resposta ?? saida(); });
  const audit = vi.fn();
  const runtime = criarRuntimeExtracaoLlm({ env: opcoes.env ?? env, transporte: { extrair }, agora: opcoes.agora ?? (() => agora), auditar: audit });
  const p = await runtime.prepararDocumentoOriginal(intent.idempotencyKey, { fonteId: "source", base64, correlacao: corr }, 1, sessao, opcoes.atual ?? (() => true));
  const gateway = criarGateway({ agora: opcoes.agora ?? (() => agora), auditar: () => {}, store: memoriaIdempotencia(),
    executores: { LLM_EXTRACAO: runtime.executor }, validarDocumentoOriginalLlm: runtime.validarDocumentoOriginalLlm });
  return { runtime, gateway, p, extrair, audit };
}
const bancos: ReturnType<typeof abrirLedger>[] = [];
afterEach(() => { for (const db of bancos.splice(0)) db.close(); });
describe("D-W9-66 técnica offline, separada e desligada por padrão", () => {
  it("default desabilitado não prepara lease nem chama provider", async () => {
    const a = await preparar({ env: { ...env, ONCOASSIST_OPENAI_DOCUMENTS_ENABLED: "false" } });
    expect(a.p.status).toBe("PENDENTE"); expect(a.extrair).not.toHaveBeenCalled();
  });
  it("transcrição é derivado não verificado, jamais candidato/fato; auditoria não contém texto", async () => {
    const a = await preparar(); expect(a.p.status).toBe("PRONTO");
    const g = await a.gateway.executar(intent, sessao); expect(g.decisao).toBe("EXECUTADA");
    const r = a.runtime.resultadoDocumentoOriginal(intent.idempotencyKey)!;
    expect(r.status).toBe("DERIVADO_LLM_NAO_VERIFICADO"); expect(r).not.toHaveProperty("candidatos");
    expect(r).not.toHaveProperty("fatos"); expect(JSON.stringify(a.audit.mock.calls)).not.toContain(nome);
    expect(a.extrair).toHaveBeenCalledOnce();
  });
  it("lease consumida não permite execução repetida", async () => {
    const a = await preparar(); await a.gateway.executar(intent, sessao);
    expect((await a.gateway.executar(intent, sessao)).decisao).toBe("NEGADA"); expect(a.extrair).toHaveBeenCalledOnce();
  });
  it("lease expirada e contexto alterado impedem transporte", async () => {
    let tempo = agora, atual = true;
    const a = await preparar({ agora: () => tempo, atual: () => atual });
    tempo = "2026-10-12T12:01:01Z"; expect((await a.gateway.executar(intent, sessao)).decisao).toBe("NEGADA");
    tempo = agora; atual = false; expect((await a.gateway.executar(intent, sessao)).decisao).toBe("NEGADA"); expect(a.extrair).not.toHaveBeenCalled();
  });
  it.each(["provider", "source", "patient", "store", "payload", "modelo", "expiry"])("prova alterada %s não executa", async ataque => {
    const a = await preparar(); if (a.p.status !== "PRONTO") throw Error();
    const e = structuredClone(a.p.evidencia);
    if (ataque === "provider") Object.assign(e, { provider: "GENSPARK" });
    if (ataque === "source") e.fonte.hash = "outra";
    if (ataque === "patient") e.autorizacao.patientId = "outro";
    if (ataque === "store") Object.assign(e, { store: true });
    if (ataque === "payload") e.payload += " ";
    if (ataque === "modelo") e.modelo = "outro";
    if (ataque === "expiry") e.lease.expiraEm = "2026-10-12T14:00:00Z";
    const executar = vi.fn(async () => ({ ok: true as const, recibo: "x" }));
    const g = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: { LLM_EXTRACAO: { executar } },
      validarDocumentoOriginalLlm: () => ({ ok: true, evidencia: e }) });
    expect((await g.executar(intent, sessao)).decisao).toBe("NEGADA"); expect(executar).not.toHaveBeenCalled();
  });
  it.each([{ ...saida(), ator: "MEDICO" }, { paginas: [{ n: 2, texto: "inventado" }] }, { paginas: [{ n: 1, texto: "x", state: "SIGNED" }] }])("saída inválida nunca ganha autoridade", async resposta => {
    const a = await preparar({ resposta }); expect((await a.gateway.executar(intent, sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    expect(a.runtime.resultadoDocumentoOriginal(intent.idempotencyKey)?.status).toBe("PENDENTE");
  });
  it("timeout não publica transcrição tardia", async () => {
    const transcritor = criarTranscritorDocumentoOriginal({ env: { ...env, ONCOASSIST_OPENAI_TIMEOUT_MS: "5" }, transporte: { extrair: async () => new Promise(() => {}) } });
    expect(await transcritor.transcrever(payloadDocumentoOriginal(modelo, base64), sourceHash, 1)).toEqual({ status: "PENDENTE", codigo: "TIMEOUT", envioIniciado: true });
  });
  it("corpo não pode fornecer lease/provider/modelo/store/ator; falta vínculo de upload nega", async () => {
    const db = abrirLedger(":memory:"); bancos.push(db);
    const sessoes = criarGerenciadorSessao({ medicoId: "m", crm: "CRM", senha: "senha-sintetica-comprida", duracaoMs: 60000, agora: () => agora });
    const token = sessoes.login("senha-sintetica-comprida")!.token; sessoes.selecionarConsulta(token, ctx);
    const a = await preparar();
    const deps: ServidorDeps = { db, sessoes, gateway: a.gateway, extracaoLlm: a.runtime, agora: () => agora, log: () => {} };
    const pedido = { ...ctx, draftId: "fonte", idempotencyKey: intent.idempotencyKey };
    for (const field of ["lease", "provider", "modelo", "store", "ator"]) expect((await executarDocumentoOriginalLlm({ ...pedido, [field]: true }, token, deps)).status).toBe(400);
    expect(a.extrair).not.toHaveBeenCalled();
  });
  it("fonte de upload local produz só draft; fonte mudou durante await não persiste derivado", async () => {
    for (const mudar of [false, true]) {
      const db = abrirLedger(":memory:"); bancos.push(db);
      const sessoes = criarGerenciadorSessao({ medicoId: "m", crm: "CRM", senha: "senha-sintetica-comprida", duracaoMs: 3600000, agora: () => agora });
      const login = sessoes.login("senha-sintetica-comprida")!; sessoes.selecionarConsulta(login.token, ctx);
      salvarDraft(db, { draftId: "cad", patientId: ctx.patientId, sourceId: "cad", rawRef: "local", payload: {}, diagnostics: [], revision: 0, criadoEm: agora });
      confirmar(db, { operationId: "cad", ...ctx, sessao: login.sessao, reviewDecisionId: "rev", em: agora,
        registros: [{ draftId: "cad", expectedRevision: 0, eventId: "evcad", tipo: "Paciente", revisao: "CONFIRMADO", fontes: [],
          payload: { patientId: ctx.patientId, nome, identificadores: [], nascimento: null, sexoCadastral: "F", divergencia: false } }] });
      const fonte = { draftId: "original", patientId: null, sourceId: "source", rawRef: "upload-local:arquivo", diagnostics: [], revision: 0, criadoEm: agora,
        payload: { kind: "EXTRACAO_RASCUNHO", contextoUpload: ctx, original: { tipo: "PDF", bytesBase64: base64, contentHash: sourceHash } } };
      salvarDraft(db, fonte);
      const antes = db.prepare("SELECT count(*) AS n FROM clinical_event").get()!.n;
      const extrair = vi.fn(async () => { if (mudar) salvarDraft(db, { ...fonte, revision: 1, payload: { alterado: true } }); return saida(); });
      const runtime = criarRuntimeExtracaoLlm({ env, transporte: { extrair }, agora: () => agora });
      const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: { LLM_EXTRACAO: runtime.executor }, validarDocumentoOriginalLlm: runtime.validarDocumentoOriginalLlm });
      const deps: ServidorDeps = { db, sessoes, gateway, extracaoLlm: runtime, agora: () => agora, log: () => {},
        motorF1: criarMotorF1(db, () => agora, () => ({ regras: [], biblioteca: corr.biblioteca })) };
      const r = await executarDocumentoOriginalLlm({ ...ctx, draftId: "original", idempotencyKey: intent.idempotencyKey }, login.token, deps);
      expect(r.status).toBe(mudar ? 409 : 201); expect(db.prepare("SELECT count(*) AS n FROM clinical_event").get()!.n).toBe(antes);
      expect(listarDrafts(db).filter(d => (d.payload as {kind?:string}).kind === "D66_TRANSCRICAO_RASCUNHO")).toHaveLength(mudar ? 0 : 1);
      expect(extrair).toHaveBeenCalledOnce();
    }
  });
});
