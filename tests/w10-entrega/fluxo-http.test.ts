import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft, lerDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao, hashConteudoExibido } from "../../src/server/sessao.js";

const NOW = "2026-10-07T13:00:00.000Z";
const PATIENT = "Paciente Teste 88";
const ENCOUNTER = "encontro-teste-88";

function iniciar(db: ReturnType<typeof abrirLedger>) {
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste-88", crm: "CRM-TESTE-88",
    senha: "senha-sintetica-comprida-88", duracaoMs: 60_000, agora: () => NOW });
  const gateway = criarGateway({ agora: () => NOW, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const server = criarServidorLocal({ db, sessoes, gateway, agora: () => NOW, log: () => {} });
  const token = sessoes.login("senha-sintetica-comprida-88")!.token;
  return new Promise<{ token: string; sessoes: ReturnType<typeof criarGerenciadorSessao>;
    request: (path: string, body: unknown, auth?: boolean) => Promise<{ status: number; data: any }>;
    close: () => Promise<void> }>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("PORTA_AUSENTE"));
      const base = `http://127.0.0.1:${address.port}`;
      const request = async (path: string, body: unknown, auth = true) => {
        const response = await fetch(`${base}${path}`, { method: "POST", headers: {
          "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${token}` } : {}),
        }, body: JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
      };
      resolve({ token, sessoes, request, close: () => new Promise<void>((done) => server.close(() => done())) });
    });
  });
}

function semearPaciente(db: ReturnType<typeof abrirLedger>, token: string,
  sessoes: ReturnType<typeof criarGerenciadorSessao>, patientId = PATIENT) {
  const encounterId = patientId === PATIENT ? ENCOUNTER : `encontro-${patientId.slice(-2)}`;
  const suffix = patientId.slice(-2);
  const draftId = `paciente-seed-w10-${suffix}`;
  salvarDraft(db, { draftId, patientId, sourceId: `seed-source-${suffix}`, rawRef: "fixture-local",
    payload: {}, diagnostics: [], revision: 0, criadoEm: NOW });
  const result = confirmar(db, { operationId: `patient-seed-operation-${suffix}`, patientId,
    tumorLotId: null, encounterId, reviewDecisionId: `patient-seed-review-${suffix}`,
    sessao: sessoes.obter(token)!, em: NOW, registros: [{ draftId, expectedRevision: 0,
      eventId: `patient-seed-event-${suffix}`, tipo: "Paciente", payload: { patientId,
        identificadores: [], nome: patientId, nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false },
      fontes: [], revisao: "CONFIRMADO" }] });
  expect(result.estado).toBe("GRAVADA");
}

type PedidoRevisao = { draftId: string; expectedRevision: number; patientId: string;
  factIds: string[]; operationId: string };
/** Models the explicit preview screen; only callers expecting success use this helper. */
async function exibirRevisao(app: Awaited<ReturnType<typeof iniciar>>, pedido: PedidoRevisao) {
  const prepared = await app.request("/consulta/rascunho/preparar-revisao", pedido);
  expect(prepared.status).toBe(200);
  expect(prepared.data.criaEventoClinico).toBe(false);
  expect(prepared.data.conteudo.selectedFactIds).toEqual(pedido.factIds);
  expect(prepared.data.conteudo.facts.map((fact: { id: string }) => fact.id)).toEqual(pedido.factIds);
  expect(prepared.data.conteudo.facts.every((fact: { rawEvidence: string }) => !!fact.rawEvidence)).toBe(true);
  expect(prepared.data.conteudo.resumo).toBeTruthy();
  expect(prepared.data.conteudo.fontes.length).toBeGreaterThan(0);
  expect(prepared.data.comprovanteExibicao.conteudoHash).toBe(hashConteudoExibido(prepared.data.conteudo));
  return { ...pedido, comprovanteExibicao: prepared.data.comprovanteExibicao };
}
async function revisarComExibicao(app: Awaited<ReturnType<typeof iniciar>>, pedido: PedidoRevisao) {
  const exibida = await exibirRevisao(app, pedido);
  return app.request("/consulta/rascunho/revisar", exibida);
}

describe("W10 entrega · extração, revisão explícita e recuperação HTTP", () => {
  it("autentica, exige revisão por fato, rejeita replay divergente/cross-patient/stale e recupera evolução após reabrir SQLite", async () => {
    const dir = mkdtempSync(join(tmpdir(), "w10-entrega-http-"));
    const file = join(dir, "ledger.sqlite");
    let db = abrirLedger(file);
    let app = await iniciar(db);
    try {
      semearPaciente(db, app.token, app.sessoes);
      // A rota de extração não revela ou processa conteúdo sem sessão válida.
      expect((await app.request("/consulta/extrair", { recordingId: "rec-88", sourceId: "src-88",
        sourceType: "imaging_report", rawTranscript: "Lesão pulmonar 38 mm" }, false)).status).toBe(401);

      expect((await app.request("/consulta/carregar", { patientId: PATIENT })).status).toBe(200);
      const sourceText = "10/09/2026 Lesão pulmonar 38 mm\nNódulo linfonodal axilar 14 mm eixo curto";
      const extracted = await app.request("/consulta/extrair", { recordingId: "gravacao-sintetica-88",
        sourceId: "laudo-sintetico-88", sourceType: "imaging_report", rawTranscript: sourceText });
      expect(extracted.status).toBe(201);
      const facts = extracted.data.facts as Array<{ id: string; domain: string; value: any }>;
      const target38 = facts.find((fact) => fact.domain === "imaging" && fact.value.measureRaw === "38")!;
      const target14 = facts.find((fact) => fact.domain === "imaging" && fact.value.measureRaw === "14")!;
      expect(target38).toBeDefined(); expect(target14).toBeDefined();
      expect(facts.some((fact) => fact.domain === "stage")).toBe(false);

      const link = await app.request("/consulta/rascunho/revisar", { draftId: extracted.data.draftId,
        expectedRevision: 0, patientId: PATIENT });
      expect(link.status).toBe(200);
      expect(link.data.fatosConfirmados).toBe(0);
      expect(listarEventos(db, PATIENT).some((event) => event.tipo === "FATO" && event.operationId === "review-operation-synthetic-88"))
        .toBe(false);
      const reviewBody = { draftId: extracted.data.draftId, expectedRevision: 1, patientId: PATIENT,
        factIds: [target38.id], operationId: "review-operation-synthetic-88" };
      const reviewed = await revisarComExibicao(app, reviewBody);
      expect(reviewed.status).toBe(200);
      expect(reviewed.data.evolucaoRascunho).toContain("38 mm");
      expect(reviewed.data.evolucaoRascunho).toContain("laudo-sintetico-88");
      expect(reviewed.data.evolucaoRascunho).toContain(target14.id);
      expect(reviewed.data.evolucaoRascunho).not.toMatch(/\b[cp]?N[0-3X]|\bM[0-1X]\b/u);
      expect(lerDraft(db, extracted.data.draftId)).toMatchObject({ patientId: PATIENT, revision: 1 });
      const clinical = listarEventos(db, PATIENT).filter((event) => event.operationId === reviewBody.operationId);
      expect(clinical).toHaveLength(1);
      expect(clinical[0]?.tipo).toBe("FATO");
      expect((clinical[0]?.payload as any).data).toMatchObject({ campo: expect.stringContaining("extracao.imaging"),
        sourceId: "laudo-sintetico-88", factId: target38.id });
      expect((clinical[0]?.fontes[0]?.contentHash)).toMatch(/^[a-f0-9]{64}$/u);
      expect((clinical[0]?.payload as any).data.dataClinica).toBe("2026-09-10");

      // A measurement without an explicit clinical date remains a reviewed candidate, not a projected fact.
      const undatedReview = await revisarComExibicao(app, { draftId: extracted.data.draftId,
        expectedRevision: 1, patientId: PATIENT, factIds: [target14.id], operationId: "review-undated-node-88" });
      expect(undatedReview.status).toBe(200);
      const undatedEvent = listarEventos(db, PATIENT).find((event) => event.operationId === "review-undated-node-88");
      expect(undatedEvent?.tipo).toBe("ReviewDecision");
      expect((undatedEvent?.payload as any).data).not.toHaveProperty("campo");

      // Re-linking to another patient, stale source revision, and changed selection cannot write a second event.
      semearPaciente(db, app.token, app.sessoes, "Paciente Teste 89");
      const exibidaNovamente = await exibirRevisao(app, reviewBody);
      const crossPatient = await app.request("/consulta/rascunho/revisar", { ...exibidaNovamente,
        expectedRevision: 1, patientId: "Paciente Teste 89" });
      expect(crossPatient.status).toBe(409);
      expect(lerDraft(db, extracted.data.draftId)).toMatchObject({ patientId: PATIENT, revision: 1 });
      expect((await app.request("/consulta/rascunho/revisar", { ...exibidaNovamente, expectedRevision: 0 })).status).toBe(409);
      const replay = await app.request("/consulta/rascunho/revisar", { ...exibidaNovamente, expectedRevision: 1 });
      expect(replay.status).toBe(200);
      expect(replay.data.codigo).toBe("REPLAY");
      expect((await app.request("/consulta/rascunho/revisar", { ...exibidaNovamente,
        expectedRevision: 1, factIds: [target14.id] })).status).toBe(409);
      expect(listarEventos(db, PATIENT).filter((event) => event.operationId === reviewBody.operationId)).toHaveLength(1);
      const summaryDraftId = reviewed.data.draftId as string;

      // Grafo local only: the route returns references explicitly marked unusable as rules/facts.
      expect((await app.request("/conhecimento/consultar", { query: "TEOC", topK: 1 }, false)).status).toBe(401);
      const knowledge = await app.request("/conhecimento/consultar", { query: "TEOC", topK: 1 });
      expect(knowledge.status).toBe(200);
      expect(knowledge.data.resultados[0]?.referencia).toMatchObject({ classificacao: "REFERENCIA",
        usavelComoRegra: false, usavelComoFicha: false });

      await app.close(); db.close();
      db = abrirLedger(file);
      app = await iniciar(db);
      expect((await app.request("/consulta/carregar", { patientId: PATIENT })).status).toBe(200);
      const loaded = await app.request("/consulta/rascunho", { draftId: summaryDraftId });
      expect(loaded.status).toBe(200);
      expect(loaded.data.draft.payload.resumo).toContain("38 mm");
      const consultation = await app.request("/consulta/carregar", { patientId: PATIENT });
      expect(consultation.data.resumoEvolucao).toContain("38 mm");
      expect(listarEventos(db, PATIENT).filter((event) => event.operationId === reviewBody.operationId)).toHaveLength(1);

      const genericConfirm = { patientId: PATIENT, tumorLotId: null, encounterId: ENCOUNTER, bloco: "EVOLUCAO",
        registros: [{ id: summaryDraftId, expectedRevision: 1 }], documentosExibidos: [], reconhecerAlertas: [],
        idempotencyKey: "generic-summary-88" };
      await app.request("/consulta/bundle", { patientId: PATIENT, encounterId: ENCOUNTER, tumorLotId: null });
      expect((await app.request("/consulta/confirmar", genericConfirm)).data.codigo).toBe("DRAFT_AINDA_RASCUNHO");
      await app.request("/consulta/bundle", { patientId: PATIENT, encounterId: "outro-encontro-88", tumorLotId: null });
      expect((await app.request("/consulta/confirmar", { ...genericConfirm, encounterId: "outro-encontro-88",
        idempotencyKey: "cross-encounter-88" })).data.codigo).toBe("DRAFT_FORA_DO_ESCOPO");
      await app.request("/consulta/bundle", { patientId: PATIENT, encounterId: ENCOUNTER, tumorLotId: "lote-outro-88" });
      expect((await app.request("/consulta/confirmar", { ...genericConfirm, tumorLotId: "lote-outro-88",
        idempotencyKey: "cross-lot-summary-88" })).data.codigo).toBe("DRAFT_FORA_DO_ESCOPO");
    } finally {
      await app.close(); db.close(); rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps simulated Plaud uncertainty and does not invent toxicity grade or RECIST from prose", async () => {
    const db = abrirLedger(":memory:");
    const app = await iniciar(db);
    try {
      const spoken = await app.request("/consulta/extrair", { recordingId: "plaud-apenas-texto-sintetico",
        sourceId: "plaud-texto-sintetico", sourceType: "plaud", rawTranscript: "Creatinina quatorze" });
      expect(spoken.status).toBe(201);
      expect(spoken.data.facts).toEqual(expect.arrayContaining([expect.objectContaining({ domain: "lab",
        evidence: "UNCERTAIN", requiresConfirmation: true })]));

      semearPaciente(db, app.token, app.sessoes);
      expect((await app.request("/consulta/carregar", { patientId: PATIENT })).status).toBe(200);
      const spokenFact = spoken.data.facts.find((fact: { domain: string }) => fact.domain === "lab");
      await app.request("/consulta/rascunho/revisar", { draftId: spoken.data.draftId,
        expectedRevision: 0, patientId: PATIENT });
      const spokenReview = await revisarComExibicao(app, { draftId: spoken.data.draftId,
        expectedRevision: 1, patientId: PATIENT, factIds: [spokenFact.id], operationId: "review-plaud-88" });
      expect(spokenReview.status).toBe(200);
      expect(spokenReview.data.evolucaoRascunho).toContain("incerteza original preservada");
      const spokenEvents = listarEventos(db, PATIENT).filter((event) => event.operationId === "review-plaud-88");
      expect(spokenEvents).toHaveLength(1);
      expect(spokenEvents[0]?.tipo).toBe("ReviewDecision");

      const returned = await app.request("/consulta/extrair", { recordingId: "retorno-sintetico-88",
        sourceId: "nota-sintetica-88", sourceType: "medical_note",
        rawTranscript: "Diarreia G3 declarada pelo médico; plaquetas 20.000 /mm3\nLesão pulmonar 38 mm, aumentou 36% desde TC de 01/09/2026" });
      expect(returned.status).toBe(201);
      expect(returned.data.facts).toEqual(expect.arrayContaining([expect.objectContaining({ domain: "lab",
        value: expect.objectContaining({ marker: "plaquetas", value: 20000, raw: "20.000 /mm3" }) })]));
      expect(returned.data.facts.some((fact: { domain: string }) => fact.domain === "toxicity")).toBe(false);
      expect(returned.data.facts.some((fact: { value: unknown }) => JSON.stringify(fact.value).includes("36%"))).toBe(false);
      const stored = lerDraft(db, returned.data.draftId);
      expect((stored?.payload as any).input.rawTranscript).toContain("Diarreia G3 declarada pelo médico");
      expect((stored?.payload as any).input.rawTranscript).toContain("aumentou 36%");
    } finally { await app.close(); db.close(); }
  });

  it("keeps lab markers separate on the same date and preserves explicit dates from one source", async () => {
    const db = abrirLedger(":memory:");
    const app = await iniciar(db);
    try {
      semearPaciente(db, app.token, app.sessoes);
      expect((await app.request("/consulta/carregar", { patientId: PATIENT })).status).toBe(200);
      const result = await app.request("/consulta/extrair", { recordingId: "labs-sinteticos-88",
        sourceId: "laudo-laboratorial-88", sourceType: "medical_note",
        rawTranscript: "01/09/2026 creatinina 1,2 mg/dL; Hb 11,2 g/dL\n01/10/2026 creatinina 1,4 mg/dL" });
      const facts = result.data.facts as Array<{ id: string; domain: string; date?: string; value: any }>;
      expect(result.status).toBe(201);
      expect(facts).toHaveLength(3);
      const link = await app.request("/consulta/rascunho/revisar", { draftId: result.data.draftId,
        expectedRevision: 0, patientId: PATIENT });
      expect(link.status).toBe(200);
      const review = await revisarComExibicao(app, { draftId: result.data.draftId,
        expectedRevision: 1, patientId: PATIENT, factIds: facts.map((fact) => fact.id),
        operationId: "review-labs-operation-88" });
      expect(review.status).toBe(200);
      const events = listarEventos(db, PATIENT).filter((event) => event.operationId === "review-labs-operation-88");
      const campos = events.map((event) => (event.payload as any).data.campo);
      expect(new Set(campos).size).toBe(2); // creatinina tem observações em dias diferentes; Hb é campo distinto.
      const creatininaDates = events.filter((event) => (event.payload as any).data.campo === "extracao.lab:CREATININA")
        .map((event) => event.fontes[0]?.dataClinica).sort();
      expect(creatininaDates).toEqual(["2026-09-01", "2026-10-01"]);
      expect(events.find((event) => (event.payload as any).data.campo === "extracao.lab:HB")?.fontes[0]?.dataClinica)
        .toBe("2026-09-01");
      expect(events.every((event) => (event.payload as any).data.observacaoDatada === true)).toBe(true);
    } finally { await app.close(); db.close(); }
  });

  it("shows conflicting confirmed diagnoses from two sources and excludes unconfirmed extraction drafts", async () => {
    const db = abrirLedger(":memory:");
    const app = await iniciar(db);
    try {
      semearPaciente(db, app.token, app.sessoes);
      await app.request("/consulta/carregar", { patientId: PATIENT });
      const first = await app.request("/consulta/extrair", { recordingId: "nota-a-88", sourceId: "nota-a-source-88",
        sourceType: "medical_note", rawTranscript: "Diagnóstico: adenocarcinoma de pulmão" });
      const factA = first.data.facts.find((fact: { domain: string }) => fact.domain === "diagnosis");
      await app.request("/consulta/rascunho/revisar", { draftId: first.data.draftId,
        expectedRevision: 0, patientId: PATIENT });
      let before = await app.request("/consulta/carregar", { patientId: PATIENT });
      expect(before.data.conflitosRevisaoExtracao).toEqual([]);
      expect(before.data.resumoEvolucao).toBeNull();
      const reviewedA = await revisarComExibicao(app, { draftId: first.data.draftId,
        expectedRevision: 1, patientId: PATIENT, factIds: [factA.id], operationId: "review-dx-a-88" });
      expect(reviewedA.status).toBe(200);

      const second = await app.request("/consulta/extrair", { recordingId: "nota-b-88", sourceId: "nota-b-source-88",
        sourceType: "medical_note", rawTranscript: "Diagnóstico: carcinoma de mama" });
      const factB = second.data.facts.find((fact: { domain: string }) => fact.domain === "diagnosis");
      await app.request("/consulta/rascunho/revisar", { draftId: second.data.draftId,
        expectedRevision: 0, patientId: PATIENT });
      const reviewedB = await revisarComExibicao(app, { draftId: second.data.draftId,
        expectedRevision: 1, patientId: PATIENT, factIds: [factB.id], operationId: "review-dx-b-88" });
      expect(reviewedB.status).toBe(200);

      const loaded = await app.request("/consulta/carregar", { patientId: PATIENT });
      expect(loaded.data.conflitosRevisaoExtracao).toHaveLength(1);
      expect(loaded.data.conflitosRevisaoExtracao[0].candidatos.map((candidate: { sourceId: string }) => candidate.sourceId))
        .toEqual(["nota-a-source-88", "nota-b-source-88"]);
      expect(loaded.data.resumoEvolucao).toContain("Divergências entre fontes");
      expect(loaded.data.resumoEvolucao).toContain("Diagnóstico: adenocarcinoma de pulmão");
      expect(loaded.data.resumoEvolucao).toContain("Diagnóstico: carcinoma de mama");
    } finally { await app.close(); db.close(); }
  });

  it("feeds only explicit reviewed TNM into the existing longitudinal stage history with source date", async () => {
    const db = abrirLedger(":memory:");
    const app = await iniciar(db);
    try {
      semearPaciente(db, app.token, app.sessoes);
      await app.request("/consulta/carregar", { patientId: PATIENT });
      const extracted = await app.request("/consulta/extrair", { recordingId: "tnm-sintetico-88",
        sourceId: "laudo-stage-88", sourceType: "medical_note", rawTranscript: "Estadiamento cT2N0M0 em 10/09/2026" });
      const stage = extracted.data.facts.find((fact: { domain: string }) => fact.domain === "stage");
      expect(stage).toMatchObject({ evidence: "EXPLICIT", requiresConfirmation: false, date: "2026-09-10" });
      await app.request("/consulta/rascunho/revisar", { draftId: extracted.data.draftId,
        expectedRevision: 0, patientId: PATIENT });
      const reviewed = await revisarComExibicao(app, { draftId: extracted.data.draftId,
        expectedRevision: 1, patientId: PATIENT, factIds: [stage.id], operationId: "review-stage-88" });
      expect(reviewed.status).toBe(200);
      const events = listarEventos(db, PATIENT);
      expect(events.find((event) => event.operationId === "review-stage-88")?.payload).toMatchObject({
        data: { campo: "TNM", domain: "stage", dataClinica: "2026-09-10" },
      });
      const snapshot = projetarSnapshot(events, PATIENT, null, ENCOUNTER, "w10-entrega-stage-v1");
      expect(snapshot.stageHistory).toEqual([expect.objectContaining({ valor: "cT2N0M0",
        data: "2026-09-10", sourceIds: ["laudo-stage-88"], revisaoOriginal: "CONFIRMADO" })]);
    } finally { await app.close(); db.close(); }
  });
});
