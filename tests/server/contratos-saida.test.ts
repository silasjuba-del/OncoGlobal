import { ROTAS_HTTP } from "../../src/server/rotas/catalogo.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ambienteHttp } from "./http-fixture.js";
import { readFileSync } from "node:fs";
import { SaidasHttp, respostaHttpValida } from "../../src/contracts/api/saidasHttp.js";
import { salvarDraft, listarDrafts } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { fonteSintetica, triagemBase } from "../fixtures/triagem.js";
import { prepararAcaoComposta } from "../../src/rules/prescricao/acoesCompostas.js";

const urls = ROTAS_HTTP.map(r=>r.url);

describe("todas as portas públicas preservam método, autenticação e JSON", () => {
  let ambiente: Awaited<ReturnType<typeof ambienteHttp>>;
  beforeAll(async () => { ambiente = await ambienteHttp(); });
  afterAll(async () => { await ambiente.close(); });
  it.each(urls)("%s recusa método/payload inválidos antes de qualquer efeito", async rota => {
    expect((await ambiente.request(rota, "GET", "", ambiente.token)).status).toBe(404);
    if (rota !== "/login") expect((await ambiente.request(rota, "POST", "{}")).status).toBe(401);
    const r = await ambiente.request(rota, "POST", "{", ambiente.token, "application/json");
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body)).toEqual({ codigo: "JSON_INVALIDO" });
    expect(ambiente.efeitos()).toBe(0);
  });
});

it("toda rota pública possui contrato de saída; resposta vazia nunca é sucesso", () => {
  const rotas = new Set<string>(ROTAS_HTTP.map(r=>r.nome));
  expect(ROTAS_HTTP.map(r=>[r.url,r.nome]).sort()).toEqual(JSON.parse(readFileSync("tests/server/fixtures/rotas-baseline.json","utf8")));
  expect(rotas.size).toBe(87);
  expect(rotas.has("skillsClinicas")).toBe(true);
  expect(rotas.has("resultadoExtracaoLlm")).toBe(true);
  for (const rota of ["listarFichasPrescricao", "revisarFichaPrescricao", "instanciarFichaPrescricao"])
    expect(rotas.has(rota), rota).toBe(true);
  for (const rota of ["listarEstudosTrials", "importarEstudoTrial", "revisarEstudoTrial", "avaliarEstudoTrial", "fatosTrials"])
    expect(rotas.has(rota)).toBe(true);
  expect(rotas.has("basePrescricaoExecutavel")).toBe(true);
  expect(rotas.has("prepararPrescricaoExecutavel")).toBe(true);
  expect(rotas.has("confirmarPrescricaoExecutavel")).toBe(true);
  for (const rota of ["baseAcaoComposta", "prepararAcaoComposta", "timelineMulticamadas"])
    expect(rotas.has(rota), rota).toBe(true);
  expect(rotas.has("oncoassistHistorico")).toBe(true);
  expect(rotas.has("leituraPubMed")).toBe(true);
  expect(rotas.has("listarRascunhosPubMed")).toBe(true);
  expect(rotas.has("gerarContingenciaSalao")).toBe(true);
  expect(rotas.has("historicoContingenciaSalao")).toBe(true);
  expect(rotas.has('prepararRespostaCanal')).toBe(true);
  expect(rotas.has('confirmarRespostaCanal')).toBe(true);
  expect(rotas.has("proporDoseReceita")).toBe(true);
  expect(rotas.has("/salao/revisar-relato-canal")).toBe(true);
  expect([...rotas].sort()).toEqual(Object.keys(SaidasHttp).sort());
  for (const rota of rotas) expect(respostaHttpValida(rota, 200, {}), rota).toBe(false);
  expect(respostaHttpValida("rota-inexistente", 200, {})).toBe(false);
});

it("novas saídas de ações e timeline preservam contrato e não autorizam execução clínica", () => {
  const contexto = { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: null };
  const base = { contexto, cicloId: "ciclo-sintetico", episodioId: "episodio-sintetico",
    protocoloId: "protocolo-sintetico", previstoEm: "2026-10-20", revisao: "r1", baseHash: "a".repeat(64),
    itens: [{ item: 1, droga: "Fármaco sintético", doseMg: 100 }] };
  expect(respostaHttpValida("baseAcaoComposta", 200, { base, pendencias: [] })).toBe(true);
  expect(respostaHttpValida("baseAcaoComposta", 200, { base: null, pendencias: ["CICLO_ATUAL_AUSENTE_OU_AMBIGUO"] })).toBe(true);
  expect(respostaHttpValida("baseAcaoComposta", 200, { base: null })).toBe(false);
  const resposta = { draftId: "draft-sintetico", revision: 0, conteudoHash: "b".repeat(64),
    resultado: prepararAcaoComposta(base, { tipo: "ADIAR_CICLO", motivo: "Intenção sintética", dias: 7 }),
    documentoPlano: { titulo: "Plano sintético", texto: "Prévia para revisão" },
    criaEventoClinico: false, liberaTratamento: false };
  expect(respostaHttpValida("prepararAcaoComposta", 200, resposta)).toBe(true);
  expect(respostaHttpValida("prepararAcaoComposta", 200, { ...resposta, criaEventoClinico: true })).toBe(false);
  expect(respostaHttpValida("prepararAcaoComposta", 200, { ...resposta, liberaTratamento: true })).toBe(false);
  expect(respostaHttpValida("timelineMulticamadas", 200, { contexto, revisao: "c".repeat(64), eventos: [] })).toBe(true);
  expect(respostaHttpValida("timelineMulticamadas", 200, { contexto, eventos: [] })).toBe(false);
});

it('histórico OncoAssist usa o catálogo central e rejeita proposta incompleta', () => {
  expect(respostaHttpValida('oncoassistHistorico', 200, { propostas: [] })).toBe(true);
  expect(respostaHttpValida('oncoassistHistorico', 200, {})).toBe(false);
  expect(respostaHttpValida('oncoassistHistorico', 200, { propostas: [{}] })).toBe(false);
  expect(respostaHttpValida('oncoassistHistorico', 200, {
    propostas: [{ estado: 'CONCLUIDA', validade: 'ATUAL', resposta: { status: 'PROPOSTA', categoria: 'LAB' } }],
  })).toBe(false);
});

it("servidor recusa saída inválida de login sem transmitir dados do resultado ou do erro", async () => {
  const a = await ambienteHttp();
  try {
    vi.spyOn(a.sessoes, "login").mockReturnValue({ token: 42, sessao: { expiraEm: "invalido", segredo: "sentinela-local" } } as never);
    const r = await a.request("/login", "POST", JSON.stringify({ senha: "senha-sintetica-comprida" }));
    expect(r.status).toBe(500);
    expect(JSON.parse(r.body)).toEqual({ codigo: "RESPOSTA_FORA_CONTRATO" });
    expect(JSON.stringify(a.logs)).not.toContain("sentinela-local");
  } finally { vi.restoreAllMocks(); await a.close(); }
});

it.each(["/consulta/agenda", "/consulta/apac"])("%s conserva o motivo da pendência quando a data do serviço está indisponível", async rota => {
  const a = await ambienteHttp();
  try {
    for (const [agora, codigo] of [["invalido", "INSTANTE_INVALIDO"], ["", "INSTANTE_AUSENTE"]]) {
      a.now(agora!);
      const r = await a.request(rota, "POST", "{}", a.token, "application/json");
      expect(r.status).toBe(503);
      expect(JSON.parse(r.body)).toEqual({ hoje: null, itens: [], estado: "PENDENTE", codigo });
      expect(a.logs.at(-1)).toMatchObject({ status: 503, codigo });
      expect(a.efeitos()).toBe(0);
    }
    a.now("2026-10-05T12:00:00Z");
    const recuperada = await a.request(rota, "POST", "{}", a.token, "application/json");
    expect(recuperada.status).toBe(200);
    expect(JSON.parse(recuperada.body).hoje).toBe("2026-10-05");
  } finally { await a.close(); }
});

it.each([null, {}])("triagem com ruleset indisponível %j é recusada antes de gravar", async salaoRuleset => {
  const a = await ambienteHttp({ salaoRuleset });
  try {
    const triagem = triagemBase(), em = "2026-10-05T12:00:00Z";
    const contexto = { patientId: triagem.patientId, encounterId: triagem.encounterId, tumorLotId: null };
    salvarDraft(a.db, { draftId: "cadastro-sintetico", patientId: contexto.patientId, sourceId: "fixture", rawRef: "fixture-local", payload: {}, diagnostics: [], revision: 0, criadoEm: em });
    expect(confirmar(a.db, { ...contexto, operationId: "cadastro-sintetico-op", reviewDecisionId: "revisao-cadastro", sessao: a.sessoes.obter(a.token)!, em,
      registros: [{ draftId: "cadastro-sintetico", expectedRevision: 0, eventId: "cadastro-evento", tipo: "Paciente", fontes: [fonteSintetica()], revisao: "CONFIRMADO", payload: {
        patientId: contexto.patientId, nome: "Paciente sintético", identificadores: [], nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false } }] }).estado).toBe("GRAVADA");
    a.sessoes.selecionarConsulta(a.token, contexto);
    const antes = listarDrafts(a.db, contexto.patientId);
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const r = await a.request("/consulta/salao/triagem", "POST", JSON.stringify({ triagem, expectedRevision: null }), a.token, "application/json");
      expect(r.status).toBe(503);
      expect(JSON.parse(r.body)).toMatchObject({ codigo: "RULESET_SALAO_INVALIDO", estado: "PENDENTE" });
      expect(listarDrafts(a.db, contexto.patientId)).toEqual(antes);
      expect(a.db.prepare("SELECT count(*) AS n FROM clinical_event WHERE tipo='Triagem'").get()?.n).toBe(0);
    }
    const liberar = await a.request("/consulta/salao/liberar", "POST", JSON.stringify({ patientId: contexto.patientId, encounterId: contexto.encounterId,
      expectedRevision: 0, motivo: "decisão sintética", idempotencyKey: "liberacao-sintetica" }), a.token, "application/json");
    expect(liberar.status).toBe(503);
    expect(JSON.parse(liberar.body)).toMatchObject({ codigo: "RULESET_SALAO_INVALIDO", estado: "PENDENTE" });
    expect(listarDrafts(a.db, contexto.patientId)).toEqual(antes);
  } finally { await a.close(); }
});

it.each(["/consulta/investigacao", "/consulta/instrumento/avaliar", "/consulta/llm/documento-original"])("%s exige sessão, valida payload e mantém contexto explícito", async rota => {
  const a = await ambienteHttp();
  try {
    expect((await a.request(rota, "POST", "{}")).status).toBe(401);
    expect((await a.request(rota, "POST", "{}", a.token)).status).toBe(400);
    const contexto = { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: null };
    const pedido = rota.endsWith("avaliar") ? { ...contexto, pedido: { instrumento: "KPS", dados: { aplicavel: true, fonteDados: "fixture", kpsDocumentado: 80 } } }
      : rota.endsWith("documento-original") ? { ...contexto, draftId: "draft-sintetico", idempotencyKey: "operacao-sintetica" } : contexto;
    const divergente = await a.request(rota, "POST", JSON.stringify(pedido), a.token);
    expect(divergente.status).toBe(409);
    a.sessoes.selecionarConsulta(a.token, contexto);
    const r = await a.request(rota, "POST", JSON.stringify(pedido), a.token);
    expect(r.status).toBe(rota.endsWith("documento-original") ? 409 : 200);
    if (rota.endsWith("avaliar")) expect(JSON.parse(r.body)).toMatchObject({ gravado: false, assinado: false });
    if (rota.endsWith("investigacao")) expect(JSON.parse(r.body)).toMatchObject({ estado: "PENDENTE", resultado: null });
    expect(a.efeitos()).toBe(0);
  } finally { await a.close(); }
});
