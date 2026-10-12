import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft, listarDrafts, lerDraft, listarEventos } from "../../../src/kernel/comandos/portas.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarRuntimeExtracaoLlm } from "../../../src/kernel/llm/openai/runtime.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import type { OpcoesOpenAi } from "../../../src/kernel/llm/openai/index.js";

const agora = "2026-10-12T12:00:00Z", senha = "senha-sintetica-comprida", ctx = { patientId: "patient-http-s11", encounterId: "e", tumorLotId: null };
const env = { ONCOASSIST_OPENAI_ENABLED: "true", ONCOASSIST_OPENAI_MODEL: "modelo-sintetico", OPENAI_API_KEY: "key-test" };
const output = () => ({ candidatos: [{ id: "c", campo: "LAB", valor: "1,2", unidade: "mg/dL", dataClinica: null,
  referencia: { fonteId: "FONTE_1", pagina: 1, trecho: "Creatinina 1,2 mg/dL" } }], resumo: [] });
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });
async function abrir(opcoes: OpcoesOpenAi) {
  const db = abrirLedger(":memory:");
  const sessoes = criarGerenciadorSessao({ medicoId: "m", crm: "CRM", senha, duracaoMs: 60000, agora: () => agora });
  const login = sessoes.login(senha)!; sessoes.selecionarConsulta(login.token, ctx);
  salvarDraft(db, { draftId: "cadastro", patientId: "patient-http-s11", sourceId: "cad", rawRef: "local", payload: {}, diagnostics: [], revision: 0, criadoEm: agora });
  confirmar(db, { operationId: "cadastro", ...ctx, sessao: login.sessao, reviewDecisionId: "revisao", em: agora, registros: [{ draftId: "cadastro", expectedRevision: 0,
    eventId: "evcad", tipo: "Paciente", revisao: "CONFIRMADO", fontes: [], payload: { patientId: "patient-http-s11", nome: "Maria Teste", identificadores: [], nascimento: null, sexoCadastral: "F", divergencia: false } }] });
  salvarDraft(db, { draftId: "fonte", patientId: "patient-http-s11", sourceId: "source", rawRef: "upload-local-explicito", revision: 0, criadoEm: agora, diagnostics: [],
    payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: "source", rawTranscript: "Maria Teste. Creatinina 1,2 mg/dL" },
      patientLinkReview: { ...ctx, segmentId: "seg" }, state: { segments: [{ id: "seg", sourceId: "source", rawTranscript: "Maria Teste. Creatinina 1,2 mg/dL" }] } } });
  const runtime = criarRuntimeExtracaoLlm(opcoes);
  const gateway = criarGateway({ store: memoriaIdempotencia(), agora: () => agora, auditar: () => {},
    executores: { LLM_EXTRACAO: runtime.executor }, validarExtracaoLlm: runtime.validarExtracaoLlm });
  const server = criarServidorLocal({ db, sessoes, gateway, extracaoLlm: runtime, agora: () => agora, log: () => {} }, { port: 0 });
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address(); if (!addr || typeof addr === "string") throw Error();
  closers.push(async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); });
  const request = async (body: unknown) => {
    const r = await fetch(`http://127.0.0.1:${addr.port}/consulta/llm/extrair`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  };
  return { db, sessoes, token: login.token, request };
}
const pedido = { ...ctx, draftId: "fonte", idempotencyKey: "extracao-http-0001" };
describe("S11 HTTP→gateway→LLM→draft sem fato", () => {
  it("desabilitado retorna PENDENTE409 e nunca chama transporte", async () => {
    const extrair = vi.fn(); const a = await abrir({ env: {}, transporte: { extrair } });
    const r = await a.request(pedido); expect(r.status).toBe(409); expect(r.body.codigo).toBe("PENDENTE"); expect(extrair).not.toHaveBeenCalled();
  });
  it("extrai proposta desidentificada pelo gateway, persiste draft e replay não duplica", async () => {
    const extrair = vi.fn(async (payload: Readonly<Record<string, unknown>>) => { expect(JSON.stringify(payload)).not.toContain("Maria Teste"); return output(); });
    const a = await abrir({ env, transporte: { extrair } }); const antes = listarEventos(a.db, "patient-http-s11").length;
    const r = await a.request(pedido); expect(r.status, JSON.stringify(r)).toBe(201); expect(r.body.criaEventoClinico).toBe(false);
    expect(listarEventos(a.db, "patient-http-s11")).toHaveLength(antes); expect(listarDrafts(a.db).filter(d => (d.payload as {kind?:string}).kind === "LLM_EXTRACAO_RASCUNHO")).toHaveLength(1);
    expect((await a.request(pedido)).status).toBe(200); expect(extrair).toHaveBeenCalledOnce();
  });
  it("troca de paciente no corpo não autoriza fonte", async () => {
    const extrair = vi.fn(); const a = await abrir({ env, transporte: { extrair } });
    expect((await a.request({ ...pedido, patientId: "outro" })).status).toBe(409); expect(extrair).not.toHaveBeenCalled();
  });
  it.each(["contexto", "fonte"])("mudança de %s durante await descarta resultado", async tipo => {
    let liberar!: (v: unknown) => void; let iniciou!: () => void;
    const started = new Promise<void>(resolve => { iniciou = resolve; });
    const deferred = new Promise<unknown>(resolve => { liberar = resolve; });
    const a = await abrir({ env, transporte: { extrair: async () => { iniciou(); return deferred; } } });
    const espera = a.request(pedido); await Promise.race([started, espera.then(r => { throw Error(JSON.stringify(r)); })]);
    if (tipo === "contexto") a.sessoes.selecionarConsulta(a.token, { ...ctx, encounterId: "outro" });
    else { const d = lerDraft(a.db, "fonte")!; salvarDraft(a.db, { ...d, revision: 1, payload: { alterado: true } }); }
    liberar(output()); const r = await espera;
    expect(r.status).toBe(409); expect(listarDrafts(a.db).filter(d => (d.payload as {kind?:string}).kind === "LLM_EXTRACAO_RASCUNHO")).toHaveLength(0);
  });
});
