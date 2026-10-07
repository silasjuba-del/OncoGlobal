import { expect, it } from "vitest";
import { ambienteHttp } from "../server/http-fixture.js";
import { lerDraft, listarDrafts, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";

const AGORA = "2026-10-07T12:00:00-03:00";
let seq = 0;

async function post(f: Awaited<ReturnType<typeof ambienteHttp>>, path: string, body: unknown) {
  const response = await f.request(path, "POST", JSON.stringify(body), f.token, "application/json");
  return { status: response.status, data: JSON.parse(response.body) as Record<string, any> };
}

function semearPaciente(f: Awaited<ReturnType<typeof ambienteHttp>>, patientId: string, encounterId: string) {
  const id = ++seq;
  const draftId = `identidade-paciente-draft-${id}`;
  const operationId = `identidade-paciente-op-${id}`;
  salvarDraft(f.db, { draftId, patientId, sourceId: `identidade-source-${id}`, rawRef: "fixture-local",
    payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  const result = confirmar(f.db, { operationId, patientId, tumorLotId: null, encounterId,
    reviewDecisionId: `identidade-review-${id}`, sessao: f.sessoes.obter(f.token)!, em: AGORA,
    registros: [{ draftId, expectedRevision: 0, eventId: `identidade-event-${id}`, tipo: "Paciente",
      payload: { patientId, identificadores: [], nome: patientId, nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false }, fontes: [], revisao: "CONFIRMADO" }] });
  expect(result.estado).toBe("GRAVADA");
}

function salvarRascunho(f: Awaited<ReturnType<typeof ambienteHttp>>, input: {
  draftId: string; patientId: string | null; payload: unknown; revision?: number;
}) {
  salvarDraft(f.db, { draftId: input.draftId, patientId: input.patientId, sourceId: `source-${input.draftId}`,
    rawRef: "rascunho-sintetico-local", payload: input.payload, diagnostics: [], revision: input.revision ?? 0,
    criadoEm: AGORA });
}

it("vincula apenas EXTRAÇÃO_RASCUNHO não vinculada a paciente existente e conserva drafts recusados", async () => {
  const f = await ambienteHttp();
  try {
    const pacienteA = "Paciente Teste 71", pacienteB = "Paciente Teste 72";
    semearPaciente(f, pacienteA, "encontro-71"); semearPaciente(f, pacienteB, "encontro-72");
    salvarRascunho(f, { draftId: "prescricao-a-71", patientId: pacienteA,
      payload: { kind: "PRESCRICAO_RASCUNHO", contexto: { patientId: pacienteA, encounterId: "encontro-71", tumorLotId: null },
        status: "RASCUNHO", assinada: false } });
    const antes = lerDraft(f.db, "prescricao-a-71");
    const eventosAntes = listarEventos(f.db, pacienteA).length;
    const transferencia = await post(f, "/consulta/rascunho/revisar", {
      draftId: "prescricao-a-71", expectedRevision: 0, patientId: pacienteB,
    });
    expect(transferencia.status).toBe(409);
    expect(lerDraft(f.db, "prescricao-a-71")).toEqual(antes);
    expect(listarEventos(f.db, pacienteA)).toHaveLength(eventosAntes);
    expect(listarEventos(f.db, pacienteB)).toHaveLength(1);

    salvarRascunho(f, { draftId: "extracao-sem-vinculo-71", patientId: null,
      payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceType: "medical_note" }, state: {} } });
    const vinculo = await post(f, "/consulta/rascunho/revisar", {
      draftId: "extracao-sem-vinculo-71", expectedRevision: 0, patientId: pacienteB,
    });
    expect(vinculo.status).toBe(200);
    expect(lerDraft(f.db, "extracao-sem-vinculo-71")).toMatchObject({ patientId: pacienteB, revision: 1 });
    expect((vinculo.data as { criaEventoClinico: boolean }).criaEventoClinico).toBe(false);

    salvarRascunho(f, { draftId: "extracao-sem-vinculo-72", patientId: null,
      payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceType: "medical_note" }, state: {} } });
    const destinoAusente = await post(f, "/consulta/rascunho/revisar", {
      draftId: "extracao-sem-vinculo-72", expectedRevision: 0, patientId: "Paciente Teste 79",
    });
    expect(destinoAusente.status).toBe(404);
    expect(lerDraft(f.db, "extracao-sem-vinculo-72")).toMatchObject({ patientId: null, revision: 0 });
  } finally { await f.close(); }
});

it("não confirma em lote um rascunho clínico não exibido e mantém o documento isolado funcional", async () => {
  const f = await ambienteHttp();
  try {
    const patientId = "Paciente Teste 73", encounterId = "encontro-73";
    semearPaciente(f, patientId, encounterId);
    salvarRascunho(f, { draftId: "documento-73", patientId,
      payload: { documentId: "documento-73", documentVersion: 1, documentHash: "a".repeat(64), encounterId, tumorLotId: null } });
    salvarRascunho(f, { draftId: "extracao-73", patientId,
      payload: { kind: "EXTRACAO_RASCUNHO", contexto: { patientId, encounterId, tumorLotId: null } } });

    const exibicao = await post(f, "/consulta/bundle", { patientId, encounterId, tumorLotId: null });
    expect(exibicao.status).toBe(200);
    expect(exibicao.data.documentos).toMatchObject([{ documentId: "documento-73", documentVersion: 1 }]);
    const antes = lerDraft(f.db, "extracao-73");
    const eventosAntes = listarEventos(f.db, patientId).length;
    const loteMisto = await post(f, "/consulta/confirmar", { patientId, tumorLotId: null, encounterId,
      bloco: "TUDO", registros: [{ id: "documento-73", expectedRevision: 0 }, { id: "extracao-73", expectedRevision: 0 }],
      documentosExibidos: [{ documentId: "documento-73", documentVersion: 1 }], reconhecerAlertas: [],
      idempotencyKey: "confirmar-identidade-misto-73" });
    expect(loteMisto.status).toBe(409);
    expect(listarEventos(f.db, patientId)).toHaveLength(eventosAntes);
    expect(lerDraft(f.db, "extracao-73")).toEqual(antes);

    const documentoIsolado = await post(f, "/consulta/confirmar", { patientId, tumorLotId: null, encounterId,
      bloco: "TUDO", registros: [{ id: "documento-73", expectedRevision: 0 }],
      documentosExibidos: [{ documentId: "documento-73", documentVersion: 1 }], reconhecerAlertas: [],
      idempotencyKey: "confirmar-identidade-documento-73" });
    expect(documentoIsolado.status).toBe(200);
    expect(listarEventos(f.db, patientId)).toHaveLength(eventosAntes + 1);
    expect(listarEventos(f.db, patientId).some((event) => event.tipo === "DOCUMENTO" && event.revisao === "ASSINADO")).toBe(true);
  } finally { await f.close(); }
});

it("preserva contexto paciente/encontro na prescrição e limpa seleção inválida", async () => {
  const f = await ambienteHttp();
  try {
    const pacienteA = "Paciente Teste 74", pacienteB = "Paciente Teste 75";
    semearPaciente(f, pacienteA, "encontro-74"); semearPaciente(f, pacienteB, "encontro-75");
    expect((await post(f, "/consulta/carregar", { patientId: pacienteA })).status).toBe(200);
    expect((await post(f, "/consulta/carregar", { patientId: pacienteB })).status).toBe(200);

    const corpoA = { patientId: pacienteA, encounterId: "encontro-74", tumorLotId: null, expression: "Medicamento Teste 10 mg" };
    const contagensAntes = listarDrafts(f.db, pacienteA).length + listarDrafts(f.db, pacienteB).length;
    expect((await post(f, "/consulta/prescricao/rascunho", corpoA)).status).toBe(409);
    expect(listarDrafts(f.db, pacienteA).length + listarDrafts(f.db, pacienteB).length).toBe(contagensAntes);

    const corpoB = { ...corpoA, patientId: pacienteB, encounterId: "encontro-75" };
    const salvaB = await post(f, "/consulta/prescricao/rascunho", corpoB);
    expect(salvaB.status).toBe(201);
    expect(salvaB.data.seguranca).toMatchObject({ resultado: "NOT_EVALUABLE" });
    const draftId = salvaB.data.draftId as string;
    expect(lerDraft(f.db, draftId)).toMatchObject({ patientId: pacienteB,
      payload: { kind: "PRESCRICAO_RASCUNHO", status: "RASCUNHO", assinada: false } });

    expect((await post(f, "/consulta/carregar", { patientId: "Paciente Teste 79" })).status).toBe(404);
    const depoisDaFalha = listarDrafts(f.db, pacienteB).length;
    expect((await post(f, "/consulta/prescricao/rascunho", corpoB)).status).toBe(409);
    expect(listarDrafts(f.db, pacienteB)).toHaveLength(depoisDaFalha);
    expect((await post(f, "/consulta/carregar", { patientId: pacienteB })).status).toBe(200);
    expect((await post(f, "/consulta/prescricao/rascunho", corpoB)).status).toBe(201);
  } finally { await f.close(); }
});
