/** Integração E2E HTTP do caso cólon (câncer de cólon metastático em FOLFIRI).
 *  Exercita o servidor real (HTTP+SQLite arquivo+relógio injetado),
 *  kit documental com bytes reais (PDF digital + PNG escaneado + PDF bitmap com OCR local),
 *  vínculo explícito, revisão, triagem pré-ciclo, Flash, assinatura, reimpressão e reabertura.
 *  A prova da interface em navegador é separada desta bateria HTTP. */
import { afterEach, describe, expect, it } from "vitest";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { lerDraft } from "../../src/kernel/ledger/drafts.js";
import {
  DATA_CLINICA, ENCONTRO_ANTERIOR, ENCONTRO_ATUAL, PACIENTE_ID,
  SENHA, TUMOR_LOT_ID, abrirAmbienteColon, cadastrarCasoColon, criarDiretorioColon,
  kitColon, pngEscaneado, pdfBitmap, removerDiretorioColon, sha256, triagemColon, type FonteKit,
} from "./fixtures/colon-e2e.js";

const dirs: string[] = [];
const ambientes: Array<Awaited<ReturnType<typeof abrirAmbienteColon>>> = [];
afterEach(async () => {
  for (const amb of ambientes.splice(0)) await amb.close();
  for (const dir of dirs.splice(0)) removerDiretorioColon(dir);
});

async function novoCaso() {
  const dir = criarDiretorioColon(); dirs.push(dir);
  const amb = await abrirAmbienteColon(dir); ambientes.push(amb);
  cadastrarCasoColon(amb);
  return amb;
}

type Resp<T = Record<string, any>> = { status: number; data: T };

async function selecionarContexto(amb: Awaited<ReturnType<typeof abrirAmbienteColon>>,
  patientId = PACIENTE_ID, encounterId = ENCONTRO_ATUAL, tumorLotId: string | null = TUMOR_LOT_ID): Promise<Resp> {
  return amb.request("/consulta/contexto/selecionar", { patientId, encounterId, tumorLotId });
}

async function uploadFonte(amb: Awaited<ReturnType<typeof abrirAmbienteColon>>, fonte: FonteKit): Promise<Resp> {
  return amb.request("/consulta/upload", {
    patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL, tumorLotId: TUMOR_LOT_ID,
    id: fonte.id, sourceId: fonte.sourceId, sourceType: fonte.sourceType, tipo: fonte.tipo,
    bytesBase64: fonte.bytes.toString("base64"),
  });
}

async function vincularFonte(amb: Awaited<ReturnType<typeof abrirAmbienteColon>>, draftId: string,
  sourceId: string, expectedRevision: number): Promise<Resp & { data: { codigo: string; revision: number } }> {
  const draft = lerDraft(amb.db, draftId);
  const exception = (draft?.payload as { state?: { confirmationRequired?: Array<{ id: string; kind: string }> } })
    ?.state?.confirmationRequired?.find((e) => e.kind === "UNLINKED_PATIENT");
  if (!exception) throw new Error(`VINCULO_EXPLICITO_NAO_OFERTADO:${sourceId}`);
  return amb.request("/consulta/rascunho/revisar", {
    exceptionId: exception.id, acao: "LIGAR_PACIENTE", draftId, expectedRevision,
    patientId: PACIENTE_ID, sourceId, encounterId: ENCONTRO_ATUAL, tumorLotId: TUMOR_LOT_ID,
    idempotencyKey: `vinculo-${sourceId}`,
  }) as Promise<Resp & { data: { codigo: string; revision: number } }>;
}

/** Confirma um fato já vinculado: exibe (preparar-revisão) e só então grava. */
async function confirmarFato(amb: Awaited<ReturnType<typeof abrirAmbienteColon>>, draftId: string,
  expectedRevision: number, factId: string | null, operationId: string, incluirTextoOriginal = false) {
  const selecao = { draftId, expectedRevision, patientId: PACIENTE_ID, factIds: factId ? [factId] : [], operationId,
    ...(incluirTextoOriginal ? { incluirTextoOriginal: true } : {}) };
  const preview = await amb.request<{ codigo: string; comprovanteExibicao: { documentId: string; documentVersion: number; conteudoHash: string } }>(
    "/consulta/rascunho/preparar-revisao", selecao);
  expect(preview.status).toBe(200);
  expect(preview.data.codigo).toBe("REVISAO_PREPARADA");
  expect(preview.data.comprovanteExibicao.conteudoHash).toMatch(/^[0-9a-f]{64}$/);
  const confirmado = await amb.request<{ codigo: string }>("/consulta/rascunho/revisar",
    { ...selecao, comprovanteExibicao: preview.data.comprovanteExibicao });
  return { preview, confirmado };
}

describe("E2E F1 · caso cólon metastático em FOLFIRI (sintético, HTTP real, SQLite arquivo)", () => {
  it("data somente no cabeçalho não é atribuída ao resultado pela revisão genérica", async () => {
    const amb = await novoCaso();
    await selecionarContexto(amb);
    const bytes = pdfBitmap(["09/10/2026 - Laboratorio (sintetico)", "Hemoglobina 8,2 g/dL."]);
    const fonte: FonteKit = { id: "upload-colon-data-pendente", sourceId: "colon-data-pendente",
      sourceType: "medical_note", tipo: "PDF", bytes, sha256: sha256(bytes), dataClinica: DATA_CLINICA };
    const up = await uploadFonte(amb, fonte);
    expect(up.status).toBe(201);
    const vinculo = await vincularFonte(amb, up.data.draftId, fonte.sourceId, up.data.revision);
    expect(vinculo.status).toBe(200);
    const facts = (lerDraft(amb.db, up.data.draftId)!.payload as { state: { facts: Array<{
      id: string; domain: string; date?: string; requiresConfirmation: boolean;
    }> } }).state.facts;
    const hb = facts.find(f => f.domain === "lab")!;
    expect(hb).toBeDefined(); expect(hb.date).toBeUndefined(); expect(hb.requiresConfirmation).toBe(true);
    const revista = await confirmarFato(amb, up.data.draftId, vinculo.data.revision, hb.id, "colon-data-pendente-revisao");
    expect(revista.confirmado).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const eventos = listarEventos(amb.db, PACIENTE_ID).filter(e => e.operationId === "colon-data-pendente-revisao");
    expect(eventos.some(e => e.tipo === "FATO")).toBe(false);
    expect(eventos.some(e => e.tipo === "ReviewDecision" && JSON.stringify(e.payload).includes(hb.id))).toBe(true);
  });

  it("Etapas 1–8: kit documental → revisão → triagem → Flash assinada → reimpressão → reabertura sem duplicação", async () => {
    const amb = await novoCaso();
    // ETAPA 1 — contexto do ambiente e do caso
    const selecao = await selecionarContexto(amb);
    expect(selecao.status).toBe(200);
    expect(selecao.data.codigo).toBe("CONTEXTO_SELECIONADO");

    // ETAPA 2/3 — kit documental real pelos controles de upload
    const kit = kitColon();
    const rascunhos = new Map<string, { draftId: string; revision: number; conversionStatus: string }>();
    for (const fonte of kit) {
      const up = await uploadFonte(amb, fonte);
      expect(up.status).toBe(201);
      expect(up.data.codigo).toBe("RASCUNHO_SALVO");
      // bytes originais preservados + hash SHA-256 conferido
      const draft = lerDraft(amb.db, up.data.draftId as string)!;
      const original = (draft.payload as { original: { bytesBase64: string; contentHash: string; documento: { paginas: Array<{ n: number; texto: string }> } } }).original;
      expect(Buffer.from(original.bytesBase64, "base64").equals(fonte.bytes)).toBe(true);
      expect(original.contentHash).toBe(fonte.sha256);
      expect(original.documento.paginas).toHaveLength(1);
      expect(original.documento.paginas[0]!.n).toBe(1);
      rascunhos.set(fonte.sourceId, { draftId: up.data.draftId as string, revision: up.data.revision as number, conversionStatus: up.data.conversionStatus as string });
    }
    // caminhos de leitura: A é PDF digital (sem OCR); B (PNG) e C (bitmap) passam por OCR local
    expect(rascunhos.get("e2e-colon-historico")!.conversionStatus).toBe("PRONTO");
    expect(rascunhos.get("e2e-colon-avaliacao")!.conversionStatus).toBe("PRONTO");
    expect(rascunhos.get("e2e-colon-laboratorio")!.conversionStatus).toBe("PRONTO");
    // nenhum candidato vira fato confirmado antes da revisão
    expect(listarEventos(amb.db, PACIENTE_ID).some((e) => e.tipo === "FATO")).toBe(false);
    expect(listarEventos(amb.db, PACIENTE_ID).some((e) => e.revisao === "ASSINADO")).toBe(false);

    // OCR real leu as fontes escaneadas
    const textoOcr = (sourceId: string) => {
      const r = rascunhos.get(sourceId)!;
      const draft = lerDraft(amb.db, r.draftId)!;
      return ((draft.payload as { input: { rawTranscript: string } }).input.rawTranscript);
    };
    expect(textoOcr("e2e-colon-avaliacao")).toMatch(/diarreia CTCAE grau 2/i);
    expect(textoOcr("e2e-colon-laboratorio")).toMatch(/Hemoglobina 8,2 g\/dL/i);

    // ETAPA 4 — vínculo explícito por fonte
    for (const fonte of kit) {
      const r = rascunhos.get(fonte.sourceId)!;
      const vinculo = await vincularFonte(amb, r.draftId, fonte.sourceId, r.revision);
      expect(vinculo.status).toBe(200);
      expect(vinculo.data.codigo).toBe("VINCULO_REVISTO");
      rascunhos.set(fonte.sourceId, { ...r, revision: vinculo.data.revision });
    }

    // Candidatos estruturados: diagnóstico (A), Hb (C). Relatos não extraídos exigem seleção literal.
    const fatosA = ((lerDraft(amb.db, rascunhos.get("e2e-colon-historico")!.draftId)!.payload) as { state: { facts: Array<{ id: string; domain: string; value: unknown; rawEvidence: string; date?: string }> } }).state.facts;
    const diagnostico = fatosA.find((f) => f.domain === "diagnosis");
    expect(diagnostico).toBeDefined();
    expect(JSON.stringify(diagnostico!.value)).toContain("câncer de cólon metastático");
    expect(diagnostico!.date).toBe(DATA_CLINICA);
    const fatosC = ((lerDraft(amb.db, rascunhos.get("e2e-colon-laboratorio")!.draftId)!.payload) as { state: { facts: Array<{ id: string; domain: string; value: unknown; rawEvidence: string; date?: string }> } }).state.facts;
    const hb = fatosC.find((f) => f.domain === "lab");
    expect(hb).toBeDefined();
    // Resultado esperado 6: "8,2" preservado com unidade g/dL; nunca lido como "82 g/dL"
    expect(JSON.stringify(hb!.value)).toContain("8,2");
    expect(JSON.stringify(hb!.value)).toContain("g/dL");
    expect(JSON.stringify(hb!.value)).not.toContain("82");
    // A fonte positiva associa a data ao resultado; não herda data apenas do cabeçalho.
    expect(hb!.date).toBe(DATA_CLINICA);
    expect(textoOcr("e2e-colon-laboratorio")).toContain("09/10/2026");
    // Resultados esperados 4/8: sem fato de ANC e sem nenhum fato de biomarcador inventado
    const todosFatos = [...fatosA, ...fatosC,
      ...((lerDraft(amb.db, rascunhos.get("e2e-colon-avaliacao")!.draftId)!.payload) as { state: { facts: Array<{ domain: string; value: unknown }> } }).state.facts];
    expect(todosFatos.some((f) => f.domain === "biomarker")).toBe(false);
    expect(JSON.stringify(todosFatos)).not.toMatch(/MSS|pMMR|wild-type|HER2/i);
    expect(JSON.stringify(todosFatos)).not.toMatch(/anc|neutr[óo]filos?/i);

    // revisão médica confirma apenas o conteúdo exibido
    const revDiag = await confirmarFato(amb, rascunhos.get("e2e-colon-historico")!.draftId,
      rascunhos.get("e2e-colon-historico")!.revision, diagnostico!.id, "e2e-colon-op-diagnostico", true);
    expect(revDiag.confirmado).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const revTexto = await confirmarFato(amb, rascunhos.get("e2e-colon-avaliacao")!.draftId,
      rascunhos.get("e2e-colon-avaliacao")!.revision, null, "e2e-colon-op-avaliacao-literal", true);
    expect(revTexto.confirmado).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const eventosTexto = listarEventos(amb.db, PACIENTE_ID).filter(e => e.operationId === "e2e-colon-op-avaliacao-literal");
    expect(eventosTexto).toHaveLength(1);
    expect(eventosTexto[0]!.tipo).toBe("ReviewDecision");
    const revHb = await confirmarFato(amb, rascunhos.get("e2e-colon-laboratorio")!.draftId,
      rascunhos.get("e2e-colon-laboratorio")!.revision, hb!.id, "e2e-colon-op-hb");
    expect(revHb.confirmado).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const fatosConfirmados = listarEventos(amb.db, PACIENTE_ID).filter((e) => e.tipo === "FATO");
    expect(fatosConfirmados).toHaveLength(2);
    const laboratorioConfirmado = fatosConfirmados.find(e => e.operationId === "e2e-colon-op-hb");
    expect(laboratorioConfirmado?.payload).toMatchObject({ data: {
      valor: { marker: "Hemoglobina", value: 8.2, unit: "g/dL" }, factDate: DATA_CLINICA,
    } });
    // proveniência: registros carregam o paciente e o encontro corretos
    for (const evento of fatosConfirmados) {
      expect(evento.patientId).toBe(PACIENTE_ID);
      expect(evento.encounterId).toBe(ENCONTRO_ATUAL);
    }
    const leituraHb = await amb.request<Record<string, any>>("/consulta/carregar", {
      patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL, tumorLotId: TUMOR_LOT_ID,
    });
    expect(leituraHb.status).toBe(200);
    expect(leituraHb.data.retrato.fatos).toEqual(expect.arrayContaining([
      expect.objectContaining({ ref: expect.objectContaining({ eventId: laboratorioConfirmado!.eventId }) }),
    ]));
    expect(leituraHb.data.visaoIntegrada.lacunas.some((l: { codigo: string }) => l.codigo === "LAB_AUSENTE")).toBe(false);

    // ETAPA 5 (parcial, pré-conduta) — triagem pré-ciclo com os achados do caso
    const triagem = triagemColon();
    const salvaTriagem = await amb.request<Record<string, any>>("/consulta/salao/triagem", { triagem, expectedRevision: null });
    expect(salvaTriagem.status).toBe(200);
    expect(salvaTriagem.data.codigo).toBe("RASCUNHO_SALVO");
    // Valores informados não acionam cortes no ruleset da fixture. ANC e temperatura numérica
    // ausentes continuam PENDENTES; o relato "sem febre" não fabrica uma temperatura.
    const cartoes = salvaTriagem.data.cartoes as Array<{ entrada: { patientId: string }; temCorte: boolean;
      destino: string; emergencia: boolean }>;
    const cartao = cartoes.find((c) => c.entrada.patientId === PACIENTE_ID);
    expect(cartao).toBeDefined();
    expect(cartao!.temCorte).toBe(false);
    expect(cartao!.emergencia).toBe(false);
    expect(cartao!.destino).toBe("FILA_MEDICO"); // ANC pendente não vira corte nem liberação automática
    // Resultado esperado 7: sem corte clínico, a liberação do salão é recusada (nada de "liberar assim mesmo")
    const liberar = await amb.request("/consulta/salao/liberar", {
      patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL,
      expectedRevision: (salvaTriagem.data.rascunho as { revision: number }).revision,
      motivo: "tentativa de liberação sem corte — cenário sintético exige recusa",
      idempotencyKey: "e2e-colon-liberar-sem-corte",
    });
    expect(liberar.status).toBe(409);
    expect(liberar.data.codigo).toBe("CORTE_AUSENTE");
    expect(listarEventos(amb.db, PACIENTE_ID).some((e) => /LIBERACAO|ADMINISTRACAO/.test(e.tipo))).toBe(false);

    // ETAPA 6 — consulta: salvar/retomar rascunho Flash e finalizar para revisão
    const plano = {
      acoesMarcadas: [], receitasMarcadas: [],
      apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [], emitir: false },
      retorno: { dias: null, examesAntesDoRetorno: [] }, // sem data de retorno inventada
      tarefasRetorno: { retorno: false, laboratorio: false, imagem: false },
    };
    const contexto = { patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL, tumorLotId: TUMOR_LOT_ID };
    const rascunhoFlash = await amb.request<Record<string, any>>("/consulta/flash/rascunho",
      { ...contexto, plano, expectedRevision: null });
    expect(rascunhoFlash.status).toBe(201); // 201 na criação do rascunho Flash
    expect(rascunhoFlash.data.codigo).toBe("RASCUNHO_SALVO");
    // retomada sem assinatura: recarregar a consulta mostra o rascunho e nada assinado
    const recarregada = await amb.request<Record<string, any>>("/consulta/carregar", contexto);
    expect(recarregada.status).toBe(200);
    expect(recarregada.data.patientId).toBe(PACIENTE_ID);
    expect(listarEventos(amb.db, PACIENTE_ID).some((e) => e.revisao === "ASSINADO")).toBe(false);

    // ETAPA 7 — exibir e assinar somente o conteúdo exibido
    const preparada = await amb.request<{ codigo: string; registros: Array<{ id: string; expectedRevision: number }>;
      documentos: Array<{ documentId: string; documentVersion: number }> }>("/consulta/flash/preparar",
      { ...contexto, plano, idempotencyKey: "e2e-colon-flash-preparar" });
    expect(preparada.status).toBe(200);
    const exibicao = await amb.request<Record<string, any>>("/consulta/bundle", contexto);
    expect(exibicao.status).toBe(200);
    const assinada = await amb.request<{ codigo: string }>("/consulta/confirmar", {
      ...contexto, bloco: "TUDO", registros: preparada.data.registros,
      documentosExibidos: preparada.data.documentos.map((d) => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
      reconhecerAlertas: [], idempotencyKey: "e2e-colon-flash-assinar",
    });
    expect(assinada).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const documentosAssinados = listarEventos(amb.db, PACIENTE_ID).filter((e) => e.revisao === "ASSINADO" && e.tipo === "DOCUMENTO");
    expect(documentosAssinados.length).toBeGreaterThanOrEqual(1);
    const evolucao = documentosAssinados.find((e) => JSON.stringify(e.payload).includes("FLASH_EVOLUCAO"));
    expect(evolucao).toBeDefined();
    const textoEvolucao = JSON.stringify(evolucao!.payload);
    expect(textoEvolucao).toContain("câncer de cólon metastático");
    expect(textoEvolucao).toContain("8,2");
    expect(textoEvolucao).toContain("g/dL");
    expect(textoEvolucao).toContain("FOLFIRI em curso");
    expect(textoEvolucao).toContain("não disponíveis no material apresentado");
    expect(textoEvolucao).toMatch(/diarreia CTCAE grau 2/i);
    expect(textoEvolucao).toMatch(/Neutropenia referida; paciente sem febre/i);
    expect(textoEvolucao).not.toMatch(/neutropenia febril|MSS|pMMR|wild-type/i);
    // nenhum registro de administração surge da assinatura; nenhuma decisão de próximo ciclo automática
    expect(listarEventos(amb.db, PACIENTE_ID).some((e) => /ADMINISTRACAO|LIBERACAO_CICLO/.test(e.tipo))).toBe(false);
    // APAC permanece PENDENTE sem código inventado
    expect(JSON.stringify(documentosAssinados.map((e) => e.payload))).not.toMatch(/0304\d{2}/);

    // reimpressão de versão histórica pelo gateway local (sem nova assinatura)
    const antesImpressao = listarEventos(amb.db, PACIENTE_ID).length;
    const doc0 = preparada.data.documentos[0]!;
    const impressao = await amb.request<{ codigo: string; decisao: string }>("/acao", {
      verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: doc0.documentId, versao: doc0.documentVersion },
      escopo: { patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL }, destino: null,
      idempotencyKey: "e2e-colon-reimpressao-1",
    });
    expect(impressao.status).toBe(200);
    expect(["EXECUTADA", "GRAVADA"]).toContain(impressao.data.decisao ?? impressao.data.codigo);
    expect(listarEventos(amb.db, PACIENTE_ID).length).toBe(antesImpressao); // sem novo encontro/assinatura/fato

    // ETAPA 8 — encerrar tudo, reiniciar com o mesmo banco, nova autenticação, reabrir
    const hashAntes = documentosAssinados.map((e) => JSON.stringify(e.payload));
    await amb.close();
    ambientes.splice(ambientes.indexOf(amb), 1);
    const reaberto = await abrirAmbienteColon(amb.dir); ambientes.push(reaberto);
    const login = await reaberto.request("/login", { senha: SENHA });
    expect(login.status).toBe(200);
    const selecao2 = await selecionarContexto(reaberto);
    expect(selecao2.status).toBe(200);
    const reaberta = await reaberto.request<Record<string, any>>("/consulta/carregar", contexto);
    expect(reaberta.status).toBe(200);
    expect(reaberta.data.patientId).toBe(PACIENTE_ID);
    // mesma história, hashes e fatos; reimpressão na sessão nova não duplica nada
    const documentosReabertos = listarEventos(reaberto.db, PACIENTE_ID).filter((e) => e.revisao === "ASSINADO" && e.tipo === "DOCUMENTO");
    expect(documentosReabertos.map((e) => JSON.stringify(e.payload))).toEqual(hashAntes);
    const totalEventos = listarEventos(reaberto.db, PACIENTE_ID).length;
    const impressao2 = await reaberto.request("/acao", {
      verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: doc0.documentId, versao: doc0.documentVersion },
      escopo: { patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL }, destino: null,
      idempotencyKey: "e2e-colon-reimpressao-2",
    });
    expect(impressao2.status).toBe(200);
    expect(listarEventos(reaberto.db, PACIENTE_ID).length).toBe(totalEventos);
    // encontro anterior não incorpora retrospectivamente os achados posteriores
    const anterior = await reaberto.request<Record<string, any>>("/consulta/carregar",
      { patientId: PACIENTE_ID, encounterId: ENCONTRO_ANTERIOR, tumorLotId: null });
    expect(anterior.status).toBe(200);
    const textoAnterior = JSON.stringify(anterior.data);
    expect(textoAnterior).not.toContain("Hemoglobina");
    expect(textoAnterior).not.toContain("diarreia");
    expect(textoAnterior).not.toContain("8,2");
    // visão integrada da consulta reaberta: lacunas explícitas, sem negação inventada
    const visaoTxt = JSON.stringify(reaberta.data);
    expect(visaoTxt).not.toMatch(/MSS|pMMR|wild-type/i);
    expect(visaoTxt).not.toMatch(/neutropenia febril/i);
    console.info(`[E2E-COLON-METRICAS] chamadas_http=${reaberto.chamadasHttp()}; eventos_finais=${listarEventos(reaberto.db, PACIENTE_ID).length}`);
  }, 120000);

  it("ataques 1–2: upload fora do contexto e troca de paciente são recusados sem gravar fato", async () => {
    const amb = await novoCaso();
    await selecionarContexto(amb);
    const fonte = kitColon()[0]!;
    // upload com ids de outro encontro/paciente
    const fora = await amb.request("/consulta/upload", {
      patientId: "paciente-e2e-colon-outro", encounterId: "encontro-outro", tumorLotId: null,
      id: "upload-e2e-colon-intruso", sourceId: "e2e-colon-intruso", sourceType: "medical_note",
      tipo: "PDF", bytesBase64: fonte.bytes.toString("base64"),
    });
    expect(fora.status).toBe(409);
    expect(fora.data.codigo).toBe("CONTEXTO_UPLOAD_DIVERGENTE");
    // troca de contexto entre upload e vínculo: vínculo do paciente errado falha
    const up = await uploadFonte(amb, fonte);
    expect(up.status).toBe(201);
    const draftId = up.data.draftId as string;
    await amb.request("/consulta/contexto/selecionar", { patientId: PACIENTE_ID, encounterId: ENCONTRO_ANTERIOR, tumorLotId: null });
    const draft = lerDraft(amb.db, draftId)!;
    const exception = (draft.payload as { state: { confirmationRequired: Array<{ id: string; kind: string }> } })
      .state.confirmationRequired.find((e) => e.kind === "UNLINKED_PATIENT")!;
    const errado = await amb.request("/consulta/rascunho/revisar", {
      exceptionId: exception.id, acao: "LIGAR_PACIENTE", draftId, expectedRevision: 0,
      patientId: PACIENTE_ID, sourceId: fonte.sourceId, encounterId: ENCONTRO_ATUAL,
      tumorLotId: null, idempotencyKey: "vinculo-intruso",
    });
    expect([400, 409]).toContain(errado.status);
    expect(errado.data.codigo).toMatch(/ACAO_REVISAO_INVALIDA|CONTEXTO/);
    expect(listarEventos(amb.db, PACIENTE_ID).some((e) => e.tipo === "FATO")).toBe(false);
  });

  it("ataques 4–5: reenvio/repetição viram REPLAY; mesmo operationId com conteúdo diferente é recusado", async () => {
    const amb = await novoCaso();
    await selecionarContexto(amb);
    const [fonteA, , fonteC] = kitColon();
    const up1 = await uploadFonte(amb, fonteC!);
    const up2 = await uploadFonte(amb, fonteC!); // reenvio do mesmo documento
    expect(up2.status).toBe(200);
    expect(up2.data.codigo).toBe("REPLAY");
    expect(up2.data.draftId).toBe(up1.data.draftId);
    const conflito = await uploadFonte(amb, { ...fonteC!, bytes: pngEscaneado(["Hemoglobina 9,9 g/dL."]) });
    expect(conflito.status).toBe(409);
    expect(conflito.data.codigo).toBe("UPLOAD_ID_CONFLITANTE");

    // vínculo explícito das duas fontes (A: diagnóstico · C: laboratório)
    const vinculos = new Map<string, number>();
    for (const fonte of [fonteA!, fonteC!]) {
      const up = fonte.sourceId === fonteC!.sourceId ? up1 : await uploadFonte(amb, fonte);
      const vinculo = await vincularFonte(amb, up.data.draftId as string, fonte.sourceId, up.data.revision as number);
      expect(vinculo.status).toBe(200);
      vinculos.set(fonte.sourceId, vinculo.data.revision);
    }
    const fatosDe = (sourceId: string, draftId: string) =>
      ((lerDraft(amb.db, draftId)!.payload) as { state: { facts: Array<{ id: string; domain: string }> } }).state.facts;
    const hb = fatosDe(fonteC!.sourceId, up1.data.draftId as string).find((f) => f.domain === "lab")!;
    const upA = (await uploadFonte(amb, fonteA!)).data; // reenvio = REPLAY do draft já criado acima
    const diag = fatosDe(fonteA!.sourceId, upA.draftId as string).find((f) => f.domain === "diagnosis")!;

    // repetição da confirmação (cliente perdeu a resposta) = REPLAY com o mesmo comprovante
    const selecaoHb = { draftId: up1.data.draftId as string, expectedRevision: vinculos.get(fonteC!.sourceId)!,
      patientId: PACIENTE_ID, factIds: [hb.id], operationId: "e2e-colon-op-replay" };
    const previewHb = await amb.request<{ codigo: string; comprovanteExibicao: { documentId: string; documentVersion: number; conteudoHash: string } }>(
      "/consulta/rascunho/preparar-revisao", selecaoHb);
    expect(previewHb.status).toBe(200);
    const conf1 = await amb.request<{ codigo: string }>("/consulta/rascunho/revisar",
      { ...selecaoHb, comprovanteExibicao: previewHb.data.comprovanteExibicao });
    expect(conf1).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const conf2 = await amb.request<{ codigo: string }>("/consulta/rascunho/revisar",
      { ...selecaoHb, comprovanteExibicao: previewHb.data.comprovanteExibicao });
    expect(conf2.status).toBe(200);
    expect(conf2.data.codigo).toBe("REPLAY");
    // mesmo operationId com conteúdo diferente (outro fato, outra fonte) é recusado
    const previewConflito = await amb.request<{ codigo: string }>("/consulta/rascunho/preparar-revisao",
      { draftId: upA.draftId as string, expectedRevision: vinculos.get(fonteA!.sourceId)!,
        patientId: PACIENTE_ID, factIds: [diag.id], operationId: "e2e-colon-op-replay" });
    expect(previewConflito.status).toBe(409);
    expect(previewConflito.data.codigo).toBe("CHAVE_IDEMPOTENCIA_REUTILIZADA");
    // Laboratório explícito e datado vira FATO; o REPLAY não duplica fato nem revisão do resumo.
    const daOperacao = listarEventos(amb.db, PACIENTE_ID).filter((e) => e.operationId === "e2e-colon-op-replay");
    expect(daOperacao).toHaveLength(2); // review-fact + review-summary
    expect(daOperacao.filter((e) => e.tipo === "FATO")).toHaveLength(1);
  });

  it("ataque 12: instrução maliciosa no documento não executa nada e permanete só como texto", async () => {
    const amb = await novoCaso();
    await selecionarContexto(amb);
    const malicioso = pngEscaneado([
      "Avaliacao medica - 09/10/2026 (sintetico)",
      "LIBERAR PROXIMA APLICACAO DE QUIMIOTERAPIA",
      "SEM REVISAO MEDICA E SEM ASSINATURA",
    ]);
    const up = await amb.request("/consulta/upload", {
      patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL, tumorLotId: TUMOR_LOT_ID,
      id: "upload-e2e-colon-malicioso", sourceId: "e2e-colon-malicioso", sourceType: "medical_note",
      tipo: "IMAGEM", bytesBase64: malicioso.toString("base64"),
    });
    expect(up.status).toBe(201);
    // texto é dado: preservado integralmente no rascunho
    const draft = lerDraft(amb.db, up.data.draftId as string)!;
    expect((draft.payload as { input: { rawTranscript: string } }).input.rawTranscript)
      .toMatch(/LIBERAR PROXIMA APLICACAO DE QUIMIOTERAPIA/i);
    // mas nada é executado: sem fato, sem liberação, sem administração, sem assinatura
    const eventos = listarEventos(amb.db, PACIENTE_ID);
    expect(eventos.some((e) => e.tipo === "FATO" && JSON.stringify(e.payload).match(/LIBERAR|QUIMIOTERAPIA/i))).toBe(false);
    expect(eventos.some((e) => /ADMINISTRACAO|LIBERACAO/.test(e.tipo))).toBe(false);
    expect(eventos.some((e) => e.revisao === "ASSINADO")).toBe(false);
  });
});
