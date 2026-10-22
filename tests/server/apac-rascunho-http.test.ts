// Jornada APAC inteiramente sintética; a eRx nasce e é assinada pelas rotas reais.
import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { listarDrafts, listarEventos, salvarDraft } from "../../src/kernel/comandos/portas.js";
import { Apac } from "../../src/contracts/operacao.js";
import { registrarNegativaRetrogradaNoBancoF4 } from "../../src/server/f4Acesso.js";
import { aoCommitar, confirmar as confirmarNoKernel } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarMotorF1 } from "../../src/kernel/orquestracao/runtime.js";
import { BasePrescricaoExecutavelResposta, PrescricaoExecutavelPreparada } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { ConteudoPrescricaoExecutavel } from "../../src/contracts/api/prescricaoExecutavel.js";
import { criarGerenciadorSessao, hashConteudoExibido } from "../../src/server/sessao.js";
import { rotear, type ServidorDeps } from "../../src/server/rotas.js";
import { ausente, fonteSintetica, presente } from "../fixtures/triagem.js";

const AGORA = "2026-10-20T12:00:00.000Z";
const SENHA = "senha-sintetica-apac-rascunho-2026";
const contexto = { patientId: "paciente-apac-sintetico", encounterId: "consulta-apac-sintetica", tumorLotId: "lote-apac-sintetico" };
const BASE_RX = "/consulta/prescricao-executavel/base";
const PREPARAR_RX = "/consulta/prescricao-executavel/preparar";
const CONFIRMAR_RX = "/consulta/prescricao-executavel/confirmar";
const BASE_APAC = "/consulta/apac-rascunho/base";
const PREPARAR_APAC = "/consulta/apac-rascunho/preparar";
const CONFIRMAR_APAC = "/consulta/apac-rascunho/confirmar";

const ambientes: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => { for (const ambiente of ambientes.splice(0)) await ambiente.close(); });

function edicaoRx() {
  return { protocoloId: "esquema-apac-sintetico", dataPrevista: "2026-11-01",
    motivo: "Prescrição sintética para preparar APAC sem emissão.",
    planejamento: { modo: "NOVA_LINHA", linha: 1, intencao: "PALIATIVA", numeroCiclo: 1 },
    itens: [{ itemId: "item-apac-sintetico-1", item: {
      drug: "Fármaco APAC sintético", classe: "QT", sequence: 1, standardDose: null,
      doseBasis: "FIXED", calculatedDose: null, prescribedDose: 100, unit: "mg",
      adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "Diluente sintético",
      finalVolumeMl: 250, infusionTime: "60 min", days: ["d1"], observacao: null,
      source: "MANUAL", overrideMotivo: "Escolha manual sintética revisada.",
    } }], origemProposta: null, encaminharFarmacia: false };
}

function edicaoApac(overrides: Record<string, unknown> = {}) {
  return { competencia: "2026-10", campos: {
    procedimentoPrincipal: null, pacienteCns: null, nomeMae: null, nomeEstabelecimento: null,
    cnesSolicitante: null, solicitanteNome: null, solicitanteCns: null,
    justificativa: "Solicitação sintética; completar após conferência médica.",
    descricaoDiagnostico: null, quantidadePrincipal: null, pacienteNascimento: null, pacienteSexo: null,
  }, ...overrides };
}

async function abrir() {
  const db = abrirLedger(":memory:");
  let sessoes = criarGerenciadorSessao({ medicoId: "medico-apac-sintetico", crm: "CRM-APAC-SINTETICO",
    senha: SENHA, duracaoMs: 60_000, agora: () => AGORA });
  let token = sessoes.login(SENHA)!.token;
  const gateway = criarGateway({ agora: () => AGORA, store: memoriaIdempotencia(), auditar: () => {}, executores: {} });
  const motorF1 = criarMotorF1(db, () => AGORA, () => ({ regras: [],
    biblioteca: { id: "biblioteca-apac-sintetica", versao: "1", hash: "hash-apac-sintetico" } }));
  const deps: ServidorDeps = { db, sessoes, gateway, motorF1, corpus: null, agora: () => AGORA, log: () => {} };
  const server = createServer((req, res) => { void rotear(deps, req, res); });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_APAC_AUSENTE");
  const port = address.port;
  let sequence = 0;

  async function request(path: string, body: unknown, bearer = token) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() as Record<string, any> };
  }

  function seed(tipo: string, payload: unknown | ((eventId: string, reviewDecisionId: string) => unknown),
    options: { patientId?: string; tumorLotId?: string | null; encounterId?: string; revisao?: "CONFIRMADO" | "ASSINADO"; supersedesEventId?: string | null } = {}) {
    const eventId = `apac-seed-${++sequence}`, reviewDecisionId = `apac-review-${eventId}`;
    const ctx = { patientId: options.patientId ?? contexto.patientId, encounterId: options.encounterId ?? contexto.encounterId,
      tumorLotId: options.tumorLotId === undefined ? contexto.tumorLotId : options.tumorLotId };
    sessoes.selecionarConsulta(token, ctx);
    salvarDraft(db, { draftId: eventId, patientId: ctx.patientId, sourceId: eventId, rawRef: "referencia-local-sintetica",
      payload: { contexto: ctx }, diagnostics: [], revision: 0, criadoEm: AGORA });
    const data = typeof payload === "function" ? payload(eventId, reviewDecisionId) : payload;
    const resultado = executarConfirmacao(db, { ...ctx, operationId: eventId, reviewDecisionId,
      sessao: sessoes.obter(token)!, em: AGORA, registros: [{ draftId: eventId, expectedRevision: 0, eventId, tipo,
        payload: data, fontes: [fonteSintetica(eventId)], revisao: options.revisao ?? "CONFIRMADO",
        supersedesEventId: options.supersedesEventId ?? null }] });
    if (resultado.estado !== "GRAVADA") throw new Error(`SEED_APAC_NAO_GRAVADO:${tipo}:${resultado.estado}`);
    return eventId;
  }

  seed("Paciente", { patientId: contexto.patientId, identificadores: [], nome: "Paciente sintético APAC",
    nascimento: "1970-01-01", sexoCadastral: "F", divergencia: false });
  seed("TumorLot", { patientId: contexto.patientId, tumorLotId: contexto.tumorLotId,
    cid: presente("C50.9"), topografia: presente("Mama sintética"), histologia: presente("Histologia sintética"),
    estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] });
  sessoes.selecionarConsulta(token, contexto);

  function trocarMedico() {
    sessoes = criarGerenciadorSessao({ medicoId: "medico-apac-outro-sintetico", crm: "CRM-APAC-OUTRO-SINTETICO",
      senha: SENHA, duracaoMs: 60_000, agora: () => AGORA });
    token = sessoes.login(SENHA)!.token;
    sessoes.selecionarConsulta(token, contexto);
    deps.sessoes = sessoes;
    return token;
  }
  function selecionarConsulta(ctx: typeof contexto) { sessoes.selecionarConsulta(token, ctx); }

  const close = async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); };
  const ambiente = { db, request, seed, trocarMedico, selecionarConsulta, close,
    get sessoes() { return sessoes; }, get token() { return token; },
    eventos: (patientId = contexto.patientId) => listarEventos(db, patientId) };
  ambientes.push(ambiente);
  return ambiente;
}

type Ambiente = Awaited<ReturnType<typeof abrir>>;

function corromperFonteSintetica(a: Ambiente, eventId: string, payload: string, tipo?: string) {
  // Somente a fixture :memory: simula corrupção abaixo do writer; a proteção é restaurada.
  a.db.exec("DROP TRIGGER clinical_event_no_update");
  try {
    if (tipo) a.db.prepare("UPDATE clinical_event SET payload=?,tipo=? WHERE eventId=?").run(payload, tipo, eventId);
    else a.db.prepare("UPDATE clinical_event SET payload=? WHERE eventId=?").run(payload, eventId);
  }
  finally {
    a.db.exec(`CREATE TRIGGER clinical_event_no_update BEFORE UPDATE ON clinical_event
      BEGIN SELECT RAISE(ABORT, 'clinical_event append-only'); END;`);
  }
}

async function assinarRx(a: Ambiente) {
  const base = await a.request(BASE_RX, contexto);
  expect(base.status).toBe(200);
  const antes = a.eventos().length;
  const preparada = await a.request(PREPARAR_RX, { contexto, expectedBaseHash: base.data.revisao,
    idempotencyKey: "rx-para-apac-sintetica", edicao: edicaoRx() });
  expect(preparada.status, JSON.stringify(preparada.data)).toBe(200);
  expect(a.eventos()).toHaveLength(antes);
  const assinada = await a.request(CONFIRMAR_RX, { contexto, draftId: preparada.data.draftId,
    expectedRevision: preparada.data.revision, conteudoHash: preparada.data.conteudoHash,
    idempotencyKey: "assinar-rx-para-apac-sintetica" });
  expect(assinada.status, JSON.stringify(assinada.data)).toBe(200);
  expect(assinada.data.codigo).toBe("GRAVADA");
  return { preparada: PrescricaoExecutavelPreparada.parse(preparada.data), confirmada: assinada.data,
    eventosAposAssinatura: a.eventos().length };
}

async function baseApac(a: Ambiente) {
  const resposta = await a.request(BASE_APAC, contexto);
  expect(resposta.status, JSON.stringify(resposta.data)).toBe(200);
  return resposta.data;
}

async function prepararApac(a: Ambiente, base: Record<string, any>, edit = edicaoApac(), key = "apac-preparo") {
  return a.request(PREPARAR_APAC, { contexto, expectedBaseHash: base.revisao, idempotencyKey: key, edicao: edit });
}

async function confirmarApac(a: Ambiente, prepared: Record<string, any>, key = "apac-confirmar") {
  return a.request(CONFIRMAR_APAC, { contexto, draftId: prepared.draftId, expectedRevision: prepared.revision,
    conteudoHash: prepared.conteudoHash, idempotencyKey: key });
}

it("prepara APAC RASCUNHO da versão eRx assinada, não grava até confirmar e expõe só após salvar", async () => {
  const a = await abrir(), rx = await assinarRx(a);
  const base = await baseApac(a);
  expect(base.prescricao).toMatchObject({ documentId: rx.preparada.conteudo.documentId,
    documentVersion: rx.preparada.conteudo.documentVersion, protocoloId: rx.preparada.conteudo.protocoloId,
    dataPrevista: rx.preparada.conteudo.dataPrevista });
  const rascunhosAntes = a.eventos().filter(e => e.tipo === "APAC").length;
  const pronta = await prepararApac(a, base);
  expect(pronta.status, JSON.stringify(pronta.data)).toBe(200);
  expect(pronta.data.apac).toMatchObject({ estado: "RASCUNHO", resultadoExterno: null,
    prescricaoAssinadaRef: { documentId: rx.confirmada.documentId, documentVersion: rx.confirmada.documentVersion } });
  expect(pronta.data.permiteExportar).toBe(false);
  expect(pronta.data.pendencias.length).toBeGreaterThan(0);
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(rascunhosAntes);

  const confirmada = await confirmarApac(a, pronta.data);
  expect(confirmada.status, JSON.stringify(confirmada.data)).toBe(200);
  expect(confirmada.data).toMatchObject({ codigo: "GRAVADA", estado: "RASCUNHO", permiteExportar: false,
    apacId: pronta.data.apac.apacId, versao: pronta.data.apac.versao });
  const after = a.eventos();
  expect(after.filter(e => e.tipo === "TreatmentAdministration")).toHaveLength(0);
  const leitura = await a.request("/consulta/apac", {});
  expect(leitura.status).toBe(200);
  expect(leitura.data.itens).toContainEqual(expect.objectContaining({
    apac: expect.objectContaining({ apacId: pronta.data.apac.apacId, estado: "RASCUNHO", resultadoExterno: null,
      prescricaoAssinadaRef: { documentId: rx.confirmada.documentId, documentVersion: rx.confirmada.documentVersion } }),
  }));

  const replay = await confirmarApac(a, pronta.data);
  expect(replay.status).toBe(200);
  expect(replay.data.codigo).toBe("REPLAY");
  expect(a.eventos()).toEqual(after);
});

it("revisa APAC RASCUNHO em v2 sem apagar o histórico da v1 nem criar autorização", async () => {
  const a = await abrir(), rx = await assinarRx(a), base = await baseApac(a);
  const v1 = await prepararApac(a, base, edicaoApac(), "apac-v1");
  expect(v1.status).toBe(200);
  const savedV1 = await confirmarApac(a, v1.data, "apac-save-v1");
  expect(savedV1.status).toBe(200);
  const eventoV1 = a.eventos().find(e => e.tipo === "APAC")!;
  const baseV2 = await baseApac(a);
  const v2 = await prepararApac(a, baseV2, edicaoApac({ campos: { ...edicaoApac().campos,
    justificativa: "Justificativa sintética revisada para versão 2." } }), "apac-v2");
  expect(v2.status, JSON.stringify(v2.data)).toBe(200);
  expect(v2.data.apac).toMatchObject({ apacId: v1.data.apac.apacId, versao: v1.data.apac.versao + 1,
    resultadoExterno: null, estado: "RASCUNHO", prescricaoAssinadaRef: { documentId: rx.confirmada.documentId,
      documentVersion: rx.confirmada.documentVersion } });
  const savedV2 = await confirmarApac(a, v2.data, "apac-save-v2");
  expect(savedV2.status).toBe(200);
  const apacEvents = a.eventos().filter(e => e.tipo === "APAC");
  expect(apacEvents).toHaveLength(2);
  expect(apacEvents.find(e => e.eventId === eventoV1.eventId)).toEqual(eventoV1);
  expect(apacEvents.find(e => e.eventId === savedV2.data.eventId)?.supersedesEventId).toBe(eventoV1.eventId);
  expect(apacEvents.map(e => (e.payload as { data: { versao: number; estado: string; resultadoExterno: unknown } }).data))
    .toEqual(expect.arrayContaining([expect.objectContaining({ versao: 1, estado: "RASCUNHO", resultadoExterno: null }),
      expect.objectContaining({ versao: 2, estado: "RASCUNHO", resultadoExterno: null })]));
  const leitura = await a.request("/consulta/apac", {});
  expect(leitura.status).toBe(200);
  const ativas = leitura.data.itens.filter((item: { apac: { apacId: string } }) => item.apac.apacId === v1.data.apac.apacId);
  expect(ativas).toHaveLength(1);
  expect(ativas[0].apac.versao).toBe(2);
});

it("bloqueia alteração de APAC com resultado externo e preserva o registro autorizado", async () => {
  const a = await abrir(), rx = await assinarRx(a), base = await baseApac(a);
  const v1 = await prepararApac(a, base, edicaoApac(), "apac-externa-v1");
  expect(v1.status).toBe(200);
  const savedV1 = await confirmarApac(a, v1.data, "apac-externa-save-v1");
  expect(savedV1.status).toBe(200);
  const original = a.eventos().find(e => e.eventId === savedV1.data.eventId)!;
  const autorizado = { ...(original.payload as { data: Record<string, any> }).data,
    estado: "AUTORIZADA", resultadoExterno: { valor: "AUTORIZADA", comprovanteRef: "comprovante-sintetico",
      motivo: null, recebidoEm: AGORA }, versao: 2, substituiApacId: v1.data.apac.apacId };
  const extId = a.seed("APAC", autorizado, { supersedesEventId: original.eventId });
  const antes = a.eventos();
  const baseNova = await baseApac(a);
  const rejeitada = await prepararApac(a, baseNova, edicaoApac({ campos: { ...edicaoApac().campos,
    justificativa: "Tentativa sintética de substituir APAC externa." } }), "apac-tentar-sobrescrever-externa");
  expect(rejeitada.status).toBe(409);
  expect(a.eventos()).toEqual(antes);
  const externa = a.eventos().find(e => e.eventId === extId)!;
  expect((externa.payload as { data: { estado: string; resultadoExterno: { valor: string; comprovanteRef: string } } }).data)
    .toMatchObject({ estado: "AUTORIZADA", resultadoExterno: { valor: "AUTORIZADA", comprovanteRef: "comprovante-sintetico" } });
  expect(rx.confirmada.documentId).toBe(v1.data.apac.prescricaoAssinadaRef.documentId);
});

it("preserva negativa F4 legada e invalida preview/base sem substituir o resultado externo", async () => {
  const a = await abrir(); await assinarRx(a);
  const baseV1 = await baseApac(a), v1 = await prepararApac(a, baseV1, edicaoApac(), "apac-negativa-f4-v1");
  expect(v1.status).toBe(200);
  const salvaV1 = await confirmarApac(a, v1.data, "apac-negativa-f4-salvar-v1");
  expect(salvaV1.status).toBe(200);

  const baseAntesNegativa = await baseApac(a);
  const previewV2 = await prepararApac(a, baseAntesNegativa, edicaoApac({ campos: { ...edicaoApac().campos,
    justificativa: "Preview sintético anterior à negativa externa." } }), "apac-negativa-f4-preview-v2");
  expect(previewV2.status).toBe(200);
  const eventosAntesNegativa = a.eventos();
  const negativa = registrarNegativaRetrogradaNoBancoF4(a.db, { sessoes: a.sessoes, token: a.token, agora: AGORA }, {
    patientId: contexto.patientId, apacExistente: Apac.parse(v1.data.apac), codigoNegativa: "OUTRO",
    motivoTexto: "Negativa externa sintética", comprovanteRef: "comprovante-negativa-apac-sintetico",
  });
  expect(negativa.ok).toBe(true);

  const stale = await confirmarApac(a, previewV2.data, "apac-negativa-f4-confirmar-preview");
  expect(stale.status).toBe(409);
  expect(a.eventos()).toEqual(eventosAntesNegativa);
  const baseNegada = await baseApac(a);
  expect(baseNegada.revisao).not.toBe(baseAntesNegativa.revisao);
  expect(baseNegada.existentes).toContainEqual(expect.objectContaining({ apacId: v1.data.apac.apacId, estado: "NEGADA" }));
  const leitura = await a.request("/consulta/apac", {});
  expect(leitura.status).toBe(200);
  expect(leitura.data.itens).toContainEqual(expect.objectContaining({ apac: expect.objectContaining({
    apacId: v1.data.apac.apacId, estado: "NEGADA", resultadoExterno: expect.objectContaining({
      valor: "NEGADA", comprovanteRef: "comprovante-negativa-apac-sintetico",
    }),
  }) }));

  const substituir = await prepararApac(a, baseNegada, edicaoApac({ campos: { ...edicaoApac().campos,
    justificativa: "Tentativa sintética após negativa externa." } }), "apac-negativa-f4-substituir");
  expect(substituir.status).toBe(409);
  expect(a.eventos()).toEqual(eventosAntesNegativa);
});

it("recusa hash/contexto/ator/base obsoletos e promoção pelo confirmar genérico", async () => {
  const a = await abrir(), rx = await assinarRx(a), base = await baseApac(a);
  const pronta = await prepararApac(a, base, edicaoApac(), "apac-ataques");
  expect(pronta.status).toBe(200);
  const before = a.eventos();

  const hashTrocado = await confirmarApac(a, { ...pronta.data, conteudoHash: "0".repeat(64) }, "apac-hash-trocado");
  expect(hashTrocado.status).toBe(409);
  const contextoErrado = await a.request(CONFIRMAR_APAC, { contexto: { ...contexto, encounterId: "outro-encontro" },
    draftId: pronta.data.draftId, expectedRevision: pronta.data.revision, conteudoHash: pronta.data.conteudoHash,
    idempotencyKey: "apac-contexto-errado" });
  expect(contextoErrado.status).toBe(409);

  const outroToken = a.trocarMedico();
  const atorErrado = await a.request(CONFIRMAR_APAC, { contexto, draftId: pronta.data.draftId,
    expectedRevision: pronta.data.revision, conteudoHash: pronta.data.conteudoHash, idempotencyKey: "apac-ator-errado" }, outroToken);
  expect(atorErrado.status).toBe(409);
  expect(a.eventos()).toEqual(before);
  expect(rx.confirmada.documentVersion).toBe(1);
});

it("recusa confirmar preview se a base mudar depois de preparar", async () => {
  const a = await abrir(); await assinarRx(a);
  const base = await baseApac(a), preparada = await prepararApac(a, base, edicaoApac(), "apac-base-obsoleta");
  expect(preparada.status).toBe(200);
  a.seed("FATO", { campo: "apac.contexto.sintetico", valor: "fato posterior à prévia" });
  const eventosAntes = a.eventos();
  const r = await confirmarApac(a, preparada.data, "confirmar-base-obsoleta");
  expect(r.status).toBe(409);
  expect(a.eventos()).toEqual(eventosAntes);
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(0);
});

it.each(["JSON_INVALIDO", "PAYLOAD_FORA_DO_CONTRATO", "TIPO_DIVERGENTE"])("fonte APAC corrompida (%s) fica pendente e não vira nova APAC por ausência aparente", async falha => {
  const a = await abrir(); await assinarRx(a);
  const base = await baseApac(a), preparada = await prepararApac(a, base);
  const salva = await confirmarApac(a, preparada.data);
  expect(salva.status).toBe(200);
  const eventosAntes = Number(a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n);
  const draftsAntes = listarDrafts(a.db, contexto.patientId);
  corromperFonteSintetica(a, salva.data.eventId,
    falha === "JSON_INVALIDO" ? "{" : JSON.stringify({ data: {
      ...preparada.data.apac, apacId: falha === "TIPO_DIVERGENTE" ? preparada.data.apac.apacId : null,
    } }), falha === "TIPO_DIVERGENTE" ? "Contato" : undefined);
  const pendente = await baseApac(a);
  expect(pendente.prescricao).toBeNull();
  expect(pendente.pendencias).toContain("INTEGRIDADE_FONTE_APAC_PENDENTE");
  const tentativa = await prepararApac(a, pendente, edicaoApac(), "nao-recriar-apac-corrompida");
  expect(tentativa.status).toBe(409);
  expect(tentativa.data.codigo).toBe("BASE_APAC_PENDENTE");
  expect(Number(a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n)).toBe(eventosAntes);
  expect(listarDrafts(a.db, contexto.patientId)).toEqual(draftsAntes);
});

it("fonte corrompida de outra pessoa não contamina a base APAC selecionada", async () => {
  const a = await abrir(); await assinarRx(a);
  const base = await baseApac(a), preparada = await prepararApac(a, base);
  const id = a.seed("APAC", { ...preparada.data.apac, apacId: "apac-outra-pessoa", tumorLotId: "outro-lote" },
    { patientId: "outra-pessoa-sintetica", tumorLotId: "outro-lote" });
  corromperFonteSintetica(a, id, "{");
  a.selecionarConsulta(contexto);
  expect(await baseApac(a)).toEqual(base);
  // Trocar de pessoa invalida o recibo da sessão; a reexibição dedicada o renova.
  expect((await prepararApac(a, base)).status).toBe(200);
  const salva = await confirmarApac(a, preparada.data);
  expect(salva.status, JSON.stringify(salva.data)).toBe(200);
});

it("registro R1 barra o bundle genérico da preparação e o recibo dedicado confirma a APAC exata", async () => {
  const a = await abrir(); await assinarRx(a);
  const base = await baseApac(a), preparada = await prepararApac(a, base, edicaoApac(), "apac-gate-generico");
  expect(preparada.status).toBe(200);
  const antes = a.eventos();
  const confirmarGenerico = await a.request("/consulta/confirmar", { patientId: contexto.patientId,
    encounterId: contexto.encounterId, tumorLotId: contexto.tumorLotId, bloco: "APAC",
    registros: [{ id: preparada.data.draftId, expectedRevision: preparada.data.revision }],
    documentosExibidos: [{ documentId: preparada.data.apac.apacId, documentVersion: preparada.data.apac.versao }],
    reconhecerAlertas: [], idempotencyKey: "apac-generico-com-recibo-real" });
  expect(confirmarGenerico.status, JSON.stringify(confirmarGenerico.data)).toBe(409);
  expect(confirmarGenerico.data).toMatchObject({ codigo: "DRAFT_AINDA_RASCUNHO" });
  expect(a.eventos()).toEqual(antes);
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(0);

  const bundle = await a.request("/consulta/bundle", { patientId: contexto.patientId, encounterId: contexto.encounterId,
    tumorLotId: contexto.tumorLotId, draftIds: [preparada.data.draftId] });
  expect(bundle.status, JSON.stringify(bundle.data)).toBe(409);
  expect(bundle.data).toMatchObject({ codigo: "DRAFT_AINDA_RASCUNHO" });
  expect(a.eventos()).toEqual(antes);
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(0);

  // A recusa do bundle não substitui a prova positiva: o recibo real do preparo dedicado
  // continua aceito pela rota especializada para o mesmo draft, APAC e versão.
  const confirmada = await confirmarApac(a, preparada.data, "apac-gate-dedicado-confirmar");
  expect(confirmada.status, JSON.stringify(confirmada.data)).toBe(200);
  expect(confirmada.data).toMatchObject({ codigo: "GRAVADA", estado: "RASCUNHO", permiteExportar: false,
    apacId: preparada.data.apac.apacId, versao: preparada.data.apac.versao });
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(1);
  expect(a.eventos().find(e => e.tipo === "APAC")?.payload).toMatchObject({
    data: { apacId: preparada.data.apac.apacId, versao: preparada.data.apac.versao, estado: "RASCUNHO" },
  });
  expect(a.eventos().filter(e => e.tipo === "TreatmentAdministration")).toHaveLength(0);
});

it("confirmação dedicada APAC reverte draft, operação e evento se o commit posterior falha; retry grava uma vez", async () => {
  const a = await abrir(); await assinarRx(a);
  const base = await baseApac(a), preparada = await prepararApac(a, base, edicaoApac(), "apac-atomic-preparo");
  expect(preparada.status).toBe(200);
  const chaveConfirmacao = "apac-atomic-confirmacao", operationId = `apac-confirmar:${chaveConfirmacao}`;
  const antes = a.eventos();
  aoCommitar(a.db, () => { throw new Error("FALHA_SINTETICA_APOS_GRAVACAO_APAC"); });
  const interrompida = await confirmarApac(a, preparada.data, chaveConfirmacao);
  expect(interrompida.status, JSON.stringify(interrompida.data)).toBe(409);
  expect(interrompida.data).toMatchObject({ codigo: "APAC_TRANSACAO_NAO_CONFIRMADA" });
  expect(a.eventos()).toEqual(antes);
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(0);
  expect(Number((a.db.prepare("SELECT COUNT(*) AS n FROM operation WHERE operationId=?").get(operationId) as { n: number }).n)).toBe(0);
  expect(listarDrafts(a.db, contexto.patientId).filter(d => {
    const payload = d.payload && typeof d.payload === "object" ? d.payload as Record<string, unknown> : null;
    return payload?.kind === "APAC_CONFIRMACAO_CANONICA" && payload.origem === preparada.data.draftId;
  })).toHaveLength(0);

  aoCommitar(a.db, () => {});
  const retry = await confirmarApac(a, preparada.data, chaveConfirmacao);
  expect(retry.status, JSON.stringify(retry.data)).toBe(200);
  expect(retry.data).toMatchObject({ codigo: "GRAVADA", estado: "RASCUNHO", permiteExportar: false,
    apacId: preparada.data.apac.apacId, versao: preparada.data.apac.versao });
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(1);
  expect(Number((a.db.prepare("SELECT COUNT(*) AS n FROM operation WHERE operationId=?").get(operationId) as { n: number }).n)).toBe(1);
  expect(listarDrafts(a.db, contexto.patientId).filter(d => {
    const payload = d.payload && typeof d.payload === "object" ? d.payload as Record<string, unknown> : null;
    return payload?.kind === "APAC_CONFIRMACAO_CANONICA" && payload.origem === preparada.data.draftId;
  })).toHaveLength(1);
});

it("registro R1 barra reutilizar o draft canônico APAC no bundle genérico de FATO", async () => {
  const a = await abrir(); await assinarRx(a);
  const base = await baseApac(a), preparada = await prepararApac(a, base, edicaoApac(), "apac-canonico-reuso");
  expect(preparada.status).toBe(200);
  const salva = await confirmarApac(a, preparada.data, "apac-canonico-salvar");
  expect(salva.status).toBe(200);
  const canonico = listarDrafts(a.db, contexto.patientId).find(d => {
    const payload = d.payload && typeof d.payload === "object" ? d.payload as Record<string, unknown> : null;
    return payload?.kind === "APAC_CONFIRMACAO_CANONICA" && payload.origem === preparada.data.draftId;
  });
  expect(canonico).toBeTruthy();
  const antes = a.eventos();
  const bundle = await a.request("/consulta/bundle", { patientId: contexto.patientId, encounterId: contexto.encounterId,
    tumorLotId: contexto.tumorLotId, draftIds: [canonico!.draftId] });
  expect(bundle.status, JSON.stringify(bundle.data)).toBe(409);
  expect(bundle.data).toMatchObject({ codigo: "DRAFT_AINDA_RASCUNHO" });

  // Simula o recibo exato que a exibição genérica emitiria para essa cópia; o gate
  // ainda precisa recusar pela classificação R1, não por falta de bundle.
  a.sessoes.registrarBundleExibido(a.token, contexto, [{ draftId: canonico!.draftId,
    documentId: canonico!.draftId, documentVersion: canonico!.revision + 1,
    conteudoHash: hashConteudoExibido(canonico!.payload) }]);
  const reuso = await a.request("/consulta/confirmar", { patientId: contexto.patientId,
    encounterId: contexto.encounterId, tumorLotId: contexto.tumorLotId, bloco: "APAC",
    registros: [{ id: canonico!.draftId, expectedRevision: canonico!.revision }],
    documentosExibidos: [{ documentId: canonico!.draftId, documentVersion: canonico!.revision + 1 }],
    reconhecerAlertas: [], idempotencyKey: "apac-canonico-com-recibo-generico" });
  expect(reuso.status, JSON.stringify(reuso.data)).toBe(409);
  expect(reuso.data).toMatchObject({ codigo: "DRAFT_AINDA_RASCUNHO" });
  expect(a.eventos()).toEqual(antes);
  expect(a.eventos().filter(e => e.tipo === "FATO" && e.operationId === "apac-canonico-com-recibo-generico")).toHaveLength(0);
  expect(listarDrafts(a.db, contexto.patientId).find(d => d.draftId === canonico!.draftId)?.revision).toBe(canonico!.revision);
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(1);
  expect(salva.data).toMatchObject({ apacId: preparada.data.apac.apacId, versao: preparada.data.apac.versao,
    estado: "RASCUNHO", permiteExportar: false });
});

it("o kernel só aceita a cópia canônica APAC exata, no contexto e revisão dedicados", async () => {
  const a = await abrir(); await assinarRx(a);
  const base = await baseApac(a), preparada = await prepararApac(a, base, edicaoApac(), "apac-canonico-reuso");
  expect(preparada.status).toBe(200);
  const salva = await confirmarApac(a, preparada.data, "apac-canonico-salvar");
  expect(salva.status).toBe(200);
  const canonico = listarDrafts(a.db, contexto.patientId).find(d => {
    const payload = d.payload && typeof d.payload === "object" ? d.payload as Record<string, unknown> : null;
    return payload?.origem === preparada.data.draftId;
  });
  expect(canonico).toBeTruthy();
  const antes = a.eventos();
  const payloadCanonico = canonico!.payload as { apac: unknown };
  const apacCanonica = Apac.parse(payloadCanonico.apac);
  const apacAlterada = Apac.parse({ ...apacCanonica, campos: { ...apacCanonica.campos,
    justificativa: "Tentativa sintética de adulterar a cópia canônica." } });
  const tentativas = [
    { nome: "tipo", contexto, tipo: "FATO", expectedRevision: canonico!.revision,
      payload: { campo: "apac.falso", valor: true } },
    { nome: "payload", contexto, tipo: "APAC", expectedRevision: 0, payload: apacAlterada },
    { nome: "contexto", contexto: { ...contexto, encounterId: "outro-encontro-sintetico" }, tipo: "APAC",
      expectedRevision: 0, payload: apacCanonica },
    { nome: "revisao", contexto, tipo: "APAC", expectedRevision: 1, payload: apacCanonica },
  ] as const;
  for (const tentativa of tentativas) {
    const operationId = `apac-canonico-adulterado-${tentativa.nome}`;
    const resultado = confirmarNoKernel(a.db, { ...tentativa.contexto, operationId,
      reviewDecisionId: `review-${operationId}`, sessao: a.sessoes.obter(a.token)!, em: AGORA,
      registros: [{ draftId: canonico!.draftId, expectedRevision: tentativa.expectedRevision,
        eventId: `evento-${operationId}`, tipo: tentativa.tipo, payload: tentativa.payload,
        fontes: [fonteSintetica(operationId)], revisao: "CONFIRMADO" }] });
    expect(resultado.estado, tentativa.nome).toBe("NEGADA");
    expect(resultado.motivo, tentativa.nome).toBe("CONFIRMACAO_APAC_DIVERGENTE");
    expect(a.eventos()).toEqual(antes);
    expect(listarDrafts(a.db, contexto.patientId).find(d => d.draftId === canonico!.draftId)?.revision)
      .toBe(canonico!.revision);
  }
  expect(a.eventos().filter(e => e.tipo === "FATO" && e.operationId.startsWith("apac-canonico-adulterado-") )).toHaveLength(0);
  expect(a.eventos().filter(e => e.tipo === "APAC")).toHaveLength(1);
});

it("Task009 identidade do payload divergente nao vira dados administrativos de outro paciente",async()=>{
 const a=await abrir();await assinarRx(a);
 const cadastro=a.eventos().find(e=>e.tipo==="Paciente")!;
 const payload=structuredClone(cadastro.payload) as any;payload.data.patientId="outra-pessoa-sintetica";payload.data.nome="Outra pessoa sintetica";
 corromperFonteSintetica(a,cadastro.eventId,JSON.stringify(payload));
 const base=await baseApac(a);expect(base.prescricao).toBeNull();
 expect(base.camposClinicos.find((c:any)=>c.chave==="pacienteNome")?.valor).toBeNull();
 const antes=a.eventos().length;expect((await prepararApac(a,base,edicaoApac(),"identidade-divergente")).status).toBe(409);expect(a.eventos()).toHaveLength(antes);
});
it("Task009 cadastro Paciente@1 valido continua fonte da APAC",async()=>{
 const a=await abrir();await assinarRx(a);const cadastro=a.eventos().find(e=>e.tipo==="Paciente")!;
 a.seed("Paciente@1",(cadastro.payload as any).data,{supersedesEventId:cadastro.eventId});
 const base=await baseApac(a);expect(base.prescricao).not.toBeNull();expect((await prepararApac(a,base,edicaoApac(),"cadastro-v1")).status).toBe(200);
});
it("Task009 APAC@1 nao desaparece nem permite criar outro id ao revisar",async()=>{
 const a=await abrir();await assinarRx(a);const p=await prepararApac(a,await baseApac(a));const salva=await confirmarApac(a,p.data);
 const evento=a.eventos().find(e=>e.eventId===salva.data.eventId)!;
 a.seed("APAC@1",(evento.payload as any).data,{supersedesEventId:evento.eventId});
 const base=await baseApac(a);expect(base.existentes).toContainEqual(expect.objectContaining({apacId:p.data.apac.apacId,versao:1}));
 const v2=await prepararApac(a,base,edicaoApac(),"alias-apac-v2");expect(v2.data.apac).toMatchObject({apacId:p.data.apac.apacId,versao:2});
});
it.each(["revisao","ator","futuro","conteudo"])("Task009 replay recusa recibo cuja autoridade foi corrompida: %s",async campo=>{
 const a=await abrir();await assinarRx(a);const p=await prepararApac(a,await baseApac(a));const salvo=await confirmarApac(a,p.data,"recibo-integro");expect(salvo.status).toBe(200);
 a.db.exec("DROP TRIGGER clinical_event_no_update");try{
 if(campo==="revisao")a.db.prepare("UPDATE clinical_event SET revisao='ASSINADO' WHERE eventId=?").run(salvo.data.eventId);
 if(campo==="ator")a.db.prepare("UPDATE clinical_event SET criadoPor=? WHERE eventId=?").run(JSON.stringify({tipo:"SISTEMA",id:a.sessoes.obter(a.token)!.medicoId}),salvo.data.eventId);
 if(campo==="futuro")a.db.prepare("UPDATE clinical_event SET criadoEm='2027-10-20T12:00:00Z' WHERE eventId=?").run(salvo.data.eventId);
 if(campo==="conteudo"){const evento=a.eventos().find(e=>e.eventId===salvo.data.eventId)!,p=structuredClone(evento.payload) as any;p.data.campos.pacienteNome="Nome substituido no recibo";a.db.prepare("UPDATE clinical_event SET payload=? WHERE eventId=?").run(JSON.stringify(p),salvo.data.eventId);}
 }finally{a.db.exec("CREATE TRIGGER clinical_event_no_update BEFORE UPDATE ON clinical_event BEGIN SELECT RAISE(ABORT, 'clinical_event append-only'); END;");}
 const antes=a.eventos().length;expect((await confirmarApac(a,p.data,"recibo-integro")).status).toBe(409);expect(a.eventos()).toHaveLength(antes);
});
it("Task009 negativa F4 ilegivel nao libera recriacao como rascunho",async()=>{
 const a=await abrir();await assinarRx(a);const p=await prepararApac(a,await baseApac(a));expect((await confirmarApac(a,p.data)).status).toBe(200);
 const negativa=registrarNegativaRetrogradaNoBancoF4(a.db,{sessoes:a.sessoes,token:a.token,agora:AGORA},{patientId:contexto.patientId,apacExistente:Apac.parse(p.data.apac),codigoNegativa:"OUTRO",motivoTexto:"Negativa sintetica",comprovanteRef:"comprovante-sintetico"});expect(negativa.ok).toBe(true);
 a.db.exec("DROP TRIGGER f4_apac_retrograda_no_update");try{a.db.prepare("UPDATE f4_apac_retrograda SET apacNegadaJson=? WHERE apacId=?").run("{",p.data.apac.apacId);}finally{a.db.exec("CREATE TRIGGER f4_apac_retrograda_no_update BEFORE UPDATE ON f4_apac_retrograda BEGIN SELECT RAISE(ABORT, 'f4_apac_retrograda append-only'); END;");}
 const base=await baseApac(a),antes=a.eventos().length;
 expect(base.prescricao).toBeNull();expect((await prepararApac(a,base,edicaoApac(),"f4-corrompida")).status).toBe(409);expect(a.eventos()).toHaveLength(antes);
 const lista=await a.request("/consulta/apac",{});expect(lista.status).toBe(200);expect(lista.data.itens.find((i:any)=>i.apac.apacId===p.data.apac.apacId)).toMatchObject({antiglosa:null,antiglosaEstado:"PENDENTE_INTEGRIDADE_APAC"});
});

it("Task009 lote do payload APAC divergente do envelope bloqueia nova versao",async()=>{
 const a=await abrir();await assinarRx(a);const p=await prepararApac(a,await baseApac(a));const salva=await confirmarApac(a,p.data);
 const evento=a.eventos().find(e=>e.eventId===salva.data.eventId)!,payload=structuredClone(evento.payload) as any;
 payload.data.tumorLotId="outro-lote-sintetico";corromperFonteSintetica(a,evento.eventId,JSON.stringify(payload));
 const base=await baseApac(a);expect(base.prescricao).toBeNull();expect((await prepararApac(a,base,edicaoApac(),"lote-divergente")).status).toBe(409);
});
it("Task009 copia canonica nao pode gravar payload de outro lote mesmo se ambas copias coincidirem",async()=>{
 const a=await abrir();await assinarRx(a);const p=await prepararApac(a,await baseApac(a)),apac={...p.data.apac,tumorLotId:"outro-lote-sintetico"};
 salvarDraft(a.db,{draftId:"canonica-cruzada",patientId:contexto.patientId,sourceId:"fixture",rawRef:"local",payload:{kind:"APAC_CONFIRMACAO_CANONICA",contexto,origem:p.data.draftId,conteudoHash:p.data.conteudoHash,apac},diagnostics:[],revision:0,criadoEm:AGORA});
 const antes=a.eventos().length;
 const r=confirmarNoKernel(a.db,{...contexto,operationId:"tentativa-canonica-cruzada",reviewDecisionId:"revisao",sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{draftId:"canonica-cruzada",expectedRevision:0,eventId:"evento-cruzado",tipo:"APAC",payload:apac,fontes:[],revisao:"CONFIRMADO"}]});
 expect(r.estado).toBe("NEGADA");expect(a.eventos()).toHaveLength(antes);
});

it("Task009 replay concluido continua historico depois de novos fatos sem duplicar",async()=>{
 const a=await abrir();await assinarRx(a);const p=await prepararApac(a,await baseApac(a));const salva=await confirmarApac(a,p.data,"replay-historico");expect(salva.status).toBe(200);
 a.seed("FATO",{campo:"observacao",valor:"Fato posterior sintetico"});const antes=a.eventos();
 const replay=await confirmarApac(a,p.data,"replay-historico");expect(replay.status).toBe(200);expect(replay.data).toEqual({...salva.data,codigo:"REPLAY"});expect(a.eventos()).toEqual(antes);
});

it.each([false,true])('APAC recupera em sessão nova sem duplicar: gravada=%s',async gravada=>{
 const a=await abrir();await assinarRx(a);const base=await baseApac(a),p=await prepararApac(a,base);
 const pedido={contexto,draftId:p.data.draftId,expectedRevision:p.data.revision,conteudoHash:p.data.conteudoHash,idempotencyKey:'apac-reload'};
 if(gravada)expect((await a.request(CONFIRMAR_APAC,pedido)).status).toBe(200);
 const token=a.sessoes.login(SENHA)!.token;a.sessoes.selecionarConsulta(token,contexto);const antes=a.eventos();
 const r=await a.request('/consulta/confirmacao/recuperar',{tipo:'APAC',pedido},token);
 expect(r.status).toBe(200);expect(r.data.estado).toBe(gravada?'CONFIRMADA':'PREVIA');expect(a.eventos()).toEqual(antes);
 expect((await a.request(CONFIRMAR_APAC,pedido,token)).status).toBe(200);
 expect(a.eventos().filter(e=>e.operationId==='apac-confirmar:apac-reload')).toHaveLength(1);
 const cancel=await a.request('/consulta/confirmacao/recuperar',{tipo:'APAC',pedido,cancelar:true},token);
 expect(cancel.data.estado).toBe('CONFIRMADA');expect(a.eventos().filter(e=>e.tipo==='APAC')).toHaveLength(1);
});
