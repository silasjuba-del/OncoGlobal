import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft, listarDrafts, lerDraft, listarEventos } from "../../../src/kernel/comandos/portas.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarRuntimeExtracaoLlm } from "../../../src/kernel/llm/openai/runtime.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import type { OpcoesOpenAi } from "../../../src/kernel/llm/openai/index.js";
import { RelatorioCognitivoExtracaoSchema } from "../../../src/contracts/cognitivoExtracao.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256Biblioteca } from "../../../src/kernel/corpus/biblioteca.js";
import { HistoricoOncoassist } from "../../../src/contracts/api/oncoassist.js";

const agora = "2026-10-12T12:00:00Z", senha = "senha-sintetica-comprida", ctx = { patientId: "patient-http-s11", encounterId: "e", tumorLotId: null };
const env = { ONCOASSIST_OPENAI_ENABLED: "true", ONCOASSIST_OPENAI_MODEL: "modelo-sintetico", OPENAI_API_KEY: "key-test" };
const output = () => ({ candidatos: [{ id: "c", campo: "LAB", valor: "1,2", unidade: "mg/dL", dataClinica: null,
  referencia: { fonteId: "FONTE_1", pagina: 1, trecho: "Creatinina 1,2 mg/dL" } }], resumo: [] });
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });
async function abrir(opcoes: OpcoesOpenAi, textoFonte = "Maria Teste. Creatinina 1,2 mg/dL", sourceType = "medical_note", dbPath = ":memory:", captureMethod?: string) {
  const db = abrirLedger(dbPath);
  const sessoes = criarGerenciadorSessao({ medicoId: "m", crm: "CRM", senha, duracaoMs: 60000, agora: () => agora });
  const login = sessoes.login(senha)!; sessoes.selecionarConsulta(login.token, ctx);
  if (!lerDraft(db, "cadastro")) {
  salvarDraft(db, { draftId: "cadastro", patientId: "patient-http-s11", sourceId: "cad", rawRef: "local", payload: {}, diagnostics: [], revision: 0, criadoEm: agora });
  confirmar(db, { operationId: "cadastro", ...ctx, sessao: login.sessao, reviewDecisionId: "revisao", em: agora, registros: [{ draftId: "cadastro", expectedRevision: 0,
    eventId: "evcad", tipo: "Paciente", revisao: "CONFIRMADO", fontes: [], payload: { patientId: "patient-http-s11", nome: "Maria Teste", identificadores: [], nascimento: null, sexoCadastral: "F", divergencia: false } }] });
  salvarDraft(db, { draftId: "fonte", patientId: "patient-http-s11", sourceId: "source", rawRef: "upload-local-explicito", revision: 0, criadoEm: agora, diagnostics: [],
    payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: "source", rawTranscript: textoFonte, sourceType,
      ...(captureMethod ? { captureMethod, capturedTranscript: "Creatinina 12" } : {}) },
      patientLinkReview: { ...ctx, segmentId: "seg" }, state: { segments: [{ id: "seg", sourceId: "source", rawTranscript: textoFonte }] } } });
  }
  const runtime = criarRuntimeExtracaoLlm(opcoes);
  const gateway = criarGateway({ store: memoriaIdempotencia(), agora: () => agora, auditar: () => {},
    executores: { LLM_EXTRACAO: runtime.executor }, validarExtracaoLlm: runtime.validarExtracaoLlm });
  const server = criarServidorLocal({ db, sessoes, gateway, extracaoLlm: runtime, agora: () => agora, log: () => {} }, { port: 0 });
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address(); if (!addr || typeof addr === "string") throw Error();
  let fechado = false;
  const fechar = async () => { if (fechado) return; fechado = true; await new Promise<void>(resolve => server.close(() => resolve())); db.close(); };
  closers.push(fechar);
  const request = async (body: unknown, caminho = "/consulta/llm/extrair") => {
    const r = await fetch(`http://127.0.0.1:${addr.port}${caminho}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  };
  return { db, sessoes, token: login.token, request, fechar };
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
    const relatorio = RelatorioCognitivoExtracaoSchema.parse(r.body.cognitivo);
    expect(relatorio.estado).toBe("AVALIADO");
    if (relatorio.estado !== "AVALIADO") throw Error("Relatório cognitivo ausente");
    expect(relatorio.harness.status).toBe("APTO_PARA_REVISAO_HUMANA");
    expect(relatorio.proposta.itensPropostos[0]?.valorProposto).toBe("1,2");
    expect(relatorio.proposta.itensPropostos[0]?.validado).toBe(false);
    expect(relatorio.proposta.itensPropostos[0]?.citacoes[0]?.localizador).toBe("segmento:seg");
    const salvo = lerDraft(a.db, String(r.body.draftId))!;
    expect(confirmar(a.db, { operationId: "tentativa-promocao", ...ctx, sessao: a.sessoes.obter(a.token)!, em: agora,
      reviewDecisionId: "decisao-sintetica", registros: [{ draftId: salvo.draftId, expectedRevision: salvo.revision,
        eventId: "fato-indevido", tipo: "FATO", revisao: "CONFIRMADO", fontes: [], payload: { campo: "LAB", valor: 1.2 } }],
    }).estado).toBe("NEGADA");
    expect((salvo.payload as { cognitivo: unknown }).cognitivo).toEqual(relatorio);
    const replay = await a.request(pedido);
    expect(replay.status).toBe(200); expect(replay.body.cognitivo).toEqual(relatorio); expect(extrair).toHaveBeenCalledOnce();
    expect((await a.request({ draftId: salvo.draftId }, "/consulta/rascunho")).status).toBe(409);
    const leitura = await a.request({ ...ctx, draftId: salvo.draftId }, "/consulta/llm/resultado");
    expect(leitura.status).toBe(200);
    expect(leitura.body.cognitivo).toEqual(relatorio);
    expect(leitura.body.validadeFonte).toBe("ATUAL");
    expect(leitura.body.validadeContexto).toBe("ATUAL");
    a.sessoes.selecionarConsulta(a.token, { ...ctx, encounterId: "outra-consulta" });
    expect((await a.request({ ...ctx, encounterId: "outra-consulta", draftId: salvo.draftId }, "/consulta/llm/resultado")).status).toBe(409);
  });
  it("preserva alegação bloqueada pelo harness sem transformá-la em fato", async () => {
    const extrair = vi.fn(async () => ({ candidatos: [{ id: "sintoma", campo: "SINTOMA", valor: "dispneia", unidade: null,
      dataClinica: null, referencia: { fonteId: "FONTE_1", pagina: 1, trecho: "dispneia" } }], resumo: [] }));
    const a = await abrir({ env, transporte: { extrair } }, "Nega dispneia.");
    const antes = listarEventos(a.db, ctx.patientId).length;
    const r = await a.request(pedido);
    expect(r.status).toBe(201);
    const relatorio = RelatorioCognitivoExtracaoSchema.parse(r.body.cognitivo);
    expect(relatorio.estado).toBe("AVALIADO");
    if (relatorio.estado !== "AVALIADO") throw Error("Relatório ausente");
    expect(relatorio.harness.status).toBe("BLOQUEADO_FALHA_CRITICA");
    expect(listarEventos(a.db, ctx.patientId)).toHaveLength(antes);
    expect(lerDraft(a.db, String(r.body.draftId))?.diagnostics).toContain("BLOQUEADO_FALHA_CRITICA");
  });
  it("transcrição de voz mantém número destacado e não declara acurácia", async () => {
    const a = await abrir({ env, transporte: { extrair: async () => output() } }, "Creatinina 1,2 mg/dL", "plaud");
    const r = await a.request(pedido);
    const relatorio = RelatorioCognitivoExtracaoSchema.parse(r.body.cognitivo);
    if (relatorio.estado !== "AVALIADO") throw Error("Relatório ausente");
    expect(relatorio.harness.acuraciaAudioDeclarada).toBe(false);
    expect(relatorio.harness.itensVerificados[0]).toMatchObject({ modalidadeAudio: true, destacadoParaEscutaRevisaoHumana: true, validado: false });
  });
  it.each(["LOCAL_DICTATION", "DEEPGRAM_CLOUD"])("%s não perde modalidade nem origem editada no Brain/harness", async captureMethod => {
    const a = await abrir({ env, transporte: { extrair: async () => output() } }, "Creatinina 1,2 mg/dL", "medical_note", ":memory:", captureMethod);
    const r = await a.request(pedido);
    const relatorio = RelatorioCognitivoExtracaoSchema.parse(r.body.cognitivo);
    if (relatorio.estado !== "AVALIADO") throw Error("Relatório ausente");
    expect(relatorio.harness.itensVerificados[0]).toMatchObject({ modalidadeAudio: true, destacadoParaEscutaRevisaoHumana: true, validado: false });
    expect(relatorio.captura).toMatchObject({ metodo: captureMethod, transcricaoEditada: true, audioConferido: false });
    expect(relatorio.captura?.transcricaoOriginalHash).not.toBe(relatorio.captura?.transcricaoRevisadaHash);
    const recuperado = await a.request({ ...ctx, draftId: r.body.draftId }, "/consulta/llm/resultado");
    expect(recuperado.body.cognitivo).toEqual(relatorio);
  });
  it("recupera relatório após reiniciar servidor/SQLite e identifica mudança da fonte", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oncoglobal-cognitivo-sintetico-"));
    const opcoes = { env, transporte: { extrair: vi.fn(async () => output()) } };
    const path = join(dir, "ledger.sqlite");
    const primeiro = await abrir(opcoes, undefined, undefined, path);
    let segundo: Awaited<ReturnType<typeof abrir>> | undefined;
    try {
      const criado = await primeiro.request(pedido);
      expect(criado.status).toBe(201);
      await primeiro.fechar();
      segundo = await abrir(opcoes, undefined, undefined, path);
      const historicoReaberto = HistoricoOncoassist.parse((await segundo.request(ctx, "/consulta/oncoassist/historico")).body);
      expect(historicoReaberto.extracoesCognitivas?.itens).toHaveLength(1);
      const leitura = { ...ctx, draftId: historicoReaberto.extracoesCognitivas!.itens[0]!.draftId };
      const recuperado = await segundo.request(leitura, "/consulta/llm/resultado");
      expect(recuperado.status).toBe(200);
      expect(recuperado.body.cognitivo).toEqual(criado.body.cognitivo);
      expect(recuperado.body.validadeFonte).toBe("ATUAL");
      const fonte = lerDraft(segundo.db, "fonte")!;
      salvarDraft(segundo.db, { ...fonte, revision: fonte.revision + 1, diagnostics: ["NOVA_REVISAO_SINTETICA"] });
      const historico = await segundo.request(leitura, "/consulta/llm/resultado");
      expect(historico.body.validadeFonte).toBe("FONTE_ALTERADA");
      expect(historico.body.cognitivo).toEqual(criado.body.cognitivo);
      expect(opcoes.transporte.extrair).toHaveBeenCalledOnce();
    } finally {
      await primeiro.fechar(); await segundo?.fechar(); rmSync(dir, { recursive: true, force: true });
    }
  });
  it("troca de paciente no corpo não autoriza fonte", async () => {
    const extrair = vi.fn(); const a = await abrir({ env, transporte: { extrair } });
    expect((await a.request({ ...pedido, patientId: "outro" })).status).toBe(409); expect(extrair).not.toHaveBeenCalled();
  });
  it("histórico redescobre extrações paginadas, sem texto clínico e sem misturar consultas", async () => {
    const extrair = vi.fn(async () => output());
    const a = await abrir({ env, transporte: { extrair } });
    for (let i = 0; i < 3; i++) expect((await a.request({ ...pedido, idempotencyKey: `historico-${i}` })).status).toBe(201);
    const vistos: string[] = [];
    let cursor: string | null = null;
    for (let pagina = 0; pagina < 3; pagina++) {
      const r = await a.request({ ...ctx, limiteExtracoes: 1, ...(cursor ? { cursorExtracoes: cursor } : {}) }, "/consulta/oncoassist/historico");
      expect(r.status).toBe(200);
      const dados = HistoricoOncoassist.parse(r.body).extracoesCognitivas!;
      expect(dados.itens).toHaveLength(1);
      expect(dados.itens[0]).toMatchObject({ status: "APTO_PARA_REVISAO_HUMANA", validadeFonte: "ATUAL", validadeContexto: "ATUAL", criaEventoClinico: false });
      expect(JSON.stringify(dados)).not.toContain("Creatinina");
      vistos.push(dados.itens[0]!.draftId); cursor = dados.proximoCursor;
    }
    expect(new Set(vistos).size).toBe(3); expect(cursor).toBeNull();
    expect(extrair).toHaveBeenCalledTimes(3);
    expect((await a.request({ ...ctx, cursorExtracoes: "inexistente" }, "/consulta/oncoassist/historico")).body.codigo).toBe("CURSOR_EXTRACOES_INVALIDO");
    expect((await a.request({ ...ctx, limiteExtracoes: 51 }, "/consulta/oncoassist/historico")).status).toBe(400);
    a.sessoes.selecionarConsulta(a.token, { ...ctx, encounterId: "outra" });
    const outra = await a.request({ ...ctx, encounterId: "outra" }, "/consulta/oncoassist/historico");
    expect(HistoricoOncoassist.parse(outra.body).extracoesCognitivas?.itens).toHaveLength(0);
    expect((await a.request({ ...ctx, encounterId: "outra", cursorExtracoes: vistos[0] }, "/consulta/oncoassist/historico")).status).toBe(400);
  });
  it("Genspark manual chega ao Brain somente após curadoria e revogação invalida a proposta", async () => {
    const extrair = vi.fn(async (payload: Readonly<Record<string, unknown>>) => {
      expect(JSON.stringify(payload)).not.toContain("REFERENCIA_LOCAL_SINTETICA");
      return output();
    });
    const a = await abrir({ env, transporte: { extrair } });
    const item = { schema: "ItemBiblioteca@1", id: "referencia-creatinina", versao: "1.0.0", pilar: 1, tipo: "REFERENCIA",
      titulo: "Creatinina", texto: "REFERENCIA_LOCAL_SINTETICA", aplicabilidade: { tumor: [], histologia: [], estadio: [], biomarcador: [], linha: [] },
      proveniencia: { fonte: "https://example.org/sintetico", trecho: "REFERENCIA_LOCAL_SINTETICA", publicadoEm: "2026-01-01",
        recuperadoEm: "2026-01-02T00:00:00Z", licenca: "Fixture sintética" }, dependencias: [] };
    const bytes = JSON.stringify(item);
    const manifesto = { schema: "PacoteBiblioteca@1", id: "genspark-sintetico", versao: "1.0.0", origem: "GENSPARK_MANUAL",
      classificacao: "PUBLIC", criadoEm: "2026-01-02T00:00:00Z", itens: [{ id: item.id, versao: item.versao, arquivo: "item.json", sha256: sha256Biblioteca(bytes) }] };
    const importado = await a.request({ manifesto, arquivos: { "item.json": { texto: bytes } } }, "/biblioteca/importar");
    expect(importado.status).toBe(201);
    const pacoteId = String(importado.body.pacoteId);
    const estado = () => a.request({ pacoteId }, "/biblioteca/estado");
    const curar = async (situacao: string) => {
      const e = await estado();
      return a.request({ pacoteId, itemId: item.id, expectedHash: e.body.hash, expectedCuradoriaHash: e.body.curadoriaHash, estado: situacao }, "/biblioteca/curar");
    };
    const antes = await a.request({ ...pedido, idempotencyKey: "antes-curadoria" });
    expect(antes.status).toBe(201);
    const semCuradoria = RelatorioCognitivoExtracaoSchema.parse(antes.body.cognitivo);
    expect(semCuradoria.conhecimento?.biblioteca).toBeNull();
    expect((await curar("CONSULTAVEL")).status).toBe(200);
    const e = await estado();
    expect((await a.request({ pacoteId, expectedHash: e.body.hash, expectedCuradoriaHash: e.body.curadoriaHash,
      expectedAtiva: null, expectedAtivaHash: null }, "/biblioteca/ativar")).status).toBe(200);
    const r = await a.request(pedido);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const relatorio = RelatorioCognitivoExtracaoSchema.parse(r.body.cognitivo);
    if (relatorio.estado !== "AVALIADO") throw Error("Relatório ausente");
    expect(relatorio.conhecimento?.origem).toBe("GENSPARK_MANUAL");
    expect(relatorio.proposta.inclusoesMesa.map(i => i.referenciaId)).toEqual([item.id]);
    expect(relatorio.conhecimento?.referencias[0]?.contentHash).toBe(sha256Biblioteca(bytes));
    expect((await a.request({ ...pedido, filtrosBiblioteca: { tumor: "outro" } })).body.codigo).toBe("FILTROS_BIBLIOTECA_DIVERGENTES");
    expect((await curar("OBSOLETO")).status).toBe(200);
    const historico = await a.request({ ...ctx, draftId: r.body.draftId }, "/consulta/llm/resultado");
    expect(historico.body.validadeContexto).toBe("CONTEXTO_ALTERADO");
    expect(historico.body.cognitivo).toEqual(relatorio);
    expect((await a.request(pedido)).body.codigo).toBe("PROPOSTA_LLM_DESATUALIZADA");
    const novo = RelatorioCognitivoExtracaoSchema.parse((await a.request({ ...pedido, idempotencyKey: "depois-revogacao" })).body.cognitivo);
    if (novo.estado !== "AVALIADO") throw Error("Relatório ausente");
    expect(novo.proposta.inclusoesMesa).toHaveLength(0);
    expect(novo.proposta.referenciasExcluidas[0]?.motivoCodigo).toBe("STATUS_NAO_CONSULTAVEL");
  });
  it("nova revisão de fatos impede replay da proposta anterior como atual", async () => {
    const extrair = vi.fn(async () => output()); const a = await abrir({ env, transporte: { extrair } });
    expect((await a.request(pedido)).status).toBe(201);
    salvarDraft(a.db, { draftId: "cadastro2", patientId: ctx.patientId, sourceId: "cad2", rawRef: "local", payload: {}, diagnostics: [], revision: 0, criadoEm: agora });
    confirmar(a.db, { operationId: "cadastro2", ...ctx, sessao: a.sessoes.obter(a.token)!, reviewDecisionId: "revisao2", em: agora, registros: [{ draftId: "cadastro2", expectedRevision: 0,
      eventId: "evcad2", tipo: "Paciente", revisao: "CONFIRMADO", fontes: [], payload: { patientId: ctx.patientId, nome: "Maria Teste", identificadores: [], nascimento: null, sexoCadastral: "F", divergencia: false } }] });
    const r = await a.request(pedido); expect(r.status).toBe(409); expect(r.body.codigo).toBe("PROPOSTA_LLM_DESATUALIZADA");
    expect(extrair).toHaveBeenCalledOnce();
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
