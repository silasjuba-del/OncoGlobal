// Somente fichas, fármacos e pacientes sintéticos; HTTP e SQLite reais locais.
import { afterEach, expect, it } from "vitest";
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
afterEach(async () => { for (const a of ambientes.splice(0)) await a.close(); });
const template = () => ProtocolTemplate.parse({ templateId: "ficha-sintetica", versao: "1",
  hash: "rotulo-legado-sintetico", status: "RASCUNHO", nome: "Protocolo sintético", tumor: "Tumor sintético", cenario: "Cenário sintético",
  codigoInstitucional: null, intervaloDias: 21, ciclos: null, fonte: "Documento inteiramente sintético", limiaresBula: null,
  itens: [{ drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: 1.5, doseBasis: "FIXED",
    calculatedDose: null, prescribedDose: null, unit: "mg", adjustmentPercent: null, adjustmentReason: null, route: "EV",
    diluent: "Diluente sintético", finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"], observacao: null,
    source: "PROTOCOL", overrideMotivo: null }] });
async function abrir() {
  const dir = criarDiretorio(), db = abrirLedger(":memory:");
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-ficha-sintetico", crm: "CRM-SINTETICO",
    senha: "senha-sintetica-ficha-123", duracaoMs: 60000, agora: () => AGORA });
  const token = sessoes.login("senha-sintetica-ficha-123")!.token;
  const corpus = { templatesProtocolo: [template()] } as NonNullable<ServidorDeps["corpus"]>;
  const gateway = criarGateway({ agora: () => AGORA, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const motorF1 = criarMotorF1(db, () => AGORA, () => ({ regras: [],
    biblioteca: { id: "biblioteca-sintetica", versao: "1", hash: "hash-sintetico" } }));
  const deps: ServidorDeps = { db, sessoes, corpus, gateway, motorF1, agora: () => AGORA, log: () => {} };
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
      senha: "senha-sintetica-ficha-123", duracaoMs: 60000, agora: () => AGORA });
    const outraToken = outraSessao.login("senha-sintetica-ficha-123")!.token;
    outraSessao.selecionarConsulta(outraToken, contexto);
    deps.sessoes = outraSessao;
    return outraToken;
  }
  let n = 0;
  function seed(tipo: string, payload: unknown) {
    const id = `ficha-seed-${++n}`;
    salvarDraft(db, { draftId: id, patientId: contexto.patientId, sourceId: id, rawRef: "referencia-local",
      payload: {}, revision: 0, diagnostics: [], criadoEm: AGORA });
    const r = executarConfirmacao(db, { ...contexto, operationId: id, reviewDecisionId: id,
      sessao: sessoes.obter(token)!, em: AGORA, registros: [{ eventId: id, draftId: id, expectedRevision: 0,
        tipo, payload, fontes: [fonteSintetica(id)], revisao: "CONFIRMADO" }] });
    expect(r.estado).toBe("GRAVADA");
  }
  seed("Paciente", { patientId: contexto.patientId, nome: "Paciente sintético da ficha", identificadores: [],
    nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  seed("TumorLot", { patientId: contexto.patientId, tumorLotId: contexto.tumorLotId, cid: presente("C50"),
    topografia: presente("Topografia sintética"), histologia: presente("Histologia sintética"),
    estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] });
  sessoes.selecionarConsulta(token, contexto);
  const close = async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); removerDiretorio(dir); };
  const a = { db, sessoes, token, corpus, request, seed, close, entrarOutroMedico,
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
async function preparar(a: Ambiente, origem: Record<string, any>, alteracoes = {}, ctx = contexto, bearer?: string) {
  const base = (await a.request(BASE, ctx, bearer)).data;
  return a.request(PREPARAR, { contexto: ctx, expectedBaseHash: base.revisao, idempotencyKey: "preparo-ficha",
    edicao: { protocoloId: origem.template.nome, dataPrevista: "2026-10-20", motivo: "Caso sintético revisado",
      planejamento: { modo: "NOVA_LINHA", linha: 1, intencao: "PALIATIVA", numeroCiclo: 1 },
      itens: origem.itens, origemProposta: origem.origemProposta, encaminharFarmacia: false, ...alteracoes } }, bearer);
}
const confirmar = (a: Ambiente, p: Record<string, any>) => a.request(CONFIRMAR, { contexto, draftId: p.draftId,
  expectedRevision: p.revision, conteudoHash: p.conteudoHash, idempotencyKey: "assinar-ficha" });

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
