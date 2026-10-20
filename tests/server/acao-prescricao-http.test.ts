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

it.each(["pedido", "contexto"])("replay nao confirma acao cujo %s persistido foi alterado", async campo => {
  const a = await abrir(), { action, entrada } = await prepararAcao(a, "MANTER_CICLO", `persistido-${campo}`);
  const { edicao } = await derivarEdicao(a, action);
  const payload = structuredClone(a.draft(action.draftId)!.payload) as Record<string, any>;
  if (campo === "pedido") payload.pedido.motivo = "Motivo persistido alterado apos a revisao";
  else payload.contexto.encounterId = outroContexto.encounterId;
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), action.draftId);
  const antes = a.eventos();
  // The prescription boundary already rejects this invalid stored origin.
  expect((await prepararRx(a, action, edicao, contexto, `origem-alterada-${campo}`)).status).toBe(409);
  const replay = await a.request(PREPARAR_ACAO, entrada);
  expect(replay.status).toBe(409);
  expect(replay.data.codigo).toBe("IDEMPOTENCIA_CONFLITO");
  expect(a.eventos()).toEqual(antes);
  expect(a.draft(action.draftId)!.payload).toEqual(payload);
});

it("replay trata payload persistido nulo como conflito sem erro interno", async () => {
  const a = await abrir(), { action, entrada } = await prepararAcao(a, "MANTER_CICLO", "persistido-nulo");
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run("null", action.draftId);
  const antes = a.eventos();
  const r = await a.request(PREPARAR_ACAO, entrada);
  expect(r).toMatchObject({ status: 409, data: { codigo: "IDEMPOTENCIA_CONFLITO" } });
  expect(a.eventos()).toEqual(antes);
});

it.each(["fatos", "medico", "administracao"])("confirmacao revalida %s alterado depois da previa", async mudanca => {
  const a = await abrir(), { action } = await prepararAcao(a, "REDUZIR_DOSE", `apos-previa-${mudanca}`);
  const { base, edicao } = await derivarEdicao(a, action);
  const p = await prepararRx(a, action, edicao, contexto, `apos-previa-${mudanca}`);
  expect(p.status).toBe(200);
  if (mudanca === "fatos") a.seed(contexto, "FATO", { campo: "nota.sintetica", valor: "Novo registro apos previa" });
  if (mudanca === "medico") a.trocarMedico();
  if (mudanca === "administracao") a.seed(contexto, "TreatmentAdministration", id => ({
    adminId: "administracao-sintetica-apos-previa", cicloId: base.ciclo!.cicloId,
    prescricaoRef: { documentId: base.vigente!.documentId, documentVersion: base.vigente!.documentVersion },
    item: 1, droga: "Fármaco sintético", quantidadeEfetivaMg: 100, status: "COMPLETA", motivo: null,
    inicio: "2026-10-01T10:00:00-03:00", fim: "2026-10-01T11:00:00-03:00", fonte: fonteSintetica(id),
  }));
  const antes = a.eventos();
  expect((await assinarRx(a, p.data, contexto, `confirmar-apos-${mudanca}`)).status).toBe(409);
  expect(a.eventos()).toEqual(antes);
  if (mudanca === "administracao") {
    const novaBase = await a.request(BASE_ACAO, contexto);
    expect(novaBase.data).toMatchObject({ base: null, pendencias: ["CICLO_COM_ADMINISTRACAO_REGISTRADA"] });
  }
});

it("outra assinatura entre previa e confirmacao nao e sobrescrita pela acao antiga", async () => {
  const a = await abrir(), primeira = await prepararAcao(a, "MANTER_CICLO", "concorrente-1");
  const e1 = await derivarEdicao(a, primeira.action);
  const p1 = await prepararRx(a, primeira.action, e1.edicao, contexto, "concorrente-1");
  expect(p1.status).toBe(200);
  const segunda = await prepararAcao(a, "ADIAR_CICLO", "concorrente-2");
  const e2 = await derivarEdicao(a, segunda.action);
  const p2 = await prepararRx(a, segunda.action, e2.edicao, contexto, "concorrente-2");
  expect(p2.status).toBe(200);
  expect((await assinarRx(a, p2.data, contexto, "assinar-concorrente-2")).status).toBe(200);
  const depois = a.eventos();
  expect((await assinarRx(a, p1.data, contexto, "assinar-concorrente-1")).status).toBe(409);
  expect(a.eventos()).toEqual(depois);
  const vigente = (await a.request(BASE_RX, contexto)).data.vigente;
  expect(vigente).toMatchObject({ documentVersion: 2, dataPrevista: "2026-10-22" });
});

it("replay de assinatura concluida preserva documento mesmo depois de novos fatos", async () => {
  const a = await abrir(), { action } = await prepararAcao(a, "MANTER_CICLO", "replay-historico");
  const { edicao } = await derivarEdicao(a, action);
  const p = await prepararRx(a, action, edicao, contexto, "replay-historico");
  expect(p.status).toBe(200);
  const primeiro = await assinarRx(a, p.data, contexto, "replay-historico");
  expect(primeiro.status).toBe(200);
  a.seed(contexto, "FATO", { campo: "nota.sintetica", valor: "Registro posterior a assinatura" });
  const depois = a.eventos();
  const replay = await assinarRx(a, p.data, contexto, "replay-historico");
  expect(replay.status).toBe(200);
  expect(replay.data).toEqual({ ...primeiro.data, codigo: "REPLAY" });
  expect(a.eventos()).toEqual(depois);
});

it("replay aceita reordenacao de propriedades sem alterar conteudo", async () => {
  const a = await abrir(), { action, entrada } = await prepararAcao(a, "MANTER_CICLO", "ordem-propriedades");
  const payload = structuredClone(a.draft(action.draftId)!.payload) as Record<string, any>;
  for (const campo of ["pedido", "contexto"]) payload[campo] = Object.fromEntries(Object.entries(payload[campo]).reverse());
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), action.draftId);
  expect((await a.request(PREPARAR_ACAO, entrada)).status).toBe(200);
});
