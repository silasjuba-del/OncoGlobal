// Apenas pacientes, lotes, acoes e prescricao inteiramente sinteticos.
import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { lerDraft, listarEventos, salvarDraft } from "../../src/kernel/comandos/portas.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarMotorF1 } from "../../src/kernel/orquestracao/runtime.js";
import type { PedidoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { AcaoCompostaPreparada } from "../../src/contracts/api/execucaoAcaoComposta.js";
import { BasePrescricaoExecutavelResposta, PrescricaoExecutavelPreparada } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { ConteudoPrescricaoExecutavel } from "../../src/contracts/api/prescricaoExecutavel.js";
import { edicaoDaAcao } from "../../src/modules/prescricao/acaoParaPrescricao.js";
import { criarGerenciadorSessao, hashConteudoExibido } from "../../src/server/sessao.js";
import { rotear, type ServidorDeps } from "../../src/server/rotas.js";
import { ausente, fonteSintetica, presente } from "../fixtures/triagem.js";

const AGORA = "2026-10-09T12:00:00.000Z";
const SENHA = "senha-sintetica-acao-prescricao-2026";
const contexto = { patientId: "paciente-acao-rx-sintetico", encounterId: "consulta-acao-rx-sintetica", tumorLotId: "lote-acao-rx-sintetico" };
const outroContexto = { ...contexto, encounterId: "consulta-acao-rx-outro-sintetico" };
const BASE_ACAO = "/consulta/acoes-compostas/base";
const PREPARAR_ACAO = "/consulta/acoes-compostas/preparar";
const BASE_RX = "/consulta/prescricao-executavel/base";
const PREPARAR_RX = "/consulta/prescricao-executavel/preparar";
const CONFIRMAR_RX = "/consulta/prescricao-executavel/confirmar";

const ambientes: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => { for (const ambiente of ambientes.splice(0)) await ambiente.close(); });

function itemPrescrito() {
  return { itemId: "item-protocolo-sintetico-1", item: {
    drug: "Fármaco sintético", classe: "QT" as const, sequence: 1, standardDose: 100,
    doseBasis: "FIXED" as const, calculatedDose: 100, prescribedDose: 100, unit: "mg",
    adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "Diluente sintético",
    finalVolumeMl: 250, infusionTime: "60 min", days: ["d1"], observacao: null,
    source: "PROTOCOL" as const, overrideMotivo: null,
  } };
}

function prescription(ctx: typeof contexto, episodioId: string, cicloId: string) {
  return ConteudoPrescricaoExecutavel.parse({ schema: "PrescricaoExecutavel@1",
    contexto: { ...ctx, episodioId, cicloId }, documentId: `prescricao-${cicloId}`, documentVersion: 1,
    pacienteNome: "Paciente sintético", linha: 1, numeroCiclo: 2, protocoloId: "protocolo-sintetico",
    dataPrevista: "2026-10-15", motivo: "Prescrição sintética previamente assinada.",
    itens: [itemPrescrito()], origemProposta: null });
}

async function abrir() {
  const db = abrirLedger(":memory:");
  let sessoes = criarGerenciadorSessao({ medicoId: "medico-acao-sintetico", crm: "CRM-ACAO-SINTETICO",
    senha: SENHA, duracaoMs: 60_000, agora: () => AGORA });
  let token = sessoes.login(SENHA)!.token;
  const gateway = criarGateway({ agora: () => AGORA, store: memoriaIdempotencia(), auditar: () => {}, executores: {} });
  const motorF1 = criarMotorF1(db, () => AGORA, () => ({ regras: [],
    biblioteca: { id: "biblioteca-acao-sintetica", versao: "1", hash: "hash-acao-sintetico" } }));
  const deps: ServidorDeps = { db, sessoes, gateway, motorF1, agora: () => AGORA, log: () => {} };
  const server = createServer((req, res) => { void rotear(deps, req, res); });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_ACAO_AUSENTE");
  const port = address.port;
  let sequence = 0;

  async function request(path: string, body: unknown, bearer = token) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() as Record<string, any> };
  }

  function seed(ctx: typeof contexto, tipo: string,
    payload: Record<string, unknown> | ((eventId: string, reviewDecisionId: string) => unknown),
    revisao: "CONFIRMADO" | "ASSINADO" = "CONFIRMADO", supersedesEventId: string | null = null) {
    const eventId = `acao-rx-seed-${++sequence}`, reviewDecisionId = `acao-rx-review-${eventId}`;
    salvarDraft(db, { draftId: eventId, patientId: ctx.patientId, sourceId: eventId, rawRef: "referencia-local-sintetica",
      payload: { contexto: ctx }, diagnostics: [], revision: 0, criadoEm: AGORA });
    const data = typeof payload === "function" ? payload(eventId, reviewDecisionId) : payload;
    const gravada = executarConfirmacao(db, { ...ctx, operationId: eventId, reviewDecisionId,
      sessao: sessoes.obter(token)!, em: AGORA, registros: [{ draftId: eventId, expectedRevision: 0, eventId, tipo,
        payload: data, fontes: [fonteSintetica(eventId)], revisao, supersedesEventId }] });
    if (gravada.estado !== "GRAVADA") throw new Error(`SEED_ACAO_RX_NAO_GRAVADO:${tipo}:${gravada.estado}`);
    return eventId;
  }

  function assinarPrescricao(ctx: typeof contexto, episodioId: string, cicloId: string) {
    const conteudo = prescription(ctx, episodioId, cicloId);
    const documentData = { documentId: conteudo.documentId, documentVersion: conteudo.documentVersion,
      tipoDocumento: "PRESCRICAO_QT", texto: "Prescrição sintética assinada.", contexto: conteudo.contexto, prescricao: conteudo };
    const documentHash = hashConteudoExibido(documentData);
    const eventId = seed(ctx, "DOCUMENTO", (_id, reviewDecisionId) => ({ data: documentData,
      signature: { documentId: documentData.documentId, documentVersion: documentData.documentVersion,
        documentHash, reviewDecisionId, serverActorId: sessoes.obter(token)!.medicoId } }), "ASSINADO");
    return { conteudo, eventId };
  }

  function seedContext(ctx: typeof contexto, suffix: string) {
    const episodioId = `episodio-${suffix}`, cicloId = `ciclo-${suffix}`;
    seed(ctx, "TreatmentEpisode", { episodioId, tumorLotId: ctx.tumorLotId, modalidade: "QT", intencao: "PALIATIVA",
      intentModifier: null, linha: 1, esquemaId: "protocolo-sintetico", inicio: presente("2026-10-01"), fim: ausente<string>() });
    const { conteudo } = assinarPrescricao(ctx, episodioId, cicloId);
    seed(ctx, "Ciclo", { cicloId, episodioId, numero: 2, previstoEm: conteudo.dataPrevista,
      pesoKg: presente(70), origemPeso: "MEDIDO", ciclosSemPesoConsecutivos: 0,
      prescricaoRef: { documentId: conteudo.documentId, documentVersion: conteudo.documentVersion },
      itens: [{ item: 1, droga: "Fármaco sintético", doseMg: 100, reducaoPct: 0 }], comMedico: true });
  }

  seed(contexto, "Paciente", { patientId: contexto.patientId, identificadores: [], nome: "Paciente sintético",
    nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  seed(contexto, "TumorLot", { patientId: contexto.patientId, tumorLotId: contexto.tumorLotId,
    cid: presente("C50"), topografia: presente("Topografia sintética"), histologia: presente("Histologia sintética"),
    estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] });
  seedContext(contexto, "atual");
  seedContext(outroContexto, "outro-encontro");
  sessoes.selecionarConsulta(token, contexto);

  function selecionarConsulta(ctx: typeof contexto) { sessoes.selecionarConsulta(token, ctx); }
  function trocarMedico() {
    sessoes = criarGerenciadorSessao({ medicoId: "medico-acao-outro-sintetico", crm: "CRM-ACAO-OUTRO-SINTETICO",
      senha: SENHA, duracaoMs: 60_000, agora: () => AGORA });
    token = sessoes.login(SENHA)!.token;
    sessoes.selecionarConsulta(token, contexto);
    deps.sessoes = sessoes;
    return token;
  }
  const close = async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); };
  const ambiente = { db, request, seed, assinarPrescricao, selecionarConsulta, trocarMedico, close,
    eventos: (patientId = contexto.patientId) => listarEventos(db, patientId),
    draft: (draftId: string) => lerDraft(db, draftId) };
  ambientes.push(ambiente);
  return ambiente;
}

type Ambiente = Awaited<ReturnType<typeof abrir>>;
type Acao = "MANTER_CICLO" | "ADIAR_CICLO" | "REDUZIR_DOSE";
const pedidoAcao = (tipo: Acao): PedidoAcaoComposta => tipo === "MANTER_CICLO"
  ? { tipo, motivo: "Manter ciclo no caso sintético." }
  : tipo === "ADIAR_CICLO" ? { tipo, motivo: "Adiar no caso sintético.", dias: 7 }
    : { tipo, motivo: "Reduzir no caso sintético.", reducaoPct: 25, itensSelecionados: [1] };

async function prepararAcao(a: Ambiente, tipo: Acao, id = tipo.toLowerCase()) {
  const base = await a.request(BASE_ACAO, contexto);
  expect(base.status).toBe(200);
  expect(base.data.pendencias).toEqual([]);
  const entrada = { contexto, expectedBaseHash: base.data.base.baseHash, idempotencyKey: `acao-${id}`,
    pedido: pedidoAcao(tipo) };
  const resposta = await a.request(PREPARAR_ACAO, entrada);
  expect(resposta.status, JSON.stringify(resposta.data)).toBe(200);
  const action = AcaoCompostaPreparada.parse(resposta.data);
  return { base: base.data.base, action, entrada };
}

async function derivarEdicao(a: Ambiente, action: AcaoCompostaPreparada, ctx = contexto) {
  const base = await a.request(BASE_RX, ctx);
  expect(base.status).toBe(200);
  const parsedBase = BasePrescricaoExecutavelResposta.parse(base.data);
  const proposta = edicaoDaAcao(parsedBase, action);
  expect(proposta.pendencias).toEqual([]);
  expect(proposta.edicao).not.toBeNull();
  return { base: parsedBase, edicao: proposta.edicao! };
}

async function prepararRx(a: Ambiente, action: AcaoCompostaPreparada, edicao: Record<string, any>, ctx = contexto, key = "acao-rx") {
  const base = await a.request(BASE_RX, ctx);
  expect(base.status).toBe(200);
  return a.request(PREPARAR_RX, { contexto: ctx, expectedBaseHash: base.data.revisao,
    idempotencyKey: `preparar-${key}`, edicao });
}

async function assinarRx(a: Ambiente, preparada: Record<string, any>, ctx = contexto, key = "assinar-acao-rx") {
  return a.request(CONFIRMAR_RX, { contexto: ctx, draftId: preparada.draftId,
    expectedRevision: preparada.revision, conteudoHash: preparada.conteudoHash, idempotencyKey: key });
}

it.each([
  { tipo: "MANTER_CICLO" as const, esperado: 100, data: "2026-10-15" },
  { tipo: "ADIAR_CICLO" as const, esperado: 100, data: "2026-10-22" },
  { tipo: "REDUZIR_DOSE" as const, esperado: 75, data: "2026-10-15" },
])("ação $tipo vira nova prescrição estruturada e replay não duplica", async ({ tipo, esperado, data }) => {
  const a = await abrir(), eventosAntes = a.eventos();
  const { action } = await prepararAcao(a, tipo);
  expect(a.eventos()).toEqual(eventosAntes);
  const { edicao } = await derivarEdicao(a, action);
  expect(edicao.dataPrevista).toBe(data);
  expect(edicao.itens[0]!.item.prescribedDose).toBe(esperado);
  expect(edicao.origemProposta).toEqual({ draftId: action.draftId, revision: action.revision, hash: action.conteudoHash });

  const p = await prepararRx(a, action, edicao, contexto, tipo.toLowerCase());
  expect(p.status, JSON.stringify(p.data)).toBe(200);
  expect(p.data.conteudo).toMatchObject({ dataPrevista: data, origemProposta: edicao.origemProposta,
    itens: [{ item: { prescribedDose: esperado } }] });
  expect(a.eventos()).toEqual(eventosAntes);

  const assinado = await assinarRx(a, p.data, contexto, `confirmar-${tipo.toLowerCase()}`);
  expect(assinado.status, JSON.stringify(assinado.data)).toBe(200);
  expect(assinado.data.codigo).toBe("GRAVADA");
  const eventosAssinados = a.eventos();
  expect(eventosAssinados.filter(e => e.tipo === "TreatmentAdministration")).toHaveLength(0);
  const documentosAnteriores = new Set(eventosAntes.filter(e => e.tipo === "DOCUMENTO").map(e => e.eventId));
  const documento = eventosAssinados.find(e => e.tipo === "DOCUMENTO" && !documentosAnteriores.has(e.eventId))!;
  expect((documento.payload as { data: { data: { prescricao: { origemProposta: unknown } } } }).data.data.prescricao.origemProposta)
    .toEqual(edicao.origemProposta);

  const replay = await assinarRx(a, p.data, contexto, `confirmar-${tipo.toLowerCase()}`);
  expect(replay.status).toBe(200);
  expect(replay.data.codigo).toBe("REPLAY");
  expect(a.eventos()).toEqual(eventosAssinados);
});

it("recusa hash de ponteiro ou dose adulterados antes de gravar prescrição", async () => {
  const a = await abrir(), antes = a.eventos();
  const { action } = await prepararAcao(a, "REDUZIR_DOSE", "ataque-edicao");
  const { edicao } = await derivarEdicao(a, action);
  const pointerAdulterado = structuredClone(edicao);
  if (!pointerAdulterado.origemProposta) throw new Error("ORIGEM_ACAO_AUSENTE_NO_TESTE");
  pointerAdulterado.origemProposta.hash = "0".repeat(64);
  const hash = await prepararRx(a, action, pointerAdulterado, contexto, "hash-adulterado");
  expect(hash.status).toBe(409);
  expect(a.eventos()).toEqual(antes);

  const doseAdulterada = structuredClone(edicao);
  doseAdulterada.itens[0]!.item.prescribedDose = 73;
  const dose = await prepararRx(a, action, doseAdulterada, contexto, "dose-adulterada");
  expect(dose.status).toBe(409);
  expect(a.eventos()).toEqual(antes);
});

it("recusa pointer de ação aplicado a outro encontro ou médico", async () => {
  const a = await abrir(), { action } = await prepararAcao(a, "MANTER_CICLO", "ataque-ator-contexto");
  const { edicao } = await derivarEdicao(a, action);

  a.selecionarConsulta(outroContexto);
  const outraBase = await a.request(BASE_RX, outroContexto);
  expect(outraBase.status).toBe(200);
  const contextoErrado = await a.request(PREPARAR_RX, { contexto: outroContexto,
    expectedBaseHash: outraBase.data.revisao, idempotencyKey: "preparar-contexto-errado", edicao });
  expect(contextoErrado.status).toBe(409);

  a.selecionarConsulta(contexto);
  const outroToken = a.trocarMedico();
  const baseAtor = await a.request(BASE_RX, contexto, outroToken);
  expect(baseAtor.status).toBe(200);
  const atorErrado = await a.request(PREPARAR_RX, { contexto, expectedBaseHash: baseAtor.data.revisao,
    idempotencyKey: "preparar-ator-errado", edicao }, outroToken);
  expect(atorErrado.status).toBe(409);
  expect(a.eventos().filter(e => e.tipo === "DOCUMENTO")).toHaveLength(2);
});

it("recusa origem quando a base muda depois do plano", async () => {
  const a = await abrir(), { action } = await prepararAcao(a, "MANTER_CICLO", "ataque-base");
  const { edicao } = await derivarEdicao(a, action);
  a.seed(contexto, "FATO", { campo: "nota.sintetica", valor: "Novo fato após a proposta." });
  const eventosAntes = a.eventos();
  const rx = await prepararRx(a, action, edicao, contexto, "base-alterada");
  expect(rx.status).toBe(409);
  expect(a.eventos()).toEqual(eventosAntes);
  expect(a.eventos().filter(e => e.tipo === "DOCUMENTO")).toHaveLength(eventosAntes.filter(e => e.tipo === "DOCUMENTO").length);
});
