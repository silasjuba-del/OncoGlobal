// Dados sintéticos: teste do fluxo local, sem protocolo ou paciente reais.
import { afterEach, expect, it } from "vitest";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
afterEach(async () => {
  for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); }
});
async function abrir() {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a); cadastrarPaciente(a);
  a.sessoes.selecionarConsulta(a.token, contexto);
  let n = 0;
  const fato = (valor: unknown, patientId = PACIENTE, revisao: "CONFIRMADO" | "ASSINADO" = "CONFIRMADO") => {
    const id = `trial-fato-${++n}`;
    salvarDraft(a.db, { draftId: id, patientId, sourceId: id, rawRef: "referencia-local",
      payload: {}, revision: 0, diagnostics: [], criadoEm: AGORA });
    executarConfirmacao(a.db, { ...contexto, patientId, operationId: id, reviewDecisionId: id,
      sessao: a.sessoes.obter(a.token)!, em: AGORA, registros: [{ draftId: id, expectedRevision: 0,
        eventId: id, tipo: "FATO", payload: { campo: "ecog", valor }, fontes: [fonteSintetica(id)], revisao }] });
  };
  return Object.assign(a, { fato });
}
const fonte = { nome: "estudo-sintetico.json", mimeType: "application/json",
  conteudo: JSON.stringify({ title: "Estudo inteiramente sintético", inclusionCriteria: ["ECOG igual a 1"],
    exclusionCriteria: [], arms: [], outcomes: ["Desfecho sintético para documentação"] }),
  idempotencyKey: "importar-estudo-sintetico" };
async function importar(a: Awaited<ReturnType<typeof abrir>>) {
  const r = await a.request("/consulta/trials/importar", fonte);
  expect(r.status).toBe(200);
  return r.data;
}
function revisao(estudo: Record<string, any>) {
  return { draftId: estudo.draftId, expectedRevision: estudo.revision, candidateHash: estudo.candidateHash,
    studyId: "ESTUDO-SINTETICO-001", decision: "CONFIRMAR",
    titleText: estudo.candidate.title.text, titleEvidenceLocator: estudo.candidate.title.evidence[0].locator,
    bindings: estudo.candidate.inclusionCriteria.map((c: { criterionId: string }) => ({
      criterionId: c.criterionId, groupId: null, groupOperator: null,
      expression: { kind: "EQUALS", factKey: "ecog", value: 1 },
      applicability: "APLICAVEL", notApplicableReason: null,
    })), reviewedArmIds: [], idempotencyKey: "revisar-estudo-sintetico" };
}
async function revisar(a: Awaited<ReturnType<typeof abrir>>, estudo: Record<string, any>) {
  const r = await a.request("/consulta/trials/revisar", revisao(estudo));
  expect(r.status).toBe(200);
  return r.data;
}
const avaliar = (a: Awaited<ReturnType<typeof abrir>>, estudo: Record<string, any>, extra = {}) =>
  a.request("/consulta/trials/avaliar", { contexto, draftId: estudo.draftId,
    expectedRevision: estudo.revision, expectedReviewHash: estudo.review?.reviewHash ?? "0".repeat(64), ...extra });

it("ingere fonte exata e repete sem criar estudo duplicado nem fato clínico", async () => {
  const a = await abrir(), antes = a.eventos().length;
  const estudo = await importar(a);
  expect(estudo.source.originalContent).toBe(fonte.conteudo);
  expect(estudo.source.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(estudo.review).toBeNull();
  expect((await a.request("/consulta/trials/importar", fonte)).data).toEqual(estudo);
  expect((await a.request("/consulta/trials/listar", {})).data.estudos).toHaveLength(1);
  expect(a.eventos()).toHaveLength(antes);
  const outro = await a.request("/consulta/trials/importar", { ...fonte, conteudo: fonte.conteudo + " " });
  expect(outro.status).toBe(409);
});

it("exige revisão completa e compara fatos do ledger sem declarar elegibilidade", async () => {
  const a = await abrir(); a.fato(1);
  const estudo = await importar(a);
  expect((await avaliar(a, estudo)).status).toBe(409);
  expect((await a.request("/consulta/trials/revisar", { ...revisao(estudo), bindings: [] })).status).toBe(409);
  const revisto = await revisar(a, estudo), antes = a.eventos().length;
  const r = await avaliar(a, revisto);
  expect(r.status).toBe(200);
  expect(r.data.resultado.status).toBe("POSSIBLE_MATCH");
  expect(r.data.elegivel).toBe(false);
  expect(r.data.resultado.criteria[0].status).toBe("ATENDIDO");
  expect(r.data.fatos[0].source.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(a.eventos()).toHaveLength(antes);
  expect((await a.request("/consulta/trials/revisar", revisao(estudo))).data.review.reviewHash).toBe(revisto.review.reviewHash);
});

it("falta e conflito permanecem pendentes; outro paciente não preenche critério", async () => {
  const a = await abrir(); a.fato(1, "outro-paciente-sintetico");
  const estudo = await revisar(a, await importar(a));
  expect((await avaliar(a, estudo)).data.resultado.status).toBe("PENDENTE");
  a.fato(1); a.fato(2);
  const conflito = await avaliar(a, estudo);
  expect(conflito.data.resultado.status).toBe("PENDENTE");
  expect(conflito.data.fatos[0].status).toBe("CONFLITO");
});

it("nega contexto, hash, revisão, ator e fatos fornecidos pelo cliente", async () => {
  const a = await abrir(); a.fato(1);
  const estudo = await importar(a);
  expect((await a.request("/consulta/trials/importar", fonte, "")).status).toBe(401);
  expect((await a.request("/consulta/trials/revisar", { ...revisao(estudo), reviewerId: "forjado" })).status).toBe(400);
  expect((await a.request("/consulta/trials/revisar", { ...revisao(estudo), candidateHash: "0".repeat(64) })).status).toBe(409);
  const revisto = await revisar(a, estudo);
  expect((await avaliar(a, revisto, { expectedRevision: 0 })).status).toBe(409);
  expect((await avaliar(a, revisto, { expectedReviewHash: "0".repeat(64) })).status).toBe(409);
  expect((await avaliar(a, revisto, { contexto: { ...contexto, patientId: "outro" } })).status).toBe(409);
  expect((await avaliar(a, revisto, { fatos: [{ factKey: "ecog", value: 1 }] })).status).toBe(400);
});
