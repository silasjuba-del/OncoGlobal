import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft, listarDrafts, listarEventos } from "../../../src/kernel/comandos/portas.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarRuntimeExtracaoLlm } from "../../../src/kernel/llm/openai/runtime.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import { criarMotorF1 } from "../../../src/kernel/orquestracao/runtime.js";
import { SintesePropostaResposta } from "../../../src/contracts/api/sinteseProposta.js";
const agora = "2026-10-12T12:00:00Z", ctx = { patientId: "patient-sintese-s11", encounterId: "e", tumorLotId: null };
const env = { ONCOASSIST_OPENAI_ENABLED: "true", ONCOASSIST_OPENAI_MODEL: "modelo-sintetico", OPENAI_API_KEY: "key-test" };
const fechamentos: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of fechamentos.splice(0)) await close(); });
async function abrir(modo: "ok" | "disabled" | "refs" | "stale") {
  const db = abrirLedger(":memory:"); const sessoes = criarGerenciadorSessao({ medicoId: "m", crm: "CRM", senha: "senha-sintetica-comprida", duracaoMs: 3600000, agora: () => agora });
  const login = sessoes.login("senha-sintetica-comprida")!; sessoes.selecionarConsulta(login.token, ctx);
  salvarDraft(db, { draftId: "cad", patientId: ctx.patientId, sourceId: "cad", rawRef: "local", payload: {}, diagnostics: [], revision: 0, criadoEm: agora });
  confirmar(db, { operationId: "cad", ...ctx, sessao: login.sessao, reviewDecisionId: "rev", em: agora, registros: [{ draftId: "cad", expectedRevision: 0,
    eventId: "evcad", tipo: "Paciente", revisao: "CONFIRMADO", fontes: [], payload: { patientId: ctx.patientId, nome: "Maria Sintetica", identificadores: [], nascimento: null, sexoCadastral: "F", divergencia: false } }] });
  const motor = criarMotorF1(db, () => agora, () => ({ regras: [], biblioteca: { id: "bib", versao: "1", hash: "hash" } }));
  const extrair = vi.fn(async (payload: Readonly<Record<string, unknown>>) => {
    const serialized = JSON.stringify(payload); expect(serialized).not.toContain("Maria Sintetica"); expect(serialized).not.toContain("evcad");
    const data = payload as { input: { content: { text: string }[] }[] };
    const pages = JSON.parse(data.input[0]!.content[0]!.text) as { paginas: { n: number; texto: string }[] };
    const pagina = pages.paginas.at(-1)!;
    if (modo === "stale") sessoes.selecionarConsulta(login.token, { ...ctx, encounterId: "outro" });
    return { candidatos: [], resumo: [{ texto: pagina.texto, referencias: [{ fonteId: "FONTE_1", pagina: modo === "refs" ? 999 : pagina.n, trecho: pagina.texto }] }] };
  });
  const runtime = criarRuntimeExtracaoLlm({ env: modo === "disabled" ? {} : env, transporte: { extrair }, agora: () => agora });
  const gateway = criarGateway({ store: memoriaIdempotencia(), agora: () => agora, auditar: () => {}, executores: { LLM_EXTRACAO: runtime.executor }, validarExtracaoLlm: runtime.validarExtracaoLlm });
  const server = criarServidorLocal({ db, sessoes, gateway, motorF1: motor, extracaoLlm: runtime, agora: () => agora, log: () => {} }, { port: 0 });
  await new Promise<void>(resolve => server.once("listening", resolve)); const address = server.address(); if (!address || typeof address === "string") throw Error();
  fechamentos.push(async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); });
  const request = async (body: unknown) => { const r = await fetch(`http://127.0.0.1:${address.port}/consulta/oncoassist/sintese`, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  return { db, motor, extrair, request };
}
const pedido = { ...ctx, idempotencyKey: "sintese-http-000001" };
describe("S8 síntese citada por HTTP sem trocar canônico", () => {
  it("quote literal vira proposta com referência real, sem evento ou mudança do resumo", async () => {
    const a = await abrir("ok"), antes = a.motor.retrato(ctx); const eventos = listarEventos(a.db, ctx.patientId).length;
    const r = await a.request(pedido); expect(r.status, JSON.stringify(r.body)).toBe(201);
    const resposta = SintesePropostaResposta.parse(r.body); expect(resposta.proposta!.status).toBe("PROPOSTA_DE_SINTESE");
    expect(resposta.proposta!.citacoes[0]!.fatos).toEqual([antes.fatos.find(f => f.ref.eventId === "evcad")!.ref]);
    expect(a.motor.retrato(ctx).resumo).toEqual(antes.resumo); expect(listarEventos(a.db, ctx.patientId)).toHaveLength(eventos);
    expect((await a.request(pedido)).status).toBe(200); expect(a.extrair).toHaveBeenCalledOnce();
  });
  it("desabilitada mantém resumo determinístico e zero chamadas", async () => {
    const a = await abrir("disabled"), resumo = a.motor.retrato(ctx).resumo;
    const r = await a.request(pedido); expect(r.status).toBe(409); expect(r.body.codigo).toBe("PENDENTE");
    expect(a.extrair).not.toHaveBeenCalled(); expect(a.motor.retrato(ctx).resumo).toEqual(resumo);
  });
  it.each(["refs", "stale"] as const)("%s não cria proposta nem fatos", async modo => {
    const a = await abrir(modo); const r = await a.request(pedido);
    expect(r.status).toBe(409); expect(listarDrafts(a.db).filter(d => (d.payload as {kind?:string}).kind === "SINTESE_RASCUNHO")).toHaveLength(0);
  });
  it("paciente no corpo diferente do selecionado impede provider", async () => {
    const a = await abrir("ok"); expect((await a.request({ ...pedido, patientId: "outro" })).status).toBe(409); expect(a.extrair).not.toHaveBeenCalled();
  });
});
