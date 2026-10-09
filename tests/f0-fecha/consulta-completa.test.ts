import { afterEach, describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import {
  AGORA, ENCONTRO, PACIENTE, OUTRO_PACIENTE, abrirAmbiente, cadastrarPaciente,
  carregarConsulta, confirmarFatos, criarDiretorio, extrair, finalizarFlash, removerDiretorio,
  type Extracao, type PreparacaoRevisao,
} from "./fixtures/consulta-completa.js";

const dirs: string[] = [];
const ambientes: Array<Awaited<ReturnType<typeof abrirAmbiente>>> = [];
afterEach(async () => {
  for (const ambiente of ambientes.splice(0)) await ambiente.close();
  for (const dir of dirs.splice(0)) removerDiretorio(dir);
});

async function novoCaso() {
  const dir = criarDiretorio(); dirs.push(dir);
  const ambiente = await abrirAmbiente(dir); ambientes.push(ambiente);
  cadastrarPaciente(ambiente);
  await carregarConsulta(ambiente);
  return ambiente;
}

async function revisarFatos(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, extracao: Extracao,
  operationId: string, factIds = extracao.facts.map((fact) => fact.id), link = true) {
  if (!factIds.length) throw new Error(`SEM_FATOS_SINTETICOS_PARA_REVISAO:${extracao.draftId}`);
  const fluxo = await confirmarFatos(ambiente, extracao, factIds, operationId, { link });
  expect(fluxo.preview.status).toBe(200);
  expect(fluxo.preview.data).toMatchObject({ codigo: "REVISAO_PREPARADA", criaEventoClinico: false });
  expect(fluxo.preview.data.comprovanteExibicao.conteudoHash).toMatch(/^[0-9a-f]{64}$/u);
  return { fluxo, comprovante: fluxo.preview.data.comprovanteExibicao };
}

async function assinarFlash(ambiente: Awaited<ReturnType<typeof abrirAmbiente>>, key: string) {
  const { context, preparada } = await finalizarFlash(ambiente, key);
  expect(preparada.status).toBe(200);
  const exibicao = await ambiente.request<Record<string, any>>("/consulta/bundle", context);
  expect(exibicao.status).toBe(200);
  const confirmado = await ambiente.request<Record<string, any>>("/consulta/confirmar", {
    ...context, bloco: "TUDO", registros: preparada.data.registros,
    documentosExibidos: preparada.data.documentos.map((doc: { documentId: string; documentVersion: number }) => ({
      documentId: doc.documentId, documentVersion: doc.documentVersion,
    })), reconhecerAlertas: [], idempotencyKey: key,
  });
  return { preparada, exibicao, confirmado };
}

describe("F0 E6b · consulta completa com HTTP real e SQLite temporário", () => {
  it("percorre kit sintético, vínculo explícito, evolução exibida e Flash assinada; reabre o SQLite e preserva a história", async () => {
    const started = performance.now();
    const ambiente = await novoCaso();
    const kit = [
      { sourceId: "ap-e6b-92", sourceType: "pathology" as const,
        text: "Paciente: Paciente Teste 92\nDiagnóstico anatomopatológico: carcinoma ductal invasivo sintético, grau 2." },
      { sourceId: "laboratorio-e6b-92", sourceType: "medical_note" as const,
        text: "Paciente: Paciente Teste 92\nCreatinina 1,2 mg/dL em 09/10/2026. Sem proteinúria. TSH não consta." },
      { sourceId: "encaminhamento-e6b-92", sourceType: "nursing" as const,
        text: "Paciente: Paciente Teste 92\nEncaminhamento sintético: creatinina 1,8 mg/dL em 09/10/2026; dado divergente do laboratório." },
    ];
    const extractions = new Map<string, Extracao>();
    let acoesEquivalentes = 1; // abrir/carregar a consulta
    for (const item of kit) {
      const extracao = await extrair(ambiente, item);
      extractions.set(item.sourceId, extracao);
      acoesEquivalentes += 3; // anexar fonte, abrir sua revisão, confirmar o vínculo explícito
      const caixa = await ambiente.request<Record<string, any>>("/consulta/rascunho", { draftId: extracao.draftId });
      expect(caixa.status).toBe(200);
      expect(caixa.data.draft).toMatchObject({ patientId: null, sourceId: item.sourceId,
        payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: item.sourceId } } });
      const excepcao = extracao.exceptions.find((exception) => exception.kind === "UNLINKED_PATIENT");
      expect(excepcao?.id).toBeTruthy();
      if (!excepcao) throw new Error(`VINCULO_EXPLICITO_NAO_OFERTADO:${item.sourceId}`);
      const linked = await ambiente.request<Record<string, any>>("/consulta/rascunho/revisar", {
        exceptionId: excepcao.id, acao: "LIGAR_PACIENTE", draftId: extracao.draftId,
        expectedRevision: extracao.revision, patientId: PACIENTE, sourceId: item.sourceId,
        encounterId: ENCONTRO, tumorLotId: null, idempotencyKey: `vinculo-${item.sourceId}`,
      });
      expect(linked.status).toBe(200);
      expect(linked.data).toMatchObject({ codigo: "VINCULO_REVISTO", linkedPatientId: PACIENTE });
    }

    const anatomopatologico = extractions.get("ap-e6b-92")!;
    const histologia = anatomopatologico.facts.find((fact) => fact.domain === "histology");
    expect(histologia).toBeDefined();
    if (!histologia) throw new Error("AP_SEM_FATO_REVISAVEL");
    const revisaoAp = await revisarFatos(ambiente, anatomopatologico, "e6b-review-ap-92", [histologia.id], false);
    expect(await revisaoAp.fluxo.confirmar(revisaoAp.comprovante)).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    acoesEquivalentes += 3;
    const laboratorio = extractions.get("laboratorio-e6b-92")!;
    const candidato = laboratorio.facts.find((fact) => fact.domain === "lab");
    expect(candidato).toBeDefined();
    if (!candidato) throw new Error("LABORATORIO_SEM_FATO_REVISAVEL");
    const revisao = await revisarFatos(ambiente, laboratorio, "e6b-review-lab-92", [candidato.id], false);
    const confirmacao = await revisao.fluxo.confirmar(revisao.comprovante);
    expect(confirmacao).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    acoesEquivalentes += 3; // escolher fato, exibir evolução e confirmar revisão

    const flash = await assinarFlash(ambiente, "e6b-flash-92");
    expect(flash.confirmado).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const signedEvolution = listarEventos(ambiente.db, PACIENTE).find((event) => {
      if (event.revisao !== "ASSINADO" || event.tipo !== "DOCUMENTO") return false;
      const outer = event.payload as { data?: { data?: { tipoDocumento?: string } } };
      const payload = outer.data?.data as { tipoDocumento?: string } | undefined;
      return payload?.tipoDocumento === "FLASH_EVOLUCAO";
    });
    expect(signedEvolution).toBeDefined();
    expect(signedEvolution?.criadoPor).toMatchObject({ tipo: "SESSAO", id: "medico-teste-e6b" });
    const textoAssinado = (signedEvolution?.payload as { data?: { data?: { texto?: string } } }).data?.data?.texto;
    expect(textoAssinado).toMatch(/carcinoma/i);
    expect(textoAssinado).toMatch(/creatinina/i);
    expect(textoAssinado).toContain("mg/dL");
    // This is an equivalent UI action estimate; HTTP requests are counted separately above.
    acoesEquivalentes += 3; // abrir Consulta Flash, finalizar o plano e reabrir a história
    const correcoes = 0; // nenhuma correção de conteúdo foi solicitada ou inventada nesta jornada

    await ambiente.close();
    ambientes.splice(ambientes.indexOf(ambiente), 1);
    const reaberto = await abrirAmbiente(ambiente.dir); ambientes.push(reaberto);
    const carregada = await carregarConsulta(reaberto);
    expect(carregada.data.patientId).toBe(PACIENTE);
    expect(carregada.data.resumoEvolucao).toContain(candidato.rawEvidence);
    expect(carregada.data.evolucoesRascunho).toEqual(expect.arrayContaining([
      expect.objectContaining({ revisaoRegistrada: true, status: "RASCUNHO" }),
    ]));
    const historicoReaberto = listarEventos(reaberto.db, PACIENTE);
    expect(historicoReaberto.some((event) => event.eventId === signedEvolution?.eventId)).toBe(true);
    expect(carregada.data.flash.retornoDias).toBe(30);
    const calls = ambiente.chamadasHttp() + reaberto.chamadasHttp();
    const duracaoMs = Math.round(performance.now() - started);
    console.info(`[E6b-METRICAS] chamadas_http=${calls}; acoes_de_tela_equivalentes=${acoesEquivalentes}; correcoes_requeridas=${correcoes}; duracao_ms=${duracaoMs}`);
  });

  it("mantém duas fontes contraditórias como CONFLITO e sem eleição automática antes de decisão", async () => {
    const ambiente = await novoCaso();
    const textos = [
      { sourceId: "lab-conflito-a-92", text: "09/10/2026 creatinina 1,2 mg/dL" },
      { sourceId: "lab-conflito-b-92", text: "09/10/2026 creatinina 1,8 mg/dL" },
    ];
    const drafts: string[] = [];
    const extracted: Extracao[] = [];
    for (const item of textos) {
      const extraido = await extrair(ambiente, { ...item, sourceType: "medical_note" });
      const fact = extraido.facts.find((candidate) => candidate.domain === "lab");
      expect(fact).toBeDefined();
      if (!fact) throw new Error(`CANDIDATO_LAB_AUSENTE:${item.sourceId}`);
      const linked = await ambiente.request<Record<string, any>>("/consulta/rascunho/revisar", {
        exceptionId: extraido.exceptions.find((exception) => exception.kind === "UNLINKED_PATIENT")!.id,
        acao: "LIGAR_PACIENTE", draftId: extraido.draftId, expectedRevision: 0,
        patientId: PACIENTE, sourceId: item.sourceId, encounterId: ENCONTRO,
        tumorLotId: null, idempotencyKey: `link-${item.sourceId}`,
      });
      expect(linked.status).toBe(200);
      drafts.push(extraido.draftId);
      extracted.push(extraido);
    }

    const afterLinks = ambiente.eventos().length;
    const beforeDecision = await ambiente.request<Record<string, any>>("/consulta/rascunho/reconciliar", { draftIds: drafts });
    expect(beforeDecision.status).toBe(200);
    expect(beforeDecision.data).toMatchObject({ codigo: "RECONCILIACAO_PROPOSTA", decisaoClinicaTomada: false });
    const proposedFields = Object.values(beforeDecision.data.campos as Record<string, {
      domain: string; conflict: boolean; candidates: Array<{ sourceId: string }>;
    }>);
    expect(proposedFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: "lab", conflict: true, candidates: expect.arrayContaining([
        expect.objectContaining({ sourceId: textos[0]!.sourceId }),
        expect.objectContaining({ sourceId: textos[1]!.sourceId }),
      ]) }),
    ]));
    expect(ambiente.eventos()).toHaveLength(afterLinks);
    expect(ambiente.eventos().filter((event) => event.tipo === "FATO")).toHaveLength(0);

    // Fonte confirmada não equivale a resolução do conflito entre fontes.
    for (let index = 0; index < extracted.length; index++) {
      const source = extracted[index]!;
      const fact = source.facts.find((candidate) => candidate.domain === "lab")!;
      const { fluxo, comprovante } = await revisarFatos(ambiente, source,
        `review-${textos[index]!.sourceId}`, [fact.id], false);
      expect((await fluxo.confirmar(comprovante)).status).toBe(200);
    }

    const antes = ambiente.eventos().length;
    const proposta = await ambiente.request<Record<string, any>>("/consulta/rascunho/reconciliar", { draftIds: drafts });
    expect(proposta.status).toBe(200);
    expect(proposta.data).toMatchObject({ codigo: "RECONCILIACAO_PROPOSTA", decisaoClinicaTomada: false });
    const campoConflitante = Object.values(proposta.data.campos as Record<string, {
      domain: string; conflict: boolean; candidates: Array<{ sourceId: string }>;
    }>).find((field) => field.domain === "lab" && field.conflict);
    expect(campoConflitante).toBeDefined();
    expect(campoConflitante?.candidates.map((candidate) => candidate.sourceId))
      .toEqual(expect.arrayContaining(textos.map((item) => item.sourceId)));
    expect(ambiente.eventos()).toHaveLength(antes);
    const leitura = await carregarConsulta(ambiente);
    expect(leitura.data.conflitosRevisaoExtracao).toEqual(expect.arrayContaining([
      expect.objectContaining({ dominio: "lab", candidatos: expect.arrayContaining([
        expect.objectContaining({ sourceId: textos[0]!.sourceId }),
        expect.objectContaining({ sourceId: textos[1]!.sourceId }),
      ]) }),
    ]));
    expect(proposta.data.decisaoClinicaTomada).toBe(false);
  });

  it("preserva negação literal, data e unidade; ausência continua sem fato numérico inventado", async () => {
    const ambiente = await novoCaso();
    const texto = "09/10/2026 Creatinina 1,2 mg/dL. Sem proteinúria. TSH não consta.";
    const extraido = await extrair(ambiente, { sourceId: "lab-negacao-unidade-92", sourceType: "medical_note", text: texto });
    const creatinina = extraido.facts.find((fact) => fact.domain === "lab"
      && JSON.stringify(fact.value).toLocaleLowerCase("pt-BR").includes("creatinina"));
    expect(creatinina).toBeDefined();
    expect(creatinina?.date).toBe("2026-10-09");
    expect(JSON.stringify(creatinina?.value)).toContain("mg/dL");
    expect(creatinina?.rawEvidence).toContain("1,2 mg/dL");
    expect(extraido.facts.some((fact) => JSON.stringify(fact.value).toLocaleLowerCase("pt-BR").includes("proteinúria"))).toBe(false);
    expect(extraido.facts.some((fact) => JSON.stringify(fact.value).toLocaleLowerCase("pt-BR").includes("tsh"))).toBe(false);
    const raw = await ambiente.request<Record<string, any>>("/consulta/rascunho", { draftId: extraido.draftId });
    expect(raw.data.draft.payload.input.rawTranscript).toBe(texto);
    expect(raw.data.draft.payload.input.rawTranscript).toContain("TSH não consta");
  });

  it("repete após falha percebida pelo cliente sem duplicar o evento nem a evolução", async () => {
    const ambiente = await novoCaso();
    const extraido = await extrair(ambiente, { sourceId: "retry-e6b-92", sourceType: "medical_note",
      text: "Creatinina 1,2 mg/dL em 09/10/2026." });
    const fact = extraido.facts.find((candidate) => candidate.domain === "lab");
    expect(fact).toBeDefined();
    if (!fact) throw new Error("FATO_LAB_RETRY_AUSENTE");
    const { fluxo, comprovante } = await revisarFatos(ambiente, extraido, "e6b-retry-operation-92", [fact.id]);
    let perdaSimulada = false;
    try {
      const committed = await fluxo.confirmar(comprovante);
      expect(committed.status).toBe(200);
      perdaSimulada = true;
      throw new Error("RESPOSTA_HTTP_PERDIDA_APOS_COMMIT_SIMULADO");
    } catch (error) {
      expect((error as Error).message).toBe("RESPOSTA_HTTP_PERDIDA_APOS_COMMIT_SIMULADO");
    }
    expect(perdaSimulada).toBe(true);
    const replay = await fluxo.confirmar(comprovante);
    expect(replay.status).toBe(200);
    expect(replay.data.codigo).toBe("REPLAY");
    expect(ambiente.eventos().filter((event) => event.operationId === "e6b-retry-operation-92")).toHaveLength(1);
    const summaryId = fluxo.preview.data.comprovanteExibicao.documentId;
    expect(lerDraft(ambiente.db, summaryId)?.revision).toBe(1);
  });

  it("recusa paciente trocado e conteúdo editado depois da exibição", async () => {
    const ambiente = await novoCaso();
    cadastrarPaciente(ambiente, "93");
    const extraido = await extrair(ambiente, { sourceId: "swap-edit-e6b-92", sourceType: "medical_note",
      text: "Creatinina 1,2 mg/dL em 09/10/2026." });
    const fact = extraido.facts.find((candidate) => candidate.domain === "lab");
    expect(fact).toBeDefined();
    if (!fact) throw new Error("FATO_CONTEXTUAL_AUSENTE");
    const primeiro = await revisarFatos(ambiente, extraido, "e6b-swap-op-92", [fact.id]);
    await carregarConsulta(ambiente, OUTRO_PACIENTE);
    const contextoTrocado = await primeiro.fluxo.confirmar(primeiro.comprovante);
    expect(contextoTrocado.status).toBe(409);
    expect(["PACIENTE_FORA_DA_CONSULTA_SELECIONADA", "BUNDLE_NAO_EXIBIDO"])
      .toContain(contextoTrocado.data.codigo);
    expect(ambiente.eventos().filter((event) => event.operationId === "e6b-swap-op-92")).toHaveLength(0);

    await carregarConsulta(ambiente);
    const flash = await finalizarFlash(ambiente, "e6b-edit-flash-92");
    expect(flash.preparada.status).toBe(200);
    const exibição = await ambiente.request<Record<string, any>>("/consulta/bundle", flash.context);
    expect(exibição.status).toBe(200);
    const evolucao = flash.preparada.data.registros[0]!;
    const draft = lerDraft(ambiente.db, evolucao.id);
    expect(draft).not.toBeNull();
    if (!draft) throw new Error("EVOLUCAO_FLASH_NAO_PERSISTIDA");
    salvarDraft(ambiente.db, { ...draft, revision: draft.revision + 1,
      payload: { ...(draft.payload as Record<string, unknown>), texto: "Conteúdo sintético alterado após exibição." } });
    const confirmacao = await ambiente.request<Record<string, any>>("/consulta/confirmar", {
      ...flash.context, bloco: "TUDO", registros: flash.preparada.data.registros,
      documentosExibidos: flash.preparada.data.documentos.map((doc: { documentId: string; documentVersion: number }) => ({
        documentId: doc.documentId, documentVersion: doc.documentVersion,
      })), reconhecerAlertas: [], idempotencyKey: "e6b-edit-flash-92",
    });
    expect(confirmacao).toMatchObject({ status: 409, data: { codigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" } });
    expect(ambiente.eventos().some((event) => event.revisao === "ASSINADO")).toBe(false);
  });

  it("conclui revisão e Flash manualmente com o caminho de IA ausente", async () => {
    const ambiente = await novoCaso();
    const extraido = await extrair(ambiente, { sourceId: "manual-sem-ia-e6b-92", sourceType: "medical_note",
      text: "Creatinina 1,2 mg/dL em 09/10/2026." });
    const fato = extraido.facts.find((candidate) => candidate.domain === "lab");
    expect(fato).toBeDefined();
    if (!fato) throw new Error("FATO_MANUAL_AUSENTE");
    const revisao = await revisarFatos(ambiente, extraido, "e6b-manual-op-92", [fato.id]);
    expect((await revisao.fluxo.confirmar(revisao.comprovante)).status).toBe(200);
    const flash = await assinarFlash(ambiente, "e6b-manual-flash-92");
    expect(flash.confirmado).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    const assinados = ambiente.eventos().filter((event) => event.revisao === "ASSINADO");
    const tipos = assinados.map((event) => {
      const outer = event.payload as { data?: { tipoDocumento?: string; data?: { tipoDocumento?: string } } };
      return outer.data?.data?.tipoDocumento ?? outer.data?.tipoDocumento;
    }).sort();
    expect(tipos).toEqual(["FLASH_EVOLUCAO", "FLASH_RETORNO"]);
    expect(ambiente.chamadasHttp()).toBeGreaterThan(0);
  });
});
