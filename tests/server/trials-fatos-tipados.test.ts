// Apenas pacientes, triagens e protocolos sintéticos.
import { afterEach, expect, it } from "vitest";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { lerFatosTrials } from "../../src/server/trialsFatos.js";
import { projetarRetrato } from "../../src/kernel/projections/retrato/index.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, AGORA, PACIENTE, ENCONTRO } from "../f0-fecha/fixtures/consulta-completa.js";
import { triagemBase, fonteSintetica, presente, ausente } from "../fixtures/triagem.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: "lote-sintetico-trial" };
afterEach(async () => { for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); } });
async function ambiente() {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a); cadastrarPaciente(a);
  a.sessoes.selecionarConsulta(a.token, contexto);
  let sequencia = 0;
  function registrar(tipo: string, data: Record<string, unknown>, extra: { tumorLotId?: string; fontes?: ReturnType<typeof fonteSintetica>[] } = {}) {
    const id = `tipado-sintetico-${++sequencia}`;
    salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "referencia-local",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    const ctx = { ...contexto, tumorLotId: extra.tumorLotId ?? contexto.tumorLotId };
    a.sessoes.selecionarConsulta(a.token, ctx);
    const r = executarConfirmacao(a.db, { ...ctx, operationId: id, reviewDecisionId: id,
      sessao: a.sessoes.obter(a.token)!, em: AGORA, registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo,
        payload: data, fontes: extra.fontes ?? [fonteSintetica(id)], revisao: "CONFIRMADO" }] });
    expect(r.estado).toBe("GRAVADA");
    a.sessoes.selecionarConsulta(a.token, contexto);
    return id;
  }
  const triagem = (ecog = presente(1)) => triagemBase({ patientId: PACIENTE, encounterId: ENCONTRO, ecog });
  return Object.assign(a, { registrar, triagem });
}
function ler(a: Awaited<ReturnType<typeof ambiente>>) {
  const retrato = projetarRetrato(a.eventos(), { ...contexto, agora: AGORA, regras: [],
    biblioteca: { id: "fixture-sintetica", versao: "1", hash: "fixture" } });
  return lerFatosTrials(a.db, contexto, AGORA, retrato);
}
const fato = (a: Awaited<ReturnType<typeof ambiente>>, chave = "ecog") => ler(a).fatos.find(f => f.factKey === chave);

it.each(["Triagem", "Triagem@1"])("usa ECOG de %s com origem original e sem gravação clínica", async tipo => {
  const a = await ambiente(), id = a.registrar(tipo, a.triagem()), antes = a.eventos().length;
  expect(fato(a)).toMatchObject({ value: 1, status: "CONFIRMADO", source: { sourceId: id, sourceRef: `ledger:${id}` } });
  expect(fato(a)?.status === "CONFIRMADO" && fato(a)).toBeTruthy();
  expect(a.eventos()).toHaveLength(antes);
});
it("inclui CID e histologia do lote confirmado; não inventa estadiamento escalar", async () => {
  const a = await ambiente();
  a.registrar("TumorLot", { tumorLotId: contexto.tumorLotId, patientId: PACIENTE,
    cid: presente("C50"), topografia: ausente(), histologia: presente("Histologia sintética"),
    finalidadeApac: ausente(), marcos: [], estadiamentos: [] });
  expect(fato(a, "cid")).toMatchObject({ value: "C50", status: "CONFIRMADO" });
  expect(fato(a, "histologia")).toMatchObject({ value: "Histologia sintética", status: "CONFIRMADO" });
  expect(fato(a, "estadiamento")).toBeUndefined();
});
it("mantém pendente o campo ausente ou não revisado mesmo com o evento confirmado", async () => {
  const a = await ambiente();
  a.registrar("Triagem", { ...a.triagem(), ecog: { ...presente(1), estado: "PENDENTE", revisao: "REVISAR" } });
  expect(fato(a)).toBeUndefined();
});
it("não aceita um ECOG com fonte interna futura ocultada por fonte externa anterior", async () => {
  const a = await ambiente();
  a.registrar("Triagem", { ...a.triagem(), ecog: { ...presente(1),
    fontes: [{ ...fonteSintetica(), dataClinica: "2099-01-01" }] } });
  expect(fato(a)).toBeUndefined();
});
it("não mistura o valor escalar divergente com ECOG da triagem", async () => {
  const a = await ambiente();
  a.registrar("Triagem", a.triagem());
  a.registrar("FATO", { campo: "ecog", valor: 2 });
  expect(fato(a)).toMatchObject({ status: "CONFLITO" });
});
it("valor escalar concordante e triagem produzem um único fato com ambas as fontes", async () => {
  const a = await ambiente(), id = a.registrar("Triagem", a.triagem());
  const segundo = a.registrar("FATO", { campo: "ecog", valor: 1 });
  const r = ler(a);
  expect(r.fatos.filter(f => f.factKey === "ecog")).toHaveLength(1);
  const e = fato(a); expect(e).toMatchObject({ status: "CONFIRMADO", value: 1 });
  if (e?.status === "CONFIRMADO") { expect(e.source.exactText).toContain(id); expect(e.source.exactText).toContain(segundo); }
});
it("não usa triagem de outro lote para preencher lacuna", async () => {
  const a = await ambiente();
  a.registrar("Triagem", a.triagem(), { tumorLotId: "outro-lote" });
  expect(fato(a)).toBeUndefined();
});
it("apresenta a data documentada separadamente para critérios temporais explícitos", async () => {
  const a = await ambiente(); a.registrar("Triagem", a.triagem());
  expect(fato(a, "ecog.data")).toMatchObject({ status: "CONFIRMADO", value: "2026-10-01" });
});
it("a jornada HTTP avalia valor e data da triagem usando o mesmo retrato, sem novo evento", async () => {
  const a = await ambiente(), id = a.registrar("Triagem", a.triagem());
  const r = await a.request("/consulta/trials/fatos", contexto);
  expect(r.status).toBe(200);
  expect(r.data.fatos).toContainEqual(expect.objectContaining({ factKey: "ecog", value: 1, source: expect.objectContaining({ sourceId: id }) }));
  const importado = await a.request("/consulta/trials/importar", { nome: "trial-tipado-sintetico.json",
    mimeType: "application/json", idempotencyKey: "tipado-importar", conteudo: JSON.stringify({
      title: "Estudo sintético da passagem tipada", inclusionCriteria: ["ECOG igual a 1", "Data de avaliação a partir de 01/10/2026"],
      exclusionCriteria: [], arms: [], outcomes: [] }) });
  expect(importado.status).toBe(200);
  const e = importado.data;
  const revisto = await a.request("/consulta/trials/revisar", { draftId: e.draftId, expectedRevision: e.revision,
    candidateHash: e.candidateHash, studyId: "TRIAL-TIPADO-SINTETICO", decision: "CONFIRMAR",
    titleText: e.candidate.title.text, titleEvidenceLocator: e.candidate.title.evidence[0].locator,
    bindings: e.candidate.inclusionCriteria.map((c: { criterionId: string }, i: number) => ({
      criterionId: c.criterionId, groupId: null, groupOperator: null, applicability: "APLICAVEL",
      notApplicableReason: null, expression: i === 0 ? { kind: "EQUALS", factKey: "ecog", value: 1 }
        : { kind: "DATE", factKey: "ecog.data", operator: "ON_OR_AFTER", value: "2026-10-01" },
    })), reviewedArmIds: [], idempotencyKey: "tipado-revisar" });
  expect(revisto.status).toBe(200);
  const antes = a.eventos().length;
  const avaliado = await a.request("/consulta/trials/avaliar", { contexto, draftId: e.draftId,
    expectedRevision: revisto.data.revision, expectedReviewHash: revisto.data.review.reviewHash });
  expect(avaliado.status).toBe(200);
  expect(avaliado.data).toMatchObject({ elegivel: false, revisaoFatos: r.data.revisaoFatos, resultado: { status: "POSSIBLE_MATCH" } });
  expect(avaliado.data.resultado.criteria).toHaveLength(2);
  expect(a.eventos()).toHaveLength(antes);
});
