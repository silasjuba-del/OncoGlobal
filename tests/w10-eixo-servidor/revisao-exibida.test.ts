import { afterEach, describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao, hashConteudoExibido } from "../../src/server/sessao.js";
import type { ServidorDeps } from "../../src/server/rotas.js";
import { criarOncoassistJev } from "../../src/app/oncoassist.js";

const NOW = "2026-10-07T13:00:00.000Z";
const PATIENT = "Paciente Teste 91";
const CONTEXTO = { patientId: PATIENT, encounterId: "consulta-teste-91", tumorLotId: null };
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanups.splice(0)) await close(); });

async function fixture(oncoassistJev?: ServidorDeps["oncoassistJev"]) {
  let now = NOW;
  const db = abrirLedger(":memory:");
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste-91", crm: "CRM-TESTE-91",
    senha: "senha-sintetica-longa-91", duracaoMs: 60_000, agora: () => now });
  const token = sessoes.login("senha-sintetica-longa-91")!.token;
  const server = criarServidorLocal({ db, sessoes, agora: () => now, log: () => {},
    gateway: criarGateway({ agora: () => now, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    ...(oncoassistJev ? { oncoassistJev } : {}) });
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  cleanups.push(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); db.close(); });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("PORTA_AUSENTE");
  const port = addr.port;
  async function request(path: string, body: unknown, auth = token) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() as any };
  }
  salvarDraft(db, { draftId: "paciente-91", patientId: PATIENT, sourceId: "cadastro-91", rawRef: "fixture",
    payload: {}, diagnostics: [], revision: 0, criadoEm: NOW });
  confirmar(db, { ...CONTEXTO, operationId: "cadastro-op-91", reviewDecisionId: "cadastro-review-91",
    sessao: sessoes.obter(token)!, em: NOW, registros: [{ draftId: "paciente-91", expectedRevision: 0,
      eventId: "paciente-event-91", tipo: "Paciente", fontes: [], revisao: "CONFIRMADO",
      payload: { patientId: PATIENT, nome: PATIENT, identificadores: [{ tipo: "PRONTUARIO", valor: "sintetico-91" }],
        nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false } }] });
  await request("/consulta/carregar", { patientId: PATIENT });
  const extracted = await request("/consulta/extrair", { sourceId: "laudo-91", recordingId: "gravacao-91",
    sourceType: "medical_note", rawTranscript: "01/09/2026 creatinina 1,2 mg/dL; Hb 11,2 g/dL" });
  expect(extracted.status).toBe(201);
  expect(extracted.data.facts).toHaveLength(2);
  const draftId = extracted.data.draftId as string;
  const linked = await request("/consulta/rascunho/revisar", { draftId, patientId: PATIENT, expectedRevision: 0 });
  expect(linked.status).toBe(200);
  const pedido = { draftId, patientId: PATIENT, expectedRevision: 1,
    factIds: extracted.data.facts.map((fact: { id: string }) => fact.id) as string[], operationId: "review-op-91" };
  return { db, sessoes, token, request, pedido, advance: () => { now = "2026-10-07T13:00:01.000Z"; },
    expire: () => { now = "2026-10-07T13:02:00.000Z"; },
    reviewed: () => listarEventos(db, PATIENT).filter((event) => event.operationId === pedido.operationId) };
}

describe("G25 · revisão da extração exige conteúdo preparado e exibido na mesma sessão", () => {
  it("nega promoção de fatos sem exibição e mantém rascunho salvo", async () => {
    const app = await fixture();
    const result = await app.request("/consulta/rascunho/revisar", app.pedido);
    expect(result).toMatchObject({ status: 409, data: { codigo: "BUNDLE_NAO_EXIBIDO" } });
    expect(app.reviewed()).toEqual([]);
    expect(lerDraft(app.db, app.pedido.draftId)?.revision).toBe(1);
  });

  it("retorna fatos, trechos, fontes e resumo exatos; confirma só depois; replay continua estável", async () => {
    const app = await fixture();
    const prepared = await app.request("/consulta/rascunho/preparar-revisao", app.pedido);
    expect(prepared.status).toBe(200);
    expect(prepared.data.criaEventoClinico).toBe(false);
    expect(prepared.data.conteudo.facts).toHaveLength(2);
    expect(prepared.data.conteudo.facts[0].rawEvidence).toBeTruthy();
    expect(prepared.data.conteudo.fontes[0].sourceId).toBe("laudo-91");
    expect(prepared.data.conteudo.resumo).toContain("creatinina");
    expect(prepared.data.comprovanteExibicao.conteudoHash).toBe(hashConteudoExibido(prepared.data.conteudo));
    expect(app.reviewed()).toEqual([]);
    app.advance();
    const confirm = { ...app.pedido, comprovanteExibicao: prepared.data.comprovanteExibicao };
    expect((await app.request("/consulta/rascunho/revisar", confirm)).status).toBe(200);
    expect(app.reviewed()).toHaveLength(2);
    expect(app.reviewed().every((event) => event.tipo === "FATO")).toBe(true);
    expect((await app.request("/consulta/rascunho/revisar", confirm)).data.codigo).toBe("REPLAY");
    expect(app.reviewed()).toHaveLength(2);
  });

  it("nega prova forjada e seleção diferente da mostrada", async () => {
    const app = await fixture();
    const prepared = await app.request("/consulta/rascunho/preparar-revisao", app.pedido);
    const proof = prepared.data.comprovanteExibicao;
    expect((await app.request("/consulta/rascunho/revisar", { ...app.pedido,
      comprovanteExibicao: { ...proof, conteudoHash: "0".repeat(64) } })).status).toBe(409);
    expect((await app.request("/consulta/rascunho/revisar", { ...app.pedido,
      factIds: [app.pedido.factIds[0]], comprovanteExibicao: proof })).status).toBe(409);
    expect(app.reviewed()).toEqual([]);
  });

  it("nega conteúdo alterado mesmo mantendo a revisão do envelope", async () => {
    const app = await fixture();
    const prepared = await app.request("/consulta/rascunho/preparar-revisao", app.pedido);
    const draft = lerDraft(app.db, app.pedido.draftId)!;
    const payload = structuredClone(draft.payload) as any;
    payload.state.facts[0].rawEvidence = "trecho substituído depois da tela";
    app.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?")
      .run(JSON.stringify(payload), draft.draftId);
    expect((await app.request("/consulta/rascunho/revisar", { ...app.pedido,
      comprovanteExibicao: prepared.data.comprovanteExibicao })).status).toBe(409);
    expect(app.reviewed()).toEqual([]);
  });

  it("invalida prova ao trocar encontro/lote, voltar à consulta, ou usar outra sessão", async () => {
    const app = await fixture();
    const prepared = await app.request("/consulta/rascunho/preparar-revisao", app.pedido);
    const confirm = { ...app.pedido, comprovanteExibicao: prepared.data.comprovanteExibicao };
    app.sessoes.selecionarConsulta(app.token, { ...CONTEXTO, tumorLotId: "outro-lote" });
    expect((await app.request("/consulta/rascunho/revisar", confirm)).status).toBe(409);
    app.sessoes.selecionarConsulta(app.token, CONTEXTO);
    expect((await app.request("/consulta/rascunho/revisar", confirm)).data.codigo).toBe("BUNDLE_NAO_EXIBIDO");
    const other = app.sessoes.login("senha-sintetica-longa-91")!.token;
    app.sessoes.selecionarConsulta(other, CONTEXTO);
    expect((await app.request("/consulta/rascunho/revisar", confirm, other)).data.codigo).toBe("BUNDLE_NAO_EXIBIDO");
    expect(app.reviewed()).toEqual([]);
  });

  it("mantém INFERRED e UNCERTAIN como decisões de revisão, nunca FATO confirmado", async () => {
    const app = await fixture();
    const draft = lerDraft(app.db, app.pedido.draftId)!;
    const payload = structuredClone(draft.payload) as any;
    payload.state.facts[0].evidence = "INFERRED";
    payload.state.facts[0].regra = "inferência sintética para provar ausência de promoção";
    payload.state.facts[1].evidence = "UNCERTAIN";
    app.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?")
      .run(JSON.stringify(payload), draft.draftId);
    const prepared = await app.request("/consulta/rascunho/preparar-revisao", app.pedido);
    expect(prepared.status).toBe(200);
    expect((await app.request("/consulta/rascunho/revisar", { ...app.pedido,
      comprovanteExibicao: prepared.data.comprovanteExibicao })).status).toBe(200);
    expect(app.reviewed()).toHaveLength(2);
    expect(app.reviewed().every((event) => event.tipo === "ReviewDecision")).toBe(true);
  });
});

describe("OncoAssist HTTP · contexto e fonte locais", () => {
  it("nomes inéditos no documento não alcançam o transporte real do serviço Jev", async () => {
    const enviados: string[] = [];
    const app = await fixture(criarOncoassistJev({ env: { ONCOASSIST_JEV_ENABLED: "true", TYPESAFE_API_KEY: "teste" },
      transporte: { avaliar: async (texto) => { enviados.push(texto); return null; } } }));
    const draft = lerDraft(app.db, app.pedido.draftId)!;
    const payload = structuredClone(draft.payload) as any;
    payload.input.rawTranscript += " Familiar: Zorélia Vintalux. Dr. Xandor Velquim.";
    salvarDraft(app.db, { ...draft, payload, revision: draft.revision + 1 });
    expect((await app.request("/consulta/oncoassist/classificar-fonte", { ...CONTEXTO, draftId: draft.draftId })).status).toBe(200);
    expect(enviados).toEqual(["Marcadores documentais (vocabulário fechado): Creatinina."]);
    expect(app.reviewed()).toEqual([]);
  });

  it("sessão expirada durante o provedor retorna 401, sem conteúdo da resposta", async () => {
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const app = await fixture({ status: () => ({ status: "DISPONIVEL" }),
      avaliar: async () => { entered(); await pending; return { status: "PENDENTE", codigo: "DESABILITADO" }; } });
    const result = app.request("/consulta/oncoassist/classificar-fonte", { ...CONTEXTO, draftId: app.pedido.draftId });
    await started;
    app.expire(); release();
    expect(await result).toMatchObject({ status: 401, data: { codigo: "SESSAO_INVALIDA" } });
  });
  it("descarta resposta pendente quando a consulta muda durante a avaliação", async () => {
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const app = await fixture({ status: () => ({ status: "DISPONIVEL" }),
      avaliar: async () => { entered(); await pending; return { status: "PENDENTE", codigo: "DESABILITADO" }; } });
    const result = app.request("/consulta/oncoassist/classificar-fonte", { ...CONTEXTO, draftId: app.pedido.draftId });
    await started;
    app.sessoes.selecionarConsulta(app.token, { ...CONTEXTO, encounterId: "outra-consulta" });
    release();
    expect(await result).toMatchObject({ status: 409, data: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } });
    expect(app.reviewed()).toEqual([]);
  });

  it("autentica, lista fonte só da consulta e nunca aceita texto/dicionário do cliente", async () => {
    const calls: unknown[] = [];
    const app = await fixture({ status: () => ({ status: "PENDENTE", motivo: "DESABILITADO" }),
      avaliar: async (...args) => { calls.push(args); return { status: "PENDENTE", codigo: "DESABILITADO" }; } });
    expect((await app.request("/consulta/oncoassist/status", {}, "")).status).toBe(401);
    expect((await app.request("/consulta/oncoassist/status", {})).data.status).toBe("PENDENTE");
    const listed = await app.request("/consulta/oncoassist/fontes", CONTEXTO);
    expect(listed.data.fontes).toEqual([expect.objectContaining({ draftId: app.pedido.draftId })]);
    expect(JSON.stringify(listed.data)).not.toContain("creatinina");
    const body = { ...CONTEXTO, draftId: app.pedido.draftId };
    expect((await app.request("/consulta/oncoassist/classificar-fonte", { ...body, texto: "substituído" })).status).toBe(400);
    expect((await app.request("/consulta/oncoassist/classificar-fonte", { ...body, dicionario: { nomes: [] } })).status).toBe(400);
    expect((await app.request("/consulta/oncoassist/classificar-fonte", { ...body, encounterId: "outro" })).status).toBe(409);
    expect(calls).toEqual([]);
    expect((await app.request("/consulta/oncoassist/classificar-fonte", body)).status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject([{ fonte: { id: "laudo-91", texto: "01/09/2026 creatinina 1,2 mg/dL; Hb 11,2 g/dL" } },
      { dicionario: { nomes: [PATIENT], identificadores: expect.arrayContaining(["sintetico-91"]) } }, {}]);
    expect(app.reviewed()).toEqual([]);
    app.sessoes.selecionarConsulta(app.token, { ...CONTEXTO, encounterId: "outra-consulta" });
    expect((await app.request("/consulta/oncoassist/fontes", { ...CONTEXTO, encounterId: "outra-consulta" })).data.fontes).toEqual([]);
  });
});

it("seleciona lote no servidor, reprojeta a consulta inteira e nega lote de outro paciente", async () => {
  const app = await fixture();
  const absent = () => ({ valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não consta",
    fontes: [], revisao: "RAW" });
  for (const [tumorLotId, patientId] of [["lote-a-91", PATIENT], ["lote-b-91", PATIENT],
    ["lote-c-92", "Paciente Teste 92"]] as const) {
    const draftId = `cadastro-${tumorLotId}`;
    salvarDraft(app.db, { draftId, patientId, sourceId: "fixture-lote", rawRef: "fixture",
      payload: {}, diagnostics: [], revision: 0, criadoEm: NOW });
    confirmar(app.db, { patientId, encounterId: CONTEXTO.encounterId, tumorLotId,
      operationId: `op-${tumorLotId}`, reviewDecisionId: `review-${tumorLotId}`, em: NOW,
      sessao: app.sessoes.obter(app.token)!, registros: [{ draftId, expectedRevision: 0,
        eventId: `event-${tumorLotId}`, tipo: "TumorLot", revisao: "CONFIRMADO", fontes: [],
        payload: { patientId, tumorLotId, cid: absent(), topografia: absent(), histologia: absent(),
          estadiamentos: [], finalidadeApac: absent(), marcos: [] } }] });
    salvarDraft(app.db, { draftId: `resumo-${tumorLotId}`, patientId, sourceId: "fixture-resumo", rawRef: "fixture",
      payload: { kind: "EVOLUCAO_RASCUNHO", contexto: { patientId, tumorLotId, encounterId: CONTEXTO.encounterId },
        resumo: `Resumo sintético ${tumorLotId}` }, diagnostics: [], revision: 0, criadoEm: NOW });
  }
  const first = await app.request("/consulta/carregar", { patientId: PATIENT, tumorLotId: "lote-a-91" });
  expect(first.status).toBe(200);
  expect(first.data.tumorLotId).toBe("lote-a-91");
  expect(first.data.cabecalho.loteSelecionadoId).toBe("lote-a-91");
  expect(first.data.resumoEvolucao).toContain("lote-a-91");
  expect(first.data.resumoEvolucao).not.toContain("lote-b-91");
  expect(first.data.fechamento.registros).toEqual([{ id: "resumo-lote-a-91", expectedRevision: 0 }]);
  const scopeA = { ...CONTEXTO, tumorLotId: "lote-a-91" };
  expect(app.sessoes.consultaSelecionada(app.token)).toEqual(scopeA);
  app.sessoes.registrarBundleExibido(app.token, scopeA, []);
  const second = await app.request("/consulta/carregar", { patientId: PATIENT, tumorLotId: "lote-b-91" });
  expect(second.data.resumoEvolucao).toContain("lote-b-91");
  expect(second.data.resumoEvolucao).not.toContain("lote-a-91");
  expect(app.sessoes.bundleExibido(app.token, scopeA)).toBeNull();
  expect(app.sessoes.consultaSelecionada(app.token)?.tumorLotId).toBe("lote-b-91");
  const unselected = await app.request("/consulta/carregar", { patientId: PATIENT, tumorLotId: null });
  expect(unselected.data.tumorLotId).toBeNull();
  expect(unselected.data.resumoEvolucao).toBeNull();
  const foreign = await app.request("/consulta/carregar", { patientId: PATIENT, tumorLotId: "lote-c-92" });
  expect(foreign).toMatchObject({ status: 404, data: { codigo: "TUMOR_LOT_FORA_DO_PACIENTE" } });
  expect(app.sessoes.consultaSelecionada(app.token)).toBeNull();
});
