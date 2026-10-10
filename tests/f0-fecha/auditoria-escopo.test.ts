import { afterEach, expect, it } from "vitest";
import { salvarDraft, listarDrafts } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { hashConteudoExibido } from "../../src/server/sessao.js";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
  AGORA, PACIENTE, ENCONTRO, OUTRO_PACIENTE } from "./fixtures/consulta-completa.js";

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => { if (ambiente) { await ambiente.close(); removerDiretorio(ambiente.dir); ambiente = undefined; } });
async function abrir() {
  ambiente = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(ambiente); await carregarConsulta(ambiente);
  return ambiente;
}
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
const plano = { acoesMarcadas: [], receitasMarcadas: [],
  apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [], emitir: false },
  retorno: { dias: 30, examesAntesDoRetorno: [] } };

it("M1 recusa lote de outro paciente ou inexistente e invalida o contexto rejeitado", async () => {
  const a = await abrir(); cadastrarPaciente(a, "93");
  const ausente = { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não consta", fontes: [], revisao: "RAW" };
  salvarDraft(a.db, { draftId: "lote-fixture-auditoria", patientId: OUTRO_PACIENTE, sourceId: "fixture-sintetica",
    rawRef: "fixture-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  expect(confirmar(a.db, { operationId: "lote-fixture-auditoria", patientId: OUTRO_PACIENTE,
    encounterId: "encontro-teste-93", tumorLotId: "lote-paciente-93", reviewDecisionId: "review-lote-93",
    sessao: a.sessoes.obter(a.token)!, em: AGORA, registros: [{ draftId: "lote-fixture-auditoria",
      expectedRevision: 0, eventId: "evento-lote-93", tipo: "TumorLot", fontes: [], revisao: "CONFIRMADO",
      payload: { patientId: OUTRO_PACIENTE, tumorLotId: "lote-paciente-93", cid: ausente, topografia: ausente,
        histologia: ausente, finalidadeApac: ausente, estadiamentos: [], marcos: [] } }] }).estado).toBe("GRAVADA");
  for (const tumorLotId of ["lote-paciente-93", "lote-inexistente"]) {
    const pedido = { ...contexto, tumorLotId };
    expect(await a.request("/consulta/contexto/selecionar", pedido))
      .toMatchObject({ status: 409, data: { codigo: "TUMOR_LOT_FORA_DO_PACIENTE" } });
    expect(a.sessoes.consultaSelecionada(a.token)).toBeNull();
    // Defesa independente: sessão antiga/forjada por teste não autoriza preparar ou salvar a Flash.
    a.sessoes.selecionarConsulta(a.token, pedido);
    expect(await a.request("/consulta/flash/preparar", { ...pedido, plano, idempotencyKey: "auditoria-m1-key" }))
      .toMatchObject({ status: 409, data: { codigo: "TUMOR_LOT_FORA_DO_PACIENTE" } });
    expect(await a.request("/consulta/flash/rascunho", { ...pedido, plano, expectedRevision: null }))
      .toMatchObject({ status: 409, data: { codigo: "TUMOR_LOT_FORA_DO_PACIENTE" } });
  }
  expect(listarDrafts(a.db, PACIENTE).some((d) => d.sourceId === "consulta-flash")).toBe(false);
  expect(await a.request("/consulta/contexto/selecionar", contexto)).toMatchObject({ status: 200 });
});

it("M2 exige contexto de origem tanto na exibição quanto na confirmação de fatos e documentos", async () => {
  const a = await abrir();
  for (const tipo of ["fato", "documento"] as const) {
    const draftId = `draft-sem-contexto-${tipo}`;
    const payload = tipo === "documento" ? { documentId: draftId, documentVersion: 1,
      documentHash: "hash-declarado-sintetico", texto: "Documento sintético sem origem de encontro" }
      : { campo: "campo-sintetico", valor: "valor-sintetico" };
    salvarDraft(a.db, { draftId, patientId: PACIENTE, sourceId: "fixture-sintetica", rawRef: "fixture-sintetica",
      payload, diagnostics: [], revision: 0, criadoEm: AGORA });
    expect(await a.request("/consulta/bundle", { ...contexto, draftIds: [draftId] }))
      .toMatchObject({ status: 409, data: { codigo: "DRAFT_CONTEXTO_AUSENTE" } });
    a.sessoes.registrarBundleExibido(a.token, contexto, [{ draftId, documentId: draftId,
      documentVersion: 1, conteudoHash: hashConteudoExibido(payload) }]);
    expect(await a.request("/consulta/confirmar", { ...contexto, bloco: "TUDO",
      registros: [{ id: draftId, expectedRevision: 0 }], documentosExibidos: [{ documentId: draftId, documentVersion: 1 }],
      reconhecerAlertas: [], idempotencyKey: `auditoria-m2-${tipo}` }))
      .toMatchObject({ status: 409, data: { codigo: "DRAFT_FORA_DO_ESCOPO" } });
  }
  expect(a.eventos().filter((e) => e.tipo === "FATO" || e.tipo === "DOCUMENTO")).toEqual([]);
});
