import { afterEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { executarPipelineExtracao } from "../../../src/kernel/extracao/pipeline.js";
import { prepararRevisaoExtracao } from "../../../src/kernel/extracao/prepararRevisao.js";
import { lerDraft, salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, carregarConsulta,
  PACIENTE, ENCONTRO, AGORA } from "../../f0-fecha/fixtures/consulta-completa.js";
import type { PedidoRevisaoExtracao, RevisaoPreparada } from "../../../src/contracts/api/revisaoExtracao.js";

let app: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => { if (app) { await app.close(); removerDiretorio(app.dir); app = undefined; } });
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
const literal = "Narrativa sintética integral: incômodo abdominal referido; conduta ainda em discussão.\nNão há decisão de quimioterapia neste trecho.";
const outroTexto = "TEXTO EXCLUSIVO DO OUTRO PACIENTE SINTÉTICO.";
const plano = { acoesMarcadas: [], receitasMarcadas: [], apac: { cid: "", sigtap: "", finalidade: "", competencia: "",
  estado: "PENDENTE", pendencias: [], emitir: false }, retorno: { dias: 21, examesAntesDoRetorno: [] } };

async function ambiente() {
  app = await abrirAmbiente(criarDiretorio());
  cadastrarPaciente(app); cadastrarPaciente(app, "93"); await carregarConsulta(app);
  return app;
}

async function fonte(a: Awaited<ReturnType<typeof ambiente>>, id = "literal", texto = literal, multipaciente = false, comFato = false) {
  const sourceId = `fonte-${id}`, draftId = `extracao-${id}`, segmentId = `segmento-${id}`;
  const input = { sourceId, recordingId: `gravacao-${id}`, sourceType: "medical_note" as const,
    rawTranscript: multipaciente ? `${texto}\n\n${outroTexto}` : texto };
  const estado = executarPipelineExtracao(input);
  const segmento = { id: segmentId, sourceId, recordingId: input.recordingId, sourceType: input.sourceType,
    startMs: null, endMs: null, speakers: [], candidateNames: [], rawTranscript: texto,
    boundaryConfidence: 1, boundaryReviewRequired: false, patientId: null, page: 2 };
  const segmentos = [segmento, ...(multipaciente ? [{ ...segmento, id: `outro-${segmentId}`, rawTranscript: outroTexto }] : [])];
  const excecoes = segmentos.map((s) => ({ id: `vinculo-${s.id}`, kind: "UNLINKED_PATIENT", segmentId: s.id,
    factIds: [], reason: "Vínculo exige decisão médica sintética.", sourceIds: [sourceId] }));
  const facts = comFato ? [{ id: `fato-${id}`, segmentId, sourceId, sourceType: input.sourceType, patientCandidateId: null,
    domain: "symptom", value: "incômodo abdominal referido", rawEvidence: texto, evidence: "EXPLICIT", confidence: 1, requiresConfirmation: false }] : [];
  salvarDraft(a.db, { draftId, patientId: null, sourceId, rawRef: "fixture-local-sintetica", revision: 0, criadoEm: AGORA,
    diagnostics: [], payload: { kind: "EXTRACAO_RASCUNHO", input,
      state: { ...estado, segments: segmentos, facts, confirmationRequired: excecoes } } });
  expect((await a.request('/consulta/rascunho',{draftId})).status).toBe(200);
  const vinculo = await a.request("/consulta/rascunho/revisar", { ...contexto, draftId, sourceId, expectedRevision: 0,
    exceptionId: excecoes[0]!.id, acao: "LIGAR_PACIENTE", idempotencyKey: `link-literal-${id}` });
  expect(vinculo.status).toBe(200);
  const pedido: PedidoRevisaoExtracao = { draftId, expectedRevision: vinculo.data.revision, patientId: PACIENTE,
    factIds: facts.map((f) => f.id), incluirTextoOriginal: true, operationId: `revisar-literal-${id}` };
  const preparar = () => a.request<RevisaoPreparada>("/consulta/rascunho/preparar-revisao", pedido);
  return { draftId, sourceId, segmentId, pedido, preparar };
}

async function revisar(a: Awaited<ReturnType<typeof ambiente>>, f: Awaited<ReturnType<typeof fonte>>) {
  const p = await f.preparar(); expect(p.status).toBe(200);
  const confirmar = { ...f.pedido, comprovanteExibicao: p.data.comprovanteExibicao };
  expect((await a.request("/consulta/rascunho/revisar", confirmar)).data.codigo).toBe("GRAVADA");
  return { preview: p.data, confirmar };
}

async function prepararFlash(a: Awaited<ReturnType<typeof ambiente>>, key: string) {
  const p = await a.request("/consulta/flash/preparar", { ...contexto, plano, idempotencyKey: key });
  expect(p.status).toBe(200);
  const bundle = await a.request("/consulta/bundle", { ...contexto, draftIds: p.data.registros.map((r: { id: string }) => r.id) });
  expect(bundle.status).toBe(200);
  const assinatura = { ...contexto, bloco: "TUDO", registros: p.data.registros,
    documentosExibidos: p.data.documentos.map((d: { documentId: string; documentVersion: number }) => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
    reconhecerAlertas: [], idempotencyKey: `${key}-assinar` };
  return { p: p.data, bundle: bundle.data, assinatura };
}

it("texto-only exige escolha e prova; receipt válido leva todo texto à evolução assinada sem criar FATO", async () => {
  const a = await ambiente(), f = await fonte(a);
  expect((await a.request("/consulta/rascunho/preparar-revisao", { ...f.pedido, incluirTextoOriginal: false })).status).toBe(400);
  expect((await a.request("/consulta/rascunho/preparar-revisao", { ...f.pedido, incluirTextoOriginal: undefined })).status).toBe(400);
  expect((await a.request("/consulta/rascunho/preparar-revisao", { ...f.pedido, rawTranscript: "TEXTO DO CLIENTE" })).status).toBe(400);
  expect((await a.request("/consulta/rascunho/revisar", f.pedido)).data.codigo).toBe("BUNDLE_NAO_EXIBIDO");
  const p = await f.preparar(); expect(p.status).toBe(200);
  expect(p.data.conteudo.resumo).toContain(literal);
  expect(p.data.conteudo).toMatchObject({ incluirTextoOriginal: true, facts: [], selectedFactIds: [], fontes: [
    { sourceId: f.sourceId, localizador: `segmento:${f.segmentId};pagina:2`, dataClinica: null,
      contentHash: createHash("sha256").update(literal).digest("hex") } ] });
  expect((await carregarConsulta(a)).data.resumoConfirmadoParaDocumento).toBeNull();
  const confirmado = { ...f.pedido, comprovanteExibicao: p.data.comprovanteExibicao };
  expect((await a.request("/consulta/rascunho/revisar", confirmado)).data.codigo).toBe("GRAVADA");
  const eventos = a.eventos().filter((e) => e.operationId === f.pedido.operationId);
  expect(eventos).toHaveLength(1); expect(eventos[0]?.tipo).toBe("ReviewDecision");
  expect(eventos[0]?.payload).toMatchObject({ data: { kind: "ExtracaoResumoRevisado", draftRevision: 1 } });
  expect(JSON.stringify(eventos[0]?.payload)).not.toContain('"campo"');
  expect(a.eventos().filter((e) => e.tipo === "FATO")).toHaveLength(0);
  expect((await a.request("/consulta/rascunho/revisar", confirmado)).data.codigo).toBe("REPLAY");
  expect(a.eventos().filter((e) => e.operationId === f.pedido.operationId)).toEqual(eventos);
  expect((await carregarConsulta(a)).data.resumoConfirmadoParaDocumento).toContain(literal);
  const flash = await prepararFlash(a, "texto-flash-primeira");
  const evolucao = flash.bundle.documentos.find((d: { conteudo: { tipoDocumento: string } }) => d.conteudo.tipoDocumento === "FLASH_EVOLUCAO");
  expect(evolucao?.conteudo.texto).toContain(literal);
  expect((await a.request("/consulta/confirmar", flash.assinatura)).data.codigo).toBe("GRAVADA");
  expect(await a.request("/consulta/flash/preparar", { ...contexto, plano, idempotencyKey: "texto-flash-duplicata" }))
    .toMatchObject({ status: 409, data: { codigo: "FLASH_JA_FINALIZADA" } });
  const assinados = a.eventos().filter((e) => e.tipo === "DOCUMENTO");
  expect(JSON.stringify(assinados)).toContain("Narrativa sintética integral");
  expect(a.eventos().filter((e) => ["FATO", "Prescricao", "Ciclo"].includes(e.tipo))).toHaveLength(0);
});

it("multipaciente incorpora somente o segmento explicitamente vinculado e sua fonte", async () => {
  const a = await ambiente(), f = await fonte(a, "multi", literal, true);
  const { preview } = await revisar(a, f);
  expect(preview.conteudo.resumo).toContain(literal);
  expect(JSON.stringify(preview)).not.toContain(outroTexto);
  const flash = await prepararFlash(a, "multi-flash");
  expect(JSON.stringify(flash.bundle)).toContain("Narrativa sintética integral");
  expect(JSON.stringify(flash.bundle)).not.toContain(outroTexto);
  expect(a.eventos().filter((e) => e.tipo === "FATO")).toHaveLength(0);
});

it.each(["hash", "selecao", "origem", "contexto"] as const)("nega %s alterado após preview sem receipt nem FATO", async (alteracao) => {
  const a = await ambiente(), f = await fonte(a);
  const p = await f.preparar(); expect(p.status).toBe(200);
  let pedido = { ...f.pedido, comprovanteExibicao: p.data.comprovanteExibicao };
  if (alteracao === "hash") pedido.comprovanteExibicao = { ...pedido.comprovanteExibicao, conteudoHash: "b".repeat(64) };
  if (alteracao === "selecao") pedido = { ...pedido, incluirTextoOriginal: false };
  if (alteracao === "origem") {
    const draft = lerDraft(a.db, f.draftId)!;
    const payload = structuredClone(draft.payload) as { state: { segments: Array<{ rawTranscript: string }> } };
    payload.state.segments[0]!.rawTranscript = "Texto alterado após a exibição.";
    a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), f.draftId);
  }
  if (alteracao === "contexto") await a.request("/consulta/carregar", { patientId: "Paciente Teste 93", encounterId: "encontro-teste-93" });
  const r = await a.request("/consulta/rascunho/revisar", pedido);
  expect(r.status).toBe(alteracao === "selecao" ? 400 : 409);
  expect(a.eventos().filter((e) => e.operationId === f.pedido.operationId)).toHaveLength(0);
  expect(a.eventos().filter((e) => e.tipo === "FATO")).toHaveLength(0);
});

it("resumo adulterado perde recibo válido e não entra na evolução Flash", async () => {
  const a = await ambiente(), f = await fonte(a);
  const { preview } = await revisar(a, f);
  const id = preview.comprovanteExibicao.documentId, draft = lerDraft(a.db, id)!;
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify({ ...(draft.payload as object), resumo: "NARRATIVA ADULTERADA" }), id);
  expect((await carregarConsulta(a)).data.resumoConfirmadoParaDocumento).toBeNull();
  const flash = await prepararFlash(a, "tamper-flash");
  expect(JSON.stringify(flash.bundle)).not.toContain("NARRATIVA ADULTERADA");
});

it("mudar inclusão mantendo fato e operationId não reaproveita preview ou comprovante", async () => {
  const a = await ambiente(), f = await fonte(a, "selecao", literal, false, true);
  const antiga = await a.request<RevisaoPreparada>("/consulta/rascunho/preparar-revisao", { ...f.pedido, incluirTextoOriginal: false });
  expect(antiga.status).toBe(200);
  expect(await f.preparar()).toMatchObject({ status: 409, data: { codigo: "CHAVE_IDEMPOTENCIA_REUTILIZADA" } });
  expect(await a.request("/consulta/rascunho/revisar", { ...f.pedido, comprovanteExibicao: antiga.data.comprovanteExibicao }))
    .toMatchObject({ status: 409, data: { codigo: "CHAVE_IDEMPOTENCIA_REUTILIZADA" } });
  const nova = await a.request<RevisaoPreparada>("/consulta/rascunho/preparar-revisao", { ...f.pedido, operationId: "nova-selecao-literal" });
  expect(nova.status).toBe(200);
  expect(nova.data.comprovanteExibicao.conteudoHash).not.toBe(antiga.data.comprovanteExibicao.conteudoHash);
  expect(a.eventos().filter((e) => e.tipo === "FATO")).toHaveLength(0);
});

it("novo receipt de texto invalida assinatura anterior mesmo sem novo fato e conserva assinatura histórica", async () => {
  const a = await ambiente(), f = await fonte(a);
  const antiga = await prepararFlash(a, "flash-antes-do-texto");
  const retratoAntes = (await carregarConsulta(a)).data.retrato.revisao;
  await revisar(a, f);
  expect((await carregarConsulta(a)).data.retrato.revisao).toBe(retratoAntes);
  // Reexibir o mesmo conteúdo antigo não o torna atual.
  await a.request("/consulta/bundle", { ...contexto, draftIds: antiga.p.registros.map((r: { id: string }) => r.id) });
  expect(await a.request("/consulta/confirmar", antiga.assinatura)).toMatchObject({ status: 409, data: { codigo: "REVISAO_FATOS_ALTERADA" } });
  const atual = await prepararFlash(a, "flash-depois-do-texto");
  expect(JSON.stringify(atual.bundle)).toContain("Narrativa sintética integral");
  expect((await a.request("/consulta/confirmar", atual.assinatura)).data.codigo).toBe("GRAVADA");
  const historicoAntes = a.eventos().filter((e) => e.tipo === "DOCUMENTO");
  const outra = await fonte(a, "nova-narrativa", "NOVA NARRATIVA REVISTA POSTERIORMENTE.");
  await revisar(a, outra);
  const proxima = await prepararFlash(a, "flash-com-nova-narrativa");
  expect(JSON.stringify(proxima.bundle)).toContain("NOVA NARRATIVA REVISTA POSTERIORMENTE");
  expect(a.eventos().filter((e) => e.tipo === "DOCUMENTO")).toEqual(historicoAntes);
  const leitura = await carregarConsulta(a);
  expect(JSON.stringify(leitura.data.historicoDocumentos)).not.toContain("NOVA NARRATIVA REVISTA POSTERIORMENTE");
});

it("fechamento legado com narrativa e localizador null continua protegido contra duplicação", async () => {
  const a = await ambiente(), f = await fonte(a);
  await revisar(a, f);
  expect((await carregarConsulta(a)).data.resumoConfirmadoParaDocumento).toContain(literal);
  const antigo = await prepararFlash(a, "fechamento-legado");
  for (const registro of antigo.p.registros as Array<{ id: string }>) {
    const draft = lerDraft(a.db, registro.id)!;
    const payload = structuredClone(draft.payload) as { fontes: Array<{ localizador: string | null }> };
    for (const fonte of payload.fontes) fonte.localizador = null;
    a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), registro.id);
  }
  await a.request("/consulta/bundle", { ...contexto, draftIds: antigo.p.registros.map((r: { id: string }) => r.id) });
  expect((await a.request("/consulta/confirmar", antigo.assinatura)).data.codigo).toBe("GRAVADA");
  const assinados = a.eventos().filter((e) => e.tipo === "DOCUMENTO");
  expect(await a.request("/consulta/flash/preparar", { ...contexto, plano, idempotencyKey: "nova-chave-mesmo-legado" }))
    .toMatchObject({ status: 409, data: { codigo: "FLASH_JA_FINALIZADA" } });
  expect(a.eventos().filter((e) => e.tipo === "DOCUMENTO")).toEqual(assinados);
});

const entradaKernel = { draftId: "d", sourceId: "s", rawTranscript: literal, sourceType: "medical_note", facts: [], exceptions: [],
  patientId: "p", encounterId: "e", tumorLotId: null, factIds: [], operationId: "operacao-texto", medicoId: "m", em: AGORA,
  segmentoVinculado: { id: "seg" }, incluirTextoOriginal: true };
it("limites rejeitam texto vazio/excessivo/segmento ausente; limite permitido é integral", () => {
  for (const rawTranscript of ["", " \n\t", "x".repeat(200_001)])
    expect(() => prepararRevisaoExtracao({ ...entradaKernel, rawTranscript })).toThrow("TEXTO_ORIGINAL_INVALIDO");
  const { segmentoVinculado: _segmento, ...semSegmento } = entradaKernel;
  expect(() => prepararRevisaoExtracao(semSegmento)).toThrow("TEXTO_ORIGINAL_INVALIDO");
  const completo = "x".repeat(200_000);
  expect(prepararRevisaoExtracao({ ...entradaKernel, rawTranscript: completo }).payload.resumo).toContain(completo);
});

it("false e ausente conservam payload/hash legado com fatos selecionados", () => {
  const fact = { id: "f", segmentId: "seg", sourceId: "s", sourceType: "medical_note", patientCandidateId: null,
    domain: "symptom", value: "dor", rawEvidence: "Dor referida", evidence: "EXPLICIT", confidence: 1, requiresConfirmation: false };
  const { incluirTextoOriginal: _incluir, ...base } = entradaKernel;
  const legado = { ...base, facts: [fact], factIds: ["f"] };
  expect(prepararRevisaoExtracao({ ...legado, incluirTextoOriginal: false })).toEqual(prepararRevisaoExtracao(legado));
  expect(prepararRevisaoExtracao(legado).payload).not.toHaveProperty("incluirTextoOriginal");
});


it("vínculo trusted resolve só pendência de identidade; texto literal não promove relato nem incerteza clínica", () => {
  const entrada = { ...entradaKernel, exceptions: [
    { kind: "UNLINKED_PATIENT", reason: "Paciente exige vínculo médico." },
    { kind: "UNCERTAIN_FACT", reason: "Relato de toxicidade exige revisão clínica." },
  ] };
  const pendente = prepararRevisaoExtracao(entrada);
  expect(pendente.payload.resumo).toContain("Paciente exige vínculo médico.");
  const vinculado = prepararRevisaoExtracao({ ...entrada, vinculoConfirmado: true });
  expect(vinculado.payload.resumo).not.toContain("Paciente exige vínculo médico.");
  expect(vinculado.payload.resumo).toContain("Relato de toxicidade exige revisão clínica.");
  expect(vinculado.payload.resumo).toContain(literal);
  expect(vinculado.payload.facts).toEqual([]);
  expect(vinculado.registros.map(r => r.tipo)).toEqual(["ReviewDecision"]);
  expect(vinculado.registros[0]!.payload).not.toHaveProperty("campo");
  expect(vinculado.registros[0]!.payload).not.toHaveProperty("valor");
});
