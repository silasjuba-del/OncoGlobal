import * as motorSeguranca from "../../src/rules/prescricao/safetyEngine.js";
// Somente fichas, fármacos e pacientes sintéticos; HTTP e SQLite reais locais.
import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { criarMotorF1 } from "../../src/kernel/orquestracao/runtime.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { rotear, type ServidorDeps } from "../../src/server/rotas.js";
import { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";
import { presente, fonteSintetica } from "../fixtures/triagem.js";
import { criarDiretorio, removerDiretorio, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";

const contexto = { patientId: "paciente-ficha-sintetico", encounterId: "consulta-ficha-sintetica", tumorLotId: "lote-ficha-sintetico" };
const ambientes: { close: () => Promise<void> }[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const a of ambientes.splice(0)) await a.close(); });
const template = () => ProtocolTemplate.parse({ templateId: "ficha-sintetica", versao: "1",
  hash: "rotulo-legado-sintetico", status: "RASCUNHO", nome: "Protocolo sintético", tumor: "Tumor sintético", cenario: "Cenário sintético",
  codigoInstitucional: null, intervaloDias: 21, ciclos: null, fonte: "Documento inteiramente sintético", limiaresBula: null,
  itens: [{ drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: 1.5, doseBasis: "FIXED",
    calculatedDose: null, prescribedDose: null, unit: "mg", adjustmentPercent: null, adjustmentReason: null, route: "EV",
    diluent: "Diluente sintético", finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"], observacao: null,
    source: "PROTOCOL", overrideMotivo: null }] });
const templateMgM2 = () => {
  const base = template();
  return ProtocolTemplate.parse({ ...base, itens: [{ ...base.itens[0]!, standardDose: 100, doseBasis: "MG_M2", unit: "mg/m²" }] });
};
async function abrir(protocolo = template(), dadosPaciente: { nascimento?: string; sexoCadastral?: "M" | "F" } = {}) {
  const dir = criarDiretorio(), db = abrirLedger(":memory:");
  let agora = AGORA;
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-ficha-sintetico", crm: "CRM-SINTETICO",
    senha: "senha-sintetica-ficha-123", duracaoMs: 90 * 24 * 60 * 60 * 1000, agora: () => agora });
  let token = sessoes.login("senha-sintetica-ficha-123")!.token;
  const corpusParcial: Pick<NonNullable<ServidorDeps["corpus"]>, "templatesProtocolo" | "caixasTodas"> = {
    templatesProtocolo: [protocolo], caixasTodas: [],
  };
  const corpus = corpusParcial as NonNullable<ServidorDeps["corpus"]>;
  const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const motorF1 = criarMotorF1(db, () => agora, () => ({ regras: [],
    biblioteca: { id: "biblioteca-sintetica", versao: "1", hash: "hash-sintetico" } }));
  const deps: ServidorDeps = { db, sessoes, corpus, gateway, motorF1, agora: () => agora, log: () => {} };
  const server = createServer((req, res) => { void rotear(deps, req, res); });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  const port = address.port;
  async function request(path: string, body: unknown, bearer = token) {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json() as Record<string, any> };
  }
  function entrarOutroMedico() {
    const outraSessao = criarGerenciadorSessao({ medicoId: "medico-ficha-outro-sintetico", crm: "CRM-OUTRO-SINTETICO",
      senha: "senha-sintetica-ficha-123", duracaoMs: 90 * 24 * 60 * 60 * 1000, agora: () => agora });
    const outraToken = outraSessao.login("senha-sintetica-ficha-123")!.token;
    outraSessao.selecionarConsulta(outraToken, contexto);
    deps.sessoes = outraSessao;
    return outraToken;
  }
  function avancarRelogio(instante: string) { agora = instante; }
  function renovarSessao() {
    token = sessoes.login("senha-sintetica-ficha-123")!.token;
    sessoes.selecionarConsulta(token, contexto);
    return token;
  }
  let n = 0;
  function seed(tipo: string, payload: unknown | ((eventId: string) => unknown),
    fontes: ReturnType<typeof fonteSintetica>[] | ((eventId: string) => ReturnType<typeof fonteSintetica>[]) = eventId => [fonteSintetica(eventId)], supersedesEventId: string | null = null) {
    const id = `ficha-seed-${++n}`;
    const conteudo = typeof payload === "function" ? payload(id) : payload;
    const fontesEvento = typeof fontes === "function" ? fontes(id) : fontes;
    salvarDraft(db, { draftId: id, patientId: contexto.patientId, sourceId: id, rawRef: "referencia-local",
      payload: {}, revision: 0, diagnostics: [], criadoEm: agora });
    const r = executarConfirmacao(db, { ...contexto, operationId: id, reviewDecisionId: id,
      sessao: sessoes.obter(token)!, em: agora, registros: [{ eventId: id, draftId: id, expectedRevision: 0,
        tipo, payload: conteudo, fontes: fontesEvento, revisao: "CONFIRMADO", supersedesEventId }] });
    expect(r.estado).toBe("GRAVADA");
    return id;
  }
  seed("Paciente", { patientId: contexto.patientId, nome: "Paciente sintético da ficha", identificadores: [],
    nascimento: dadosPaciente.nascimento ?? null, sexoCadastral: dadosPaciente.sexoCadastral ?? "NAO_INFORMADO", divergencia: false });
  seed("TumorLot", { patientId: contexto.patientId, tumorLotId: contexto.tumorLotId, cid: presente("C50"),
    topografia: presente("Topografia sintética"), histologia: presente("Histologia sintética"),
    estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] });
  sessoes.selecionarConsulta(token, contexto);
  const close = async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); removerDiretorio(dir); };
  const a = { db, sessoes, get token() { return token; }, corpus, request, seed, close, entrarOutroMedico,
    avancarRelogio, renovarSessao,
    eventos: () => listarEventos(db, contexto.patientId) };
  ambientes.push(a); return a;
}
const LISTAR = "/consulta/prescricao/fichas/listar", REVISAR = "/consulta/prescricao/fichas/revisar";
const INSTANCIAR = "/consulta/prescricao/fichas/instanciar", BASE = "/consulta/prescricao-executavel/base";
const PREPARAR = "/consulta/prescricao-executavel/preparar", CONFIRMAR = "/consulta/prescricao-executavel/confirmar";
type Ambiente = Awaited<ReturnType<typeof abrir>>;
async function revisao(a: Ambiente, decisao = "CONFERIR") {
  const ficha = (await a.request(LISTAR, {})).data.fichas[0];
  const r = await a.request(REVISAR, { templateId: ficha.template.templateId, versao: ficha.template.versao,
    expectedContentHash: ficha.contentHash, expectedRevision: ficha.revision, decisao, motivo: "Conferência sintética explícita",
    idempotencyKey: `revisao-ficha-${ficha.revision}` });
  expect(r.status).toBe(200); return r.data;
}
async function instancia(a: Ambiente) {
  const ficha = await revisao(a);
  const r = await a.request(INSTANCIAR, { contexto, templateId: ficha.template.templateId, versao: ficha.template.versao,
    expectedContentHash: ficha.contentHash, expectedRevision: ficha.revision, idempotencyKey: "instanciar-ficha" });
  expect(r.status).toBe(200); return r.data;
}
async function instanciarMgM2ComAltura(opcoes: {
  dadoData?: string;
  fonteData?: string | null;
  qualificadores?: { polaridade: "AFIRMADA"; sujeito: "PACIENTE" | "TERCEIRO"; temporalidade: "ATUAL" };
}) {
  const a = await abrir(templateMgM2());
  a.seed("Weight", (eventId: string) => ({ kg: 70, origem: "MEDIDO", data: "2026-10-01", sourceId: eventId }));
  a.seed("FATO", (eventId: string) => {
    return { campo: "alturaCm", valor: 170,
      ...(opcoes.dadoData === undefined ? {} : { dataClinica: opcoes.dadoData }),
      ...(opcoes.qualificadores ? { qualificadores: opcoes.qualificadores } : {}) };
  }, (eventId: string) => [{ ...fonteSintetica(eventId), dataClinica: opcoes.fonteData === undefined ? "2026-10-01" : opcoes.fonteData }]);
  return { a, origem: await instancia(a) };
}
async function preparar(a: Ambiente, origem: Record<string, any>, alteracoes = {}, ctx = contexto, bearer?: string,
  dataPrevista = "2026-10-20") {
  const base = (await a.request(BASE, ctx, bearer)).data;
  return a.request(PREPARAR, { contexto: ctx, expectedBaseHash: base.revisao, idempotencyKey: "preparo-ficha",
    edicao: { protocoloId: origem.template.nome, dataPrevista, motivo: "Caso sintético revisado",
      planejamento: { modo: "NOVA_LINHA", linha: 1, intencao: "PALIATIVA", numeroCiclo: 1 },
      itens: origem.itens, origemProposta: origem.origemProposta, encaminharFarmacia: false, ...alteracoes } }, bearer);
}
const confirmar = (a: Ambiente, p: Record<string, any>) => a.request(CONFIRMAR, { contexto, draftId: p.draftId,
  expectedRevision: p.revision, conteudoHash: p.conteudoHash, idempotencyKey: "assinar-ficha" });
const quantidadeDrafts = (a: Ambiente) => Number((a.db.prepare("SELECT COUNT(*) AS total FROM draft_envelope").get() as { total: number }).total);

it("conferir e instanciar não gravam fatos; assinar conserva origem e dose, sem administração", async () => {
  const a = await abrir(), antes = a.eventos().length, origem = await instancia(a);
  expect(origem.template.status).toBe("RASCUNHO");
  expect(origem.itens[0].item.prescribedDose).toBe(1.5);
  expect(a.eventos()).toHaveLength(antes);
  const p = await preparar(a, origem); expect(p.status, JSON.stringify(p.data)).toBe(200);
  expect(a.eventos()).toHaveLength(antes);
  const r = await confirmar(a, p.data); expect(r.status).toBe(200); expect(r.data.codigo).toBe("GRAVADA");
  expect(a.eventos().some(e => e.tipo.startsWith("TreatmentAdministration"))).toBe(false);
  expect(a.eventos().find(e => e.tipo === "DOCUMENTO")?.payload).toMatchObject({
    data: { data: { prescricao: { origemProposta: origem.origemProposta } } },
  });
});
it("não aceita trocar dose e manter selo de origem PROTOCOL", async () => {
  const a = await abrir(), origem = await instancia(a);
  const itens = structuredClone(origem.itens); itens[0].item.prescribedDose = 7;
  expect((await preparar(a, origem, { itens })).status).toBe(409);
  expect(a.eventos()).toHaveLength(2);
});
it("aceita conversão explícita de item QT para MANUAL somente com motivo por item", async () => {
  const a = await abrir(), origem = await instancia(a);
  const comMotivo = structuredClone(origem.itens);
  comMotivo[0].item.source = "MANUAL";
  comMotivo[0].item.overrideMotivo = "Ajuste médico sintético registrado";
  comMotivo[0].item.prescribedDose = 1.25;
  const aceito = await preparar(a, origem, { itens: comMotivo });
  expect(aceito.status, JSON.stringify(aceito.data)).toBe(200);
  expect(aceito.data.conteudo.itens[0].item).toMatchObject({ source: "MANUAL",
    overrideMotivo: "Ajuste médico sintético registrado", prescribedDose: 1.25 });

  const semMotivo = structuredClone(origem.itens);
  semMotivo[0].item.source = "MANUAL";
  semMotivo[0].item.overrideMotivo = null;
  expect((await preparar(a, origem, { itens: semMotivo })).status).toBe(400);
});
it("aceita item MANUAL não-QT suplementar sem classificá-lo como PROTOCOL", async () => {
  const a = await abrir(), origem = await instancia(a);
  const suporte = structuredClone(origem.itens[0]);
  suporte.itemId = "item-suporte-manual-sintetico";
  suporte.item = { ...suporte.item, drug: "Suporte sintético", classe: "PRE_QT", sequence: 2,
    standardDose: 1, calculatedDose: 1, prescribedDose: 1, source: "MANUAL", overrideMotivo: null };
  const itens = [...structuredClone(origem.itens), suporte];

  const r = await preparar(a, origem, { itens });
  expect(r.status, JSON.stringify(r.data)).toBe(200);
  expect(r.data.conteudo.itens).toHaveLength(2);
  expect(r.data.conteudo.itens[0].item.source).toBe("PROTOCOL");
  expect(r.data.conteudo.itens[1].item).toMatchObject({ drug: "Suporte sintético", classe: "PRE_QT", source: "MANUAL" });
});
it("recusa reutilizar o ponteiro da ficha em outro encontro ou sob outro médico", async () => {
  const a = await abrir(), origem = await instancia(a);
  const outroContexto = { ...contexto, encounterId: "consulta-ficha-outro-sintetico" };
  a.sessoes.selecionarConsulta(a.token, outroContexto);
  const outroEncontro = await preparar(a, origem, {}, outroContexto);
  expect(outroEncontro.status).toBe(409);
  expect(outroEncontro.data.codigo).toBe("ORIGEM_FICHA_FORA_DO_CONTEXTO");

  a.sessoes.selecionarConsulta(a.token, contexto);
  const outroMedico = a.entrarOutroMedico();
  const outroAtor = await preparar(a, origem, {}, contexto, outroMedico);
  expect(outroAtor.status).toBe(409);
  expect(outroAtor.data.codigo).toBe("ORIGEM_FICHA_FORA_DO_CONTEXTO");
});
it("não reabre retry de instanciação depois da inativação da ficha", async () => {
  const a = await abrir(), origem = await instancia(a);
  await revisao(a, "INATIVAR");
  const retry = await a.request(INSTANCIAR, { contexto, templateId: origem.template.templateId,
    versao: origem.template.versao, expectedContentHash: origem.contentHash, expectedRevision: origem.revisionFicha,
    idempotencyKey: "instanciar-ficha" });
  expect(retry.status).toBe(409);
  expect(retry.data.codigo).toBe("FICHA_REVISAO_ALTERADA");
});
it.each([
  { caso: "data civil futura", dadoData: "2099-01-01", fonteData: "2026-10-01" },
  { caso: "instante futuro intradia", dadoData: "2026-10-09T18:00:00-03:00", fonteData: "2026-10-01" },
  { caso: "data clínica ausente", dadoData: undefined, fonteData: null },
  { caso: "data clínica inválida", dadoData: "não-é-data", fonteData: "não-é-data" },
  { caso: "sujeito terceiro", dadoData: "2026-10-01", fonteData: "2026-10-01",
    qualificadores: { polaridade: "AFIRMADA" as const, sujeito: "TERCEIRO" as const, temporalidade: "ATUAL" as const } },
])("não calcula MG_M2 com altura $caso", async ({ dadoData, fonteData, qualificadores }) => {
  const { a, origem } = await instanciarMgM2ComAltura({ fonteData,
    ...(dadoData === undefined ? {} : { dadoData }),
    ...(qualificadores === undefined ? {} : { qualificadores }) });
  expect(origem.dadosCorporais).toMatchObject({ pesoKg: 70, alturaCm: null, bsaM2: null });
  expect(origem.itens[0].item).toMatchObject({ calculatedDose: null, prescribedDose: null });
  expect(origem.pendencias.length).toBeGreaterThan(0);
  const consulta = await a.request("/consulta/carregar", contexto);
  expect(consulta.status).toBe(200);
  expect(consulta.data.avaliacaoClinica.dadosCorporais.alturaCm).toBeNull();
});
it("calcula MG_M2 quando a altura atual e datada está documentada", async () => {
  const { origem } = await instanciarMgM2ComAltura({ dadoData: "2026-10-01", fonteData: "2026-10-01",
    qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" } });
  expect(origem.dadosCorporais).toMatchObject({ pesoKg: 70, alturaCm: 170, bsaM2: 1.82 });
  expect(origem.itens[0].item).toMatchObject({ calculatedDose: 182, prescribedDose: 182 });
  expect(origem.pendencias).toEqual([]);
});
it("recusa preparar uma proposta MG_M2 quando o peso documentado expirou sem novo evento", async () => {
  const { a, origem } = await instanciarMgM2ComAltura({ dadoData: "2026-10-01", fonteData: "2026-10-01",
    qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" } });
  expect(origem.dadosCorporais.pesoKg).toBe(70);
  const eventosAntes = a.eventos().length, draftsAntes = quantidadeDrafts(a);
  a.avancarRelogio("2026-11-10T12:00:00-03:00");
  a.renovarSessao();

  const r = await preparar(a, origem, {}, contexto, undefined, "2026-11-15");
  expect(r.status).toBe(409);
  expect(a.eventos()).toHaveLength(eventosAntes);
  expect(quantidadeDrafts(a)).toBe(draftsAntes);
});
it("recusa confirmar MG_M2 se o peso expirar entre preparar e assinar", async () => {
  const { a, origem } = await instanciarMgM2ComAltura({ dadoData: "2026-10-01", fonteData: "2026-10-01",
    qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" } });
  const p = await preparar(a, origem, {}, contexto, undefined, "2026-11-15");
  expect(p.status, JSON.stringify(p.data)).toBe(200);
  const eventosAntes = a.eventos().length, draftsAntes = quantidadeDrafts(a);
  a.avancarRelogio("2026-11-10T12:00:00-03:00");

  const r = await confirmar(a, p.data);
  expect(r.status).toBe(409);
  expect(a.eventos()).toHaveLength(eventosAntes);
  expect(quantidadeDrafts(a)).toBe(draftsAntes);
});
it("mantém replay idempotente de assinatura concluída mesmo após expirar o peso", async () => {
  const { a, origem } = await instanciarMgM2ComAltura({ dadoData: "2026-10-01", fonteData: "2026-10-01",
    qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" } });
  const p = await preparar(a, origem, {}, contexto, undefined, "2026-11-15");
  expect(p.status, JSON.stringify(p.data)).toBe(200);
  const primeira = await confirmar(a, p.data);
  expect(primeira.status).toBe(200);
  expect(primeira.data.codigo).toBe("GRAVADA");
  const eventosAssinados = a.eventos().length, draftsAssinados = quantidadeDrafts(a);
  a.avancarRelogio("2026-11-10T12:00:00-03:00");
  a.renovarSessao();

  const replay = await confirmar(a, p.data);
  expect(replay.status).toBe(200);
  expect(replay.data.codigo).toBe("REPLAY");
  expect(a.eventos()).toHaveLength(eventosAssinados);
  expect(quantidadeDrafts(a)).toBe(draftsAssinados);
});
it("mudança de fatos ou do conteúdo da ficha invalida origem antes da preparação", async () => {
  const a = await abrir(), origem = await instancia(a);
  a.seed("FATO", { campo: "medicamentos", valor: ["Medicamento sintético novo"] });
  expect((await preparar(a, origem)).status).toBe(409);
  const b = await abrir(), outra = await instancia(b);
  b.corpus.templatesProtocolo[0]!.itens[0]!.standardDose = 2;
  expect((await preparar(b, outra)).status).toBe(409);
});
it("revogação depois da prévia impede assinatura; replay assinado permanece histórico", async () => {
  const a = await abrir(), origem = await instancia(a), p = await preparar(a, origem);
  expect(p.status, JSON.stringify(p.data)).toBe(200); const antes = a.eventos().length;
  await revisao(a, "INATIVAR");
  expect((await confirmar(a, p.data)).status).toBe(409); expect(a.eventos()).toHaveLength(antes);
  const b = await abrir(), origemB = await instancia(b), pb = await preparar(b, origemB);
  expect(pb.status).toBe(200);
  expect((await confirmar(b, pb.data)).status).toBe(200); const assinados = b.eventos().length;
  await revisao(b, "INATIVAR");
  const replay = await confirmar(b, pb.data); expect(replay.status).toBe(200); expect(replay.data.codigo).toBe("REPLAY");
  expect(b.eventos()).toHaveLength(assinados);
});

function templateAuc() {
  const t = template();
  return ProtocolTemplate.parse({ ...t, itens: [{ ...t.itens[0]!, doseBasis: "AUC", standardDose: 5, unit: "mg" }] });
}
async function abrirRenal() {
  return abrir(templateAuc(), { nascimento: "1960-01-01", sexoCadastral: "M" });
}
function peso(a: Ambiente, kg: number, data: string) {
  a.seed("Weight", (id: string) => ({ kg, origem: "MEDIDO", data, sourceId: id }),
    id => [{ ...fonteSintetica(id), dataClinica: data }]);
}
function creatinina(a: Ambiente, valor: number, data: string) {
  a.seed("LabResult", (id: string) => ({ campo: "creatinina", valor, unidade: "mg/dL", data, sourceId: id }),
    id => [{ ...fonteSintetica(id), dataClinica: data }]);
}

it("AUC permanece pendente se creatininas discordam no mesmo dia sem ordem comprovada", async () => {
  const a = await abrirRenal(); peso(a, 70, "2026-10-09");
  creatinina(a, 1, "2026-10-09"); creatinina(a, 2, "2026-10-09T11:00:00-03:00");
  const antes = a.eventos(), r = await instancia(a);
  expect(r.dadosCorporais.clcr).toBeNull();
  expect(r.itens[0].item.prescribedDose).toBeNull();
  expect(a.eventos()).toEqual(antes);
});

it("AUC permanece pendente com dois pesos discordantes no mesmo dia", async () => {
  const a = await abrirRenal();
  peso(a, 70, "2026-10-09"); peso(a, 80, "2026-10-09");
  creatinina(a, 1, "2026-10-09T11:00:00-03:00");
  const r = await instancia(a);
  expect(r.dadosCorporais).toMatchObject({ pesoKg: null, clcr: null });
  expect(r.itens[0].item.prescribedDose).toBeNull();
});

it("laboratorio UTC no dia seguinte ao civil do servico nao provoca fallback para exame antigo", async () => {
  const a = await abrirRenal(); a.avancarRelogio("2026-10-09T23:00:00-03:00");
  peso(a, 70, "2026-10-09");
  creatinina(a, 1, "2026-10-08T12:00:00-03:00"); creatinina(a, 2, "2026-10-10T01:00:00Z");
  const consulta = await a.request("/consulta/carregar", contexto);
  expect(consulta.status).toBe(200);
  expect(consulta.data.avaliacaoClinica.renal.valoresUsados.creatinina.valor).toBe(2);
  const r = await instancia(a);
  expect(r.dadosCorporais.clcr).toBe(consulta.data.avaliacaoClinica.renal.clcrMlMin);
});

it("AUC nao usa peso ou laboratorio posteriores ao dia da consulta historica", async () => {
  const a = await abrirRenal();
  a.seed("AgendaEntry", { patientId: contexto.patientId, encounterId: contexto.encounterId, horario: "10:00", data: "2026-10-01" });
  peso(a, 70, "2026-10-09"); creatinina(a, 1, "2026-10-09T11:00:00-03:00");
  const r = await instancia(a);
  expect(r.dadosCorporais).toMatchObject({ pesoKg: null, clcr: null });
  expect(r.itens[0].item.prescribedDose).toBeNull();
});

it("AUC usa creatinina de instante comprovadamente posterior dentro da consulta ancorada", async () => {
  const a = await abrirRenal();
  a.seed("AgendaEntry", { patientId: contexto.patientId, encounterId: contexto.encounterId, horario: "12:00", data: "2026-10-09" });
  peso(a, 70, "2026-10-09");
  creatinina(a, 1, "2026-10-08T10:00:00-03:00"); creatinina(a, 2, "2026-10-09T10:00:00-03:00");
  const consulta = await a.request("/consulta/carregar", contexto);
  expect(consulta.status).toBe(200);
  expect(consulta.data.avaliacaoClinica.renal.valoresUsados.creatinina.valor).toBe(2);
  const r = await instancia(a);
  expect(r.dadosCorporais.clcr).toBeGreaterThan(0);
  expect(r.itens[0].item.prescribedDose).toBe(305);
});

it("AUC preserva conflito entre instantes equivalentes com offsets diferentes", async () => {
  const a = await abrirRenal(); peso(a, 70, "2026-10-09");
  creatinina(a, 1, "2026-10-09T10:00:00-03:00"); creatinina(a, 2, "2026-10-09T13:00:00Z");
  const r = await instancia(a);
  expect(r.dadosCorporais.clcr).toBeNull();
  expect(r.itens[0].item.prescribedDose).toBeNull();
});

it("kernel generico nao promove artefato de calculo obtido pelo HTTP como FATO", async () => {
  const a = await abrir(), origem = await instancia(a), antes = a.eventos();
  const r = executarConfirmacao(a.db, { ...contexto, operationId: "promocao-generica-ficha",
    reviewDecisionId: "revisao-generica-sintetica", sessao: a.sessoes.obter(a.token)!, em: AGORA,
    registros: [{ draftId: origem.origemProposta.draftId, expectedRevision: origem.origemProposta.revision,
      eventId: "fato-indevido-sintetico", tipo: "FATO", payload: { campo: "diagnostico", valor: "Texto sintetico" },
      fontes: [fonteSintetica("promocao-generica")], revisao: "CONFIRMADO" }] });
  expect(r).toMatchObject({ estado: "NEGADA", motivo: "PROPOSTA_DOCUMENTAL_NAO_PROMOVIVEL" });
  expect(a.eventos()).toEqual(antes);
  expect(a.db.prepare("SELECT operationId FROM operation WHERE operationId=?").get("promocao-generica-ficha")).toBeUndefined();
  expect(a.db.prepare("SELECT revision FROM draft_envelope WHERE draftId=?").get(origem.origemProposta.draftId)?.revision).toBe(0);
});

it("HTTP generico nao exibe calculo como documento nem vincula revisao global ao paciente", async () => {
  const a = await abrir(), origem = await instancia(a), antes = a.eventos();
  const exibicao = await a.request("/consulta/bundle", { ...contexto, draftIds: [origem.origemProposta.draftId] });
  expect(exibicao).toMatchObject({ status: 409, data: { codigo: "DRAFT_CONTEXTO_AUSENTE" } });
  const global = a.db.prepare("SELECT * FROM draft_envelope WHERE json_extract(payload,'$.kind')='FICHA_PROTOCOLO_REVISOES'").get()!;
  const vinculo = await a.request("/consulta/rascunho/revisar", {
    draftId: global.draftId, expectedRevision: global.revision, patientId: contexto.patientId,
  });
  expect(vinculo.status).toBe(409);
  expect(a.db.prepare("SELECT * FROM draft_envelope WHERE draftId=?").get(global.draftId!)).toEqual(global);
  expect(a.eventos()).toEqual(antes);
});

it.each([false, true])("ancoras de agenda concordantes ou conflitantes controlam o calculo: conflito=%s", async conflito => {
  const a = await abrirRenal();
  for (const data of [conflito ? "2026-10-08" : "2026-10-09", "2026-10-09"])
    a.seed("AgendaEntry", { patientId: contexto.patientId, encounterId: contexto.encounterId, horario: "12:00", data });
  peso(a, 70, "2026-10-09"); creatinina(a, 2, "2026-10-09T11:00:00-03:00");
  const consulta = await a.request("/consulta/carregar", contexto);
  expect(consulta.status).toBe(200);
  const r = await instancia(a);
  if (conflito) {
    expect(consulta.data.retrato.integridade).toContainEqual(expect.objectContaining({ motivo: "DATA_ENCONTRO_AMBIGUA" }));
    expect(r.dadosCorporais).toMatchObject({ pesoKg: null, clcr: null });
    expect(r.itens[0].item.prescribedDose).toBeNull();
  } else {
    expect(r.itens[0].item.prescribedDose).toBe(305);
  }
});

it.each(['ausente','abaixo','unidade','futuro','sem-horario'] as const)('SafetyEngine da ficha recusa artefato com plaquetas %s e conserva o prontuário', async caso => {
 const t=template();t.limiaresBula={neutrofilosMin:null,plaquetasMin:100000,clcrMinMlMin:null,fevePctMin:null,fonte:'Limiar exclusivamente sintético'};
 const a=await abrir(t);
 if(caso!=='ausente'){
  const data=caso==='futuro'?'2030-01-01T12:00:00Z':caso==='sem-horario'?AGORA.slice(0,10):AGORA;
  a.seed('LabResult',(id:string)=>({campo:'plaquetas',valor:caso==='abaixo'?50000:150000,unidade:caso==='unidade'?'10^9/L':'/µL',data,sourceId:id}),
   id=>[{...fonteSintetica(id),dataClinica:data}]);
 }
 const origem=await instancia(a);expect(origem.pendencias.join(' ')).toContain('SEGURANCA_FICHA:');
 if(caso==='abaixo')expect(origem.pendencias.join(' ')).toContain('PLAQUETAS_ABAIXO_BULA');
 else expect(origem.pendencias.join(' ')).not.toContain('ABAIXO_BULA');
 const antes=a.eventos();const r=await preparar(a,origem);expect(r.status).toBe(409);expect(r.data.codigo).toBe('SEGURANCA_FICHA_PENDENTE');expect(a.eventos()).toEqual(antes);
});
it('SafetyEngine aplica somente limiar declarado e aceita plaquetas válidas acima dele',async()=>{
 const spy=vi.spyOn(motorSeguranca,'safetyEngine');
 const t=template();t.limiaresBula={neutrofilosMin:null,plaquetasMin:100000,clcrMinMlMin:null,fevePctMin:null,fonte:'Limiar exclusivamente sintético'};
 const a=await abrir(t);a.seed('LabResult',(id:string)=>({campo:'plaquetas',valor:150000,unidade:'/µL',data:AGORA,sourceId:id}),id=>[{...fonteSintetica(id),dataClinica:AGORA}]);
 const origem=await instancia(a);expect(origem.pendencias,JSON.stringify(spy.mock.calls.map(c=>c[2]))).toEqual([]);expect((await preparar(a,origem)).status).toBe(200);
});

it('[pre-merge] correção incerta não ressuscita plaquetas substituídas',async()=>{
 const t=template();t.limiaresBula={neutrofilosMin:null,plaquetasMin:100000,clcrMinMlMin:null,fevePctMin:null,fonte:'Limiar exclusivamente sintético'};
 const a=await abrir(t);const anterior=a.seed('LabResult',(id:string)=>({campo:'plaquetas',valor:150000,unidade:'/µL',data:AGORA,sourceId:id}),id=>[{...fonteSintetica(id),dataClinica:AGORA}]);
 a.seed('LabResult',(id:string)=>({campo:'plaquetas',valor:30000,unidade:'/µL',data:AGORA,sourceId:id,requiresConfirmation:true}),id=>[{...fonteSintetica(id),dataClinica:AGORA}],anterior);
 const origem=await instancia(a);expect(origem.pendencias.join(' ')).toContain('SEGURANCA_FICHA:');
 const antes=a.eventos();expect((await preparar(a,origem)).status).toBe(409);expect(a.eventos()).toEqual(antes);
});
