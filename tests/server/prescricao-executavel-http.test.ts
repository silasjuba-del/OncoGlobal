// proveniência: dados sintéticos — não utilizar em produção
import { afterEach, expect, it } from "vitest";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { lerDraft, listarDrafts, salvarDraft } from "../../src/kernel/comandos/portas.js";
import { hashConteudoExibido } from "../../src/server/sessao.js";
import { BasePrescricaoExecutavelResposta, ConfirmarPrescricaoExecutavelPedido,
  PrepararPrescricaoExecutavelPedido, PrescricaoExecutavelConfirmada,
  PrescricaoExecutavelPreparada } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { ConteudoPrescricaoExecutavel } from "../../src/contracts/api/prescricaoExecutavel.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, SENHA, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { ausente, fonteSintetica, presente } from "../fixtures/triagem.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: "lote-prescricao-executavel-sintetico" };
const BASE = "/consulta/prescricao-executavel/base";
const PREPARAR = "/consulta/prescricao-executavel/preparar";
const CONFIRMAR = "/consulta/prescricao-executavel/confirmar";

afterEach(async () => {
  for (const ambiente of ambientes.splice(0)) {
    await ambiente.close();
    removerDiretorio(ambiente.dir);
  }
});

function itemPrescrito(dose = 1.5) {
  return {
    itemId: "item-manual-sintetico-1",
    item: {
      drug: "Fármaco citotóxico sintético",
      classe: "QT" as const,
      sequence: 1,
      standardDose: null,
      doseBasis: "FIXED" as const,
      calculatedDose: null,
      prescribedDose: dose,
      unit: "mg",
      adjustmentPercent: null,
      adjustmentReason: null,
      route: "EV",
      diluent: "SF 0,9%",
      finalVolumeMl: 250,
      infusionTime: "60 min",
      days: ["d1"],
      observacao: "Item manual sintético para teste de contrato HTTP.",
      source: "MANUAL" as const,
      overrideMotivo: "Escolha manual sintética explicitamente revisada.",
    },
  };
}

function edicao(overrides: Record<string, unknown> = {}) {
  return {
    protocoloId: "protocolo-manual-sintetico",
    dataPrevista: "2026-10-20",
    motivo: "Nova linha prescrita para teste sintético; validar antes de assinar.",
    planejamento: { modo: "NOVA_LINHA" as const, linha: 1, intencao: "PALIATIVA" as const, numeroCiclo: 1 },
    itens: [itemPrescrito()],
    origemProposta: null,
    encaminharFarmacia: false,
    ...overrides,
  };
}

async function abrir() {
  const ambiente = await abrirAmbiente(criarDiretorio());
  ambientes.push(ambiente);
  cadastrarPaciente(ambiente);
  // A fixture inicial aponta para um marcador opaco; o teste usa referência local sintética.
  for (const draft of listarDrafts(ambiente.db, PACIENTE)) {
    if (draft.rawRef === "fixture-local-sintetica")
      salvarDraft(ambiente.db, { ...draft, revision: draft.revision + 1, rawRef: "referencia-local-sintetica" });
  }
  ambiente.sessoes.selecionarConsulta(ambiente.token, contexto);
  let n = 0;
  const seed = (tipo: string, payload: unknown | ((eventId: string, reviewDecisionId: string) => unknown),
    revisao: "CONFIRMADO" | "ASSINADO" = "CONFIRMADO", supersedesEventId: string | null = null) => {
    const eventId = `prescricao-seed-${++n}`;
    const reviewDecisionId = `revisao-${eventId}`;
    salvarDraft(ambiente.db, { draftId: eventId, patientId: PACIENTE, sourceId: eventId,
      rawRef: "referencia-local-sintetica", payload: { contexto }, diagnostics: [], revision: 0, criadoEm: AGORA });
    const conteudo = typeof payload === "function" ? payload(eventId, reviewDecisionId) : payload;
    const resultado = executarConfirmacao(ambiente.db, { ...contexto, operationId: eventId,
      reviewDecisionId, sessao: ambiente.sessoes.obter(ambiente.token)!, em: AGORA,
      registros: [{ draftId: eventId, expectedRevision: 0, eventId, tipo, payload: conteudo,
        fontes: [fonteSintetica(eventId)], revisao, supersedesEventId }] });
    if (resultado.estado !== "GRAVADA") throw new Error(`SEED_NAO_GRAVADO:${tipo}:${resultado.estado}`);
    return eventId;
  };
  seed("TumorLot", { patientId: PACIENTE, tumorLotId: contexto.tumorLotId, cid: presente("C50"),
    topografia: presente("Mama sintética"), histologia: presente("Carcinoma sintético"), estadiamentos: [],
    finalidadeApac: presente("PALIATIVA"), marcos: [] });
  return Object.assign(ambiente, { seed });
}

type Ambiente = Awaited<ReturnType<typeof abrir>>;

async function carregarBase(a: Ambiente) {
  const resposta = await a.request(BASE, contexto);
  expect(resposta.status).toBe(200);
  return BasePrescricaoExecutavelResposta.parse(resposta.data);
}

async function prepararNovaLinha(a: Ambiente, ajustes: {
  pedido?: Record<string, unknown>;
  edicao?: Record<string, unknown>;
} = {}) {
  const base = await carregarBase(a);
  const pedido = PrepararPrescricaoExecutavelPedido.parse({ contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "preparar-prescricao-sintetica", edicao: edicao(ajustes.edicao) });
  const resposta = await a.request(PREPARAR, { ...pedido, ...ajustes.pedido });
  expect(resposta.status).toBe(200);
  return { base, pedido, preparada: PrescricaoExecutavelPreparada.parse(resposta.data) };
}

function dadosEvento(evento: { payload: unknown }): Record<string, unknown> {
  const payload = evento.payload;
  if (!payload || typeof payload !== "object" || !("data" in payload)) return {};
  const data = payload.data;
  return data && typeof data === "object" ? data as Record<string, unknown> : {};
}

function assinaturaDocumento(evento: { payload: unknown }): Record<string, unknown> {
  const data = dadosEvento(evento);
  return data.signature && typeof data.signature === "object" ? data.signature as Record<string, unknown> : {};
}

async function assinar(a: Ambiente, preparada: PrescricaoExecutavelPreparada, idempotencyKey: string) {
  const pedido = ConfirmarPrescricaoExecutavelPedido.parse({ contexto, draftId: preparada.draftId,
    expectedRevision: preparada.revision, conteudoHash: preparada.conteudoHash, idempotencyKey });
  const resposta = await a.request(CONFIRMAR, pedido);
  expect(resposta.status).toBe(200);
  return PrescricaoExecutavelConfirmada.parse(resposta.data);
}

it.each([false, true])("recibo vincula a escolha de farmácia originalmente exibida: %s", async encaminharFarmacia => {
  const a = await abrir();
  const { preparada, pedido } = await prepararNovaLinha(a, { edicao: { encaminharFarmacia } });
  const draft = lerDraft(a.db, preparada.draftId)!;
  const payload = structuredClone(draft.payload) as { edicao: { encaminharFarmacia: boolean } };
  payload.edicao.encaminharFarmacia = !encaminharFarmacia;
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), draft.draftId);
  const antes = a.eventos();
  const confirmacao = await a.request(CONFIRMAR, { contexto, draftId: preparada.draftId,
    expectedRevision: preparada.revision, conteudoHash: preparada.conteudoHash, idempotencyKey: "recibo-farmacia-adulterado" });
  expect(confirmacao.status).toBe(409);
  expect(confirmacao.data.codigo).toBe("CONTEUDO_ALTERADO_APOS_EXIBICAO");
  expect(a.eventos()).toEqual(antes);
  expect((await a.request(PREPARAR, pedido)).status).toBe(409);
  expect(a.eventos()).toEqual(antes);
});

it("não permite reatar o recibo antigo a uma base nova modificando o draft", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  a.seed("FATO", { campo: "nota.sintetica", valor: "Informação posterior à prévia" });
  const baseNova = await carregarBase(a);
  const draft = lerDraft(a.db, preparada.draftId)!;
  const payload = structuredClone(draft.payload) as { resposta: PrescricaoExecutavelPreparada };
  payload.resposta.baseHash = baseNova.revisao;
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), draft.draftId);
  const antes = a.eventos();
  const r = await a.request(CONFIRMAR, { contexto, draftId: preparada.draftId,
    expectedRevision: preparada.revision, conteudoHash: preparada.conteudoHash, idempotencyKey: "base-revinculada" });
  expect(r.status).toBe(409);
  expect(a.eventos()).toEqual(antes);
});

it.each(["base", "conteudo"])("replay concluído usa o documento assinado, não o draft mutável: %s", async campo => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  const assinada = await assinar(a, preparada, "assinatura-replay-duravel");
  const antes = a.eventos();
  const draft = lerDraft(a.db, preparada.draftId)!;
  const payload = structuredClone(draft.payload) as { resposta: PrescricaoExecutavelPreparada };
  if (campo === "base") payload.resposta.baseHash = "0".repeat(64);
  else payload.resposta.conteudo.documentId = "identidade-do-draft-adulterada";
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), draft.draftId);
  const entrada = { contexto, draftId: preparada.draftId, expectedRevision: preparada.revision,
    conteudoHash: preparada.conteudoHash, idempotencyKey: "assinatura-replay-duravel" };
  const replay = await a.request(CONFIRMAR, entrada);
  expect(replay.status).toBe(200);
  expect(replay.data).toEqual({ ...assinada, codigo: "REPLAY" });
  expect((await a.request(CONFIRMAR, { ...entrada, idempotencyKey: "outra-assinatura-adulterada" })).status).toBe(409);
  expect(a.eventos()).toEqual(antes);
});

it("encerramento documentado do episódio selecionado permite nova linha sem reabrir o episódio antigo", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  const assinada = await assinar(a, preparada, "assinar-antes-de-encerrar");
  const original = a.eventos().find(e => e.tipo === "TreatmentEpisode" && dadosEvento(e).episodioId === assinada.episodioId)!;
  const encerrado = { ...dadosEvento(original), fim: presente("2026-10-09") };
  const encerramentoId = a.seed("TreatmentEpisode", encerrado, "CONFIRMADO", original.eventId);
  const proximo = { ...contexto, encounterId: "encontro-apos-encerramento" };
  a.sessoes.selecionarConsulta(a.token, proximo);
  const r = await a.request(BASE, proximo);
  expect(r.status).toBe(200);
  const base = BasePrescricaoExecutavelResposta.parse(r.data);
  expect(base.pendencias).toEqual([]);
  expect(base.episodio).toBeNull();
  const continuar = await a.request(PREPARAR, { contexto: proximo, expectedBaseHash: base.revisao,
    idempotencyKey: "continuar-episodio-encerrado", edicao: edicao({
      planejamento: { modo: "NOVO_CICLO", linha: 1, intencao: "PALIATIVA", numeroCiclo: 2 },
    }) });
  expect(continuar.status).toBe(409);
  const nova = await a.request(PREPARAR, { contexto: proximo, expectedBaseHash: base.revisao,
    idempotencyKey: "nova-linha-apos-encerramento", edicao: edicao({ protocoloId: "novo-protocolo-sintetico",
      planejamento: { modo: "NOVA_LINHA", linha: 2, intencao: "PALIATIVA", numeroCiclo: 1 },
    }) });
  expect(nova.status).toBe(200);
  const previa = PrescricaoExecutavelPreparada.parse(nova.data);
  expect(previa.conteudo.contexto.episodioId).not.toBe(assinada.episodioId);
  const gravada = await a.request(CONFIRMAR, { contexto: proximo, draftId: previa.draftId,
    expectedRevision: previa.revision, conteudoHash: previa.conteudoHash, idempotencyKey: "assinar-nova-apos-encerramento" });
  expect(gravada.status).toBe(200);
  expect(dadosEvento(a.eventos().find(e => e.eventId === encerramentoId)!)).toEqual(encerrado);
  expect(a.eventos().find(e => e.eventId === original.eventId)).toEqual(original);
  expect(a.eventos().filter(e => e.tipo === "TreatmentAdministration")).toHaveLength(0);
});

it("prepara uma nova linha sem criar fato; assina documento, episódio e ciclo sem registrar administração", async () => {
  const a = await abrir();
  const antes = a.eventos();
  const base = await carregarBase(a);
  expect(base.contexto).toEqual(contexto);
  expect(base.episodio).toBeNull();
  expect(base.ciclo).toBeNull();
  expect(base.vigente).toBeNull();

  const pedido = PrepararPrescricaoExecutavelPedido.parse({ contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "preparo-nova-linha-sintetica", edicao: edicao() });
  const preparacao = await a.request(PREPARAR, pedido);
  expect(preparacao.status).toBe(200);
  const preparada = PrescricaoExecutavelPreparada.parse(preparacao.data);
  expect(preparada.conteudo.contexto).toMatchObject({ ...contexto, episodioId: expect.any(String), cicloId: expect.any(String) });
  expect(preparada.conteudo.itens[0]?.item).toMatchObject({ drug: "Fármaco citotóxico sintético",
    source: "MANUAL", classe: "QT", prescribedDose: 1.5, unit: "mg", route: "EV",
    overrideMotivo: "Escolha manual sintética explicitamente revisada." });
  expect(a.eventos()).toEqual(antes);

  const confirmado = await assinar(a, preparada, "assinar-nova-linha-sintetica");
  expect(confirmado.codigo).toBe("GRAVADA");
  expect(confirmado.documentId).toBe(preparada.conteudo.documentId);
  expect(confirmado.documentVersion).toBe(preparada.conteudo.documentVersion);
  expect(confirmado.episodioId).toBe(preparada.conteudo.contexto.episodioId);
  expect(confirmado.cicloId).toBe(preparada.conteudo.contexto.cicloId);

  const eventos = a.eventos();
  const documento = eventos.find(evento => evento.tipo === "DOCUMENTO"
    && assinaturaDocumento(evento).documentId === confirmado.documentId);
  const episodio = eventos.find(evento => evento.tipo === "TreatmentEpisode" && dadosEvento(evento).episodioId === confirmado.episodioId);
  const ciclo = eventos.find(evento => evento.tipo === "Ciclo" && dadosEvento(evento).cicloId === confirmado.cicloId);
  expect(documento?.revisao).toBe("ASSINADO");
  expect(documento).toBeTruthy();
  const envelopeDocumento = dadosEvento(documento!);
  const corpoDocumento = envelopeDocumento.data && typeof envelopeDocumento.data === "object"
    ? envelopeDocumento.data as Record<string, unknown> : {};
  expect(corpoDocumento.prescricao).toEqual(preparada.conteudo);
  expect(corpoDocumento.texto).toBe(preparada.texto);
  expect(assinaturaDocumento(documento!).documentHash).toBe(hashConteudoExibido(corpoDocumento));
  expect(episodio?.revisao).toBe("CONFIRMADO");
  expect(ciclo?.revisao).toBe("CONFIRMADO");
  expect(dadosEvento(ciclo!)).toMatchObject({ prescricaoRef: { documentId: confirmado.documentId,
    documentVersion: confirmado.documentVersion } });
  expect(eventos.filter(evento => evento.tipo === "TreatmentAdministration")).toHaveLength(0);
  expect(JSON.stringify(eventos)).not.toContain("farmacia.conferencia");
});

it("só enfileira estado ENVIADA na farmácia quando o médico marca o encaminhamento", async () => {
  const a = await abrir();
  const base = await carregarBase(a);
  const prepararPedido = PrepararPrescricaoExecutavelPedido.parse({ contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "preparo-com-farmacia-sintetico", edicao: edicao({ encaminharFarmacia: true }) });
  const resposta = await a.request(PREPARAR, prepararPedido);
  expect(resposta.status).toBe(200);
  const preparada = PrescricaoExecutavelPreparada.parse(resposta.data);
  const confirmado = await assinar(a, preparada, "assinar-com-farmacia-sintetico");
  expect(confirmado.codigo).toBe("GRAVADA");
  const eventos = a.eventos();
  expect(JSON.stringify(eventos)).toContain("farmacia.conferencia");
  expect(JSON.stringify(eventos)).toContain("ENVIADA");
  expect(eventos.filter(evento => evento.tipo === "TreatmentAdministration")).toHaveLength(0);
});

it("repete a mesma confirmação sem duplicar assinatura, episódio ou ciclo", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  const pedido = { contexto, draftId: preparada.draftId, expectedRevision: preparada.revision,
    conteudoHash: preparada.conteudoHash, idempotencyKey: "confirmacao-replay-sintetica" };
  const primeira = await a.request(CONFIRMAR, pedido);
  expect(primeira.status).toBe(200);
  const gravada = PrescricaoExecutavelConfirmada.parse(primeira.data);
  expect(gravada.codigo).toBe("GRAVADA");
  const eventosAposGravar = a.eventos();
  const replay = await a.request(CONFIRMAR, pedido);
  expect(replay.status).toBe(200);
  expect(PrescricaoExecutavelConfirmada.parse(replay.data)).toMatchObject({ ...gravada, codigo: "REPLAY" });
  expect(a.eventos()).toEqual(eventosAposGravar);
  expect(eventosAposGravar.filter(evento => evento.tipo === "DOCUMENTO" && assinaturaDocumento(evento).documentId === gravada.documentId)).toHaveLength(1);
  expect(eventosAposGravar.filter(evento => evento.tipo === "TreatmentEpisode" && dadosEvento(evento).episodioId === gravada.episodioId)).toHaveLength(1);
  expect(eventosAposGravar.filter(evento => evento.tipo === "Ciclo" && dadosEvento(evento).cicloId === gravada.cicloId)).toHaveLength(1);
});

it("nega sessão ausente, contexto da sessão trocado e hash de base obsoleto sem gravar eventos", async () => {
  const a = await abrir();
  const antes = a.eventos();
  expect((await a.request(BASE, contexto, "")).status).toBe(401);
  expect((await a.request(BASE, { ...contexto, encounterId: "outro-encontro-sintetico" })).status).toBe(409);
  const base = await carregarBase(a);
  const pedido = { contexto, expectedBaseHash: "0".repeat(64), idempotencyKey: "base-obsoleta-sintetica", edicao: edicao() };
  expect((await a.request(PREPARAR, pedido)).status).toBe(409);
  expect(a.eventos()).toEqual(antes);
  expect(base.contexto).toEqual(contexto);
});

it("nega confirmação com contexto ou revisão alterados e mantém a prévia sem promover", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  const antes = a.eventos();
  const basePedido = { draftId: preparada.draftId, expectedRevision: preparada.revision,
    conteudoHash: preparada.conteudoHash, idempotencyKey: "confirmacao-adversarial-sintetica" };
  expect((await a.request(CONFIRMAR, { ...basePedido, contexto: { ...contexto, patientId: "Paciente Teste 93" } })).status).toBe(409);
  expect((await a.request(CONFIRMAR, { ...basePedido, contexto, expectedRevision: preparada.revision + 1 })).status).toBe(409);
  expect((await a.request(CONFIRMAR, { ...basePedido, contexto, conteudoHash: "f".repeat(64) })).status).toBe(409);
  a.sessoes.selecionarConsulta(a.token, { ...contexto, encounterId: "outro-encontro-sintetico" });
  expect((await a.request(CONFIRMAR, { ...basePedido, contexto })).status).toBe(409);
  expect(a.eventos()).toEqual(antes);
});

it("não permite que /consulta/confirmar assine o draft dedicado da prescrição", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  const eventosAntes = a.eventos();
  const tentativa = await a.request("/consulta/confirmar", { ...contexto, bloco: "TUDO",
    registros: [{ id: preparada.draftId, expectedRevision: preparada.revision }], documentosExibidos: [],
    reconhecerAlertas: [], idempotencyKey: "promocao-generica-proibida-sintetica" });
  expect(tentativa.status).toBeGreaterThanOrEqual(400);
  expect(a.eventos()).toEqual(eventosAntes);
  expect(eventosAntes.filter(evento => evento.tipo === "DOCUMENTO" && assinaturaDocumento(evento).documentId === preparada.conteudo.documentId)).toHaveLength(0);
});

it("assina correção como nova versão superseding sem reescrever o documento histórico", async () => {
  const a = await abrir();
  const primeiraPreparacao = await prepararNovaLinha(a);
  const primeiraAssinatura = await assinar(a, primeiraPreparacao.preparada, "assinar-versao-1-sintetica");
  const documentoV1 = a.eventos().find(evento => evento.tipo === "DOCUMENTO"
    && assinaturaDocumento(evento).documentId === primeiraAssinatura.documentId)!;
  const snapshotV1 = structuredClone(documentoV1);

  const baseV2 = await carregarBase(a);
  expect(baseV2.vigente?.documentVersion).toBe(1);
  const itemV2 = { ...primeiraPreparacao.preparada.conteudo.itens[0]!, item: { ...primeiraPreparacao.preparada.conteudo.itens[0]!.item,
    prescribedDose: 2, overrideMotivo: "Correção sintética explicitamente solicitada." } };
  const edicaoV2 = edicao({ protocoloId: primeiraPreparacao.preparada.conteudo.protocoloId,
    dataPrevista: "2026-10-21", motivo: "Nova versão sintética para corrigir a dose prescrita.",
    planejamento: { modo: "CICLO_ATUAL", linha: 1, intencao: "PALIATIVA", numeroCiclo: 1 },
    itens: [itemV2], encaminharFarmacia: false });
  const preparacaoV2 = PrepararPrescricaoExecutavelPedido.parse({ contexto, expectedBaseHash: baseV2.revisao,
    idempotencyKey: "preparo-versao-2-sintetica", edicao: edicaoV2 });
  const respostaV2 = await a.request(PREPARAR, preparacaoV2);
  expect(respostaV2.status).toBe(200);
  const preparadaV2 = PrescricaoExecutavelPreparada.parse(respostaV2.data);
  const assinadaV2 = await assinar(a, preparadaV2, "assinar-versao-2-sintetica");
  expect(assinadaV2.documentId).toBe(primeiraAssinatura.documentId);
  expect(assinadaV2.documentVersion).toBe(2);

  const eventos = a.eventos();
  const documentos = eventos.filter(evento => evento.tipo === "DOCUMENTO"
    && assinaturaDocumento(evento).documentId === assinadaV2.documentId);
  expect(documentos).toHaveLength(2);
  expect(documentos.find(evento => assinaturaDocumento(evento).documentVersion === 1)).toEqual(snapshotV1);
  expect(documentos.find(evento => assinaturaDocumento(evento).documentVersion === 2)?.supersedesEventId).toBe(documentoV1.eventId);
  expect(eventos.filter(evento => evento.tipo === "TreatmentAdministration")).toHaveLength(0);
});

it("bloqueia nova prescrição do ciclo depois de existir administração efetiva", async () => {
  const a = await abrir();
  const primeiraPreparacao = await prepararNovaLinha(a);
  const assinada = await assinar(a, primeiraPreparacao.preparada, "assinar-para-administracao-sintetica");
  a.seed("TreatmentAdministration", {
    adminId: "administracao-sintetica-confirmada", cicloId: assinada.cicloId,
    prescricaoRef: { documentId: assinada.documentId, documentVersion: assinada.documentVersion },
    item: 1, droga: "Fármaco citotóxico sintético", quantidadeEfetivaMg: 1.5,
    status: "COMPLETA", motivo: null, inicio: AGORA, fim: AGORA, fonte: fonteSintetica("fonte-administracao-sintetica"),
  });
  const eventosAntes = a.eventos();
  const base = await a.request(BASE, contexto);
  if (base.status === 200) {
    const atual = BasePrescricaoExecutavelResposta.parse(base.data);
    const bloqueio = await a.request(PREPARAR, { contexto, expectedBaseHash: atual.revisao,
      idempotencyKey: "tentar-represcrever-administrado-sintetico", edicao: edicao({
        protocoloId: primeiraPreparacao.preparada.conteudo.protocoloId,
        planejamento: { modo: "CICLO_ATUAL", linha: 1, intencao: "PALIATIVA", numeroCiclo: 1 },
      }) });
    expect(bloqueio.status).toBeGreaterThanOrEqual(400);
  } else {
    expect(base.status).toBe(409);
  }
  expect(a.eventos()).toEqual(eventosAntes);
});

it("rejeita payload incompleto de item manual antes de persistir draft ou evento", async () => {
  const a = await abrir();
  const base = await carregarBase(a);
  const antes = a.eventos();
  const invalida = edicao({ itens: [{ ...itemPrescrito(), item: { ...itemPrescrito().item, overrideMotivo: null } }] });
  const resposta = await a.request(PREPARAR, { contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "item-manual-sem-motivo-sintetico", edicao: invalida });
  expect(resposta.status).toBe(400);
  expect(a.eventos()).toEqual(antes);
});

it("invalida a prévia se um fato clínico novo entra no ledger antes da assinatura", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  a.seed("FATO", { campo: "nota.sintetica", valor: "Fato sintético independente da prescrição" });
  const eventosComFato = a.eventos();
  const resposta = await a.request(CONFIRMAR, { contexto, draftId: preparada.draftId,
    expectedRevision: preparada.revision, conteudoHash: preparada.conteudoHash,
    idempotencyKey: "base-clinica-alterada-apos-preparo" });
  expect(resposta.status).toBe(409);
  expect(a.eventos()).toEqual(eventosComFato);
  expect(eventosComFato.filter(evento => evento.tipo === "DOCUMENTO"
    && assinaturaDocumento(evento).documentId === preparada.conteudo.documentId)).toHaveLength(0);
});

it("rejeita segunda prévia quando outra sessão já assinou a primeira sobre a mesma base", async () => {
  const a = await abrir();
  const baseA = await carregarBase(a);
  const pedidoA = PrepararPrescricaoExecutavelPedido.parse({ contexto, expectedBaseHash: baseA.revisao,
    idempotencyKey: "concorrente-a-sintetico", edicao: edicao() });
  const preparoA = await a.request(PREPARAR, pedidoA);
  expect(preparoA.status).toBe(200);
  const preparadaA = PrescricaoExecutavelPreparada.parse(preparoA.data);

  const sessaoB = a.sessoes.login(SENHA)!;
  a.sessoes.selecionarConsulta(sessaoB.token, contexto);
  expect(a.sessoes.obter(sessaoB.token)?.medicoId).toBe(a.sessoes.obter(a.token)?.medicoId);
  const baseB = await a.request(BASE, contexto, sessaoB.token);
  expect(baseB.status).toBe(200);
  const revisaoB = BasePrescricaoExecutavelResposta.parse(baseB.data);
  expect(revisaoB.revisao).toBe(baseA.revisao);
  const pedidoB = PrepararPrescricaoExecutavelPedido.parse({ contexto, expectedBaseHash: revisaoB.revisao,
    idempotencyKey: "concorrente-b-sintetico", edicao: edicao({ motivo: "Prévia concorrente sintética B." }) });
  const preparoB = await a.request(PREPARAR, pedidoB, sessaoB.token);
  expect(preparoB.status).toBe(200);
  const preparadaB = PrescricaoExecutavelPreparada.parse(preparoB.data);

  const gravadaA = await assinar(a, preparadaA, "assinar-concorrente-a-sintetico");
  const eventosAposA = a.eventos();
  const rejeitadaB = await a.request(CONFIRMAR, { contexto, draftId: preparadaB.draftId,
    expectedRevision: preparadaB.revision, conteudoHash: preparadaB.conteudoHash,
    idempotencyKey: "assinar-concorrente-b-sintetico" }, sessaoB.token);
  expect(rejeitadaB.status).toBe(409);
  expect(a.eventos()).toEqual(eventosAposA);
  expect(eventosAposA.filter(evento => evento.tipo === "DOCUMENTO"
    && assinaturaDocumento(evento).documentId === gravadaA.documentId)).toHaveLength(1);
});

it("recusa origem PROTOCOL sem referência de proposta validada", async () => {
  const a = await abrir();
  const base = await carregarBase(a);
  const antes = a.eventos();
  const itemProtocolar = { ...itemPrescrito(), item: { ...itemPrescrito().item,
    source: "PROTOCOL" as const, overrideMotivo: null } };
  const resposta = await a.request(PREPARAR, { contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "origem-protocolo-sem-fonte-sintetica", edicao: edicao({ itens: [itemProtocolar] }) });
  expect(resposta.status).toBeGreaterThanOrEqual(400);
  expect(a.eventos()).toEqual(antes);
  expect(listarDrafts(a.db, PACIENTE).some(draft => draft.draftId.startsWith("rx-preparada:"))).toBe(false);
});

it.each(["documentId", "documentVersion", "signature"])("rejeita %s fornecido pelo cliente", async campo => {
  const a = await abrir();
  const base = await carregarBase(a);
  const antes = a.eventos();
  const pedido = { contexto, expectedBaseHash: base.revisao,
    idempotencyKey: `campo-assinatura-cliente-${campo}`, edicao: edicao(),
    [campo]: campo === "documentVersion" ? 99 : campo === "signature" ? { serverActorId: "medico-falso" } : "documento-falso" };
  const resposta = await a.request(PREPARAR, pedido);
  expect(resposta.status).toBe(400);
  expect(a.eventos()).toEqual(antes);
  expect(listarDrafts(a.db, PACIENTE).some(draft => draft.draftId.startsWith("rx-preparada:"))).toBe(false);
});

it("exige recibo de exibição na mesma sessão mesmo para o mesmo médico e contexto", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  const outraSessao = a.sessoes.login(SENHA)!;
  a.sessoes.selecionarConsulta(outraSessao.token, contexto);
  expect(outraSessao.sessao.medicoId).toBe(a.sessoes.obter(a.token)?.medicoId);
  const antes = a.eventos();
  const resposta = await a.request(CONFIRMAR, { contexto, draftId: preparada.draftId,
    expectedRevision: preparada.revision, conteudoHash: preparada.conteudoHash,
    idempotencyKey: "confirmar-sem-recibo-sintetico" }, outraSessao.token);
  expect(resposta.status).toBe(409);
  expect(a.eventos()).toEqual(antes);
});

it("rollback atômico preserva preparação em falha SQLite e permite retry do mesmo pedido", async () => {
  const a = await abrir();
  const base = await carregarBase(a);
  const pedidoPreparo = PrepararPrescricaoExecutavelPedido.parse({ contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "preparo-rollback-sintetico", edicao: edicao({ encaminharFarmacia: true }) });
  const respostaPreparo = await a.request(PREPARAR, pedidoPreparo);
  expect(respostaPreparo.status).toBe(200);
  const preparada = PrescricaoExecutavelPreparada.parse(respostaPreparo.data);
  const pedidoConfirmacao = { contexto, draftId: preparada.draftId, expectedRevision: preparada.revision,
    conteudoHash: preparada.conteudoHash, idempotencyKey: "confirmar-rollback-sintetico" };
  const eventosAntes = a.eventos();
  const trigger = "abortar_ciclo_prescricao_sintetica";
  a.db.exec(`CREATE TRIGGER ${trigger} BEFORE INSERT ON clinical_event
    WHEN NEW.tipo = 'Ciclo' BEGIN SELECT RAISE(ABORT, 'falha sintética de ciclo'); END;`);
  try {
    const tentativa = await a.request(CONFIRMAR, pedidoConfirmacao);
    expect(tentativa.status).toBeGreaterThanOrEqual(400);
    expect(a.eventos()).toEqual(eventosAntes);
    expect(listarDrafts(a.db, PACIENTE).find(draft => draft.draftId === preparada.draftId)?.revision).toBe(0);
    expect(listarDrafts(a.db, PACIENTE).filter(draft => JSON.stringify(draft.payload).includes("PRESCRICAO_EXECUTAVEL_AUXILIAR"))).toHaveLength(0);
  } finally {
    a.db.exec(`DROP TRIGGER IF EXISTS ${trigger}`);
  }

  const retry = await a.request(CONFIRMAR, pedidoConfirmacao);
  expect(retry.status).toBe(200);
  expect(PrescricaoExecutavelConfirmada.parse(retry.data).codigo).toBe("GRAVADA");
  expect(a.eventos().filter(evento => evento.tipo === "DOCUMENTO"
    && assinaturaDocumento(evento).documentId === preparada.conteudo.documentId)).toHaveLength(1);
  expect(a.eventos().filter(evento => evento.tipo === "TreatmentEpisode"
    && dadosEvento(evento).episodioId === preparada.conteudo.contexto.episodioId)).toHaveLength(1);
  expect(a.eventos().filter(evento => evento.tipo === "Ciclo"
    && dadosEvento(evento).cicloId === preparada.conteudo.contexto.cicloId)).toHaveLength(1);
  expect(JSON.stringify(a.eventos())).toContain("farmacia.conferencia");
});

it("resolve a nova linha vigente no próximo encontro sem inventar encerramento da linha anterior", async () => {
  const a = await abrir();
  const contextoA = contexto;
  const baseA = await carregarBase(a);
  const preparoAResponse = await a.request(PREPARAR, { contexto: contextoA, expectedBaseHash: baseA.revisao,
    idempotencyKey: "nova-linha-a-encontro-1", edicao: edicao({ protocoloId: "protocolo-linha-1-sintetico" }) });
  expect(preparoAResponse.status).toBe(200);
  const preparoA = PrescricaoExecutavelPreparada.parse(preparoAResponse.data);
  const assinadaA = await a.request(CONFIRMAR, { contexto: contextoA, draftId: preparoA.draftId,
    expectedRevision: preparoA.revision, conteudoHash: preparoA.conteudoHash,
    idempotencyKey: "assinar-linha-a-encontro-1" });
  expect(assinadaA.status).toBe(200);
  const respostaA = PrescricaoExecutavelConfirmada.parse(assinadaA.data);
  const eventoA = a.eventos().find(evento => evento.tipo === "TreatmentEpisode"
    && dadosEvento(evento).episodioId === respostaA.episodioId)!;
  expect(eventoA).toBeTruthy();

  const contextoB = { ...contexto, encounterId: "encontro-linha-b-sintetico" };
  a.sessoes.selecionarConsulta(a.token, contextoB);
  const baseBResponse = await a.request(BASE, contextoB);
  expect(baseBResponse.status).toBe(200);
  const baseB = BasePrescricaoExecutavelResposta.parse(baseBResponse.data);
  expect(baseB.ciclo).toBeNull();
  expect(baseB.episodio?.episodioId).toBe(respostaA.episodioId);
  const preparoBResponse = await a.request(PREPARAR, { contexto: contextoB, expectedBaseHash: baseB.revisao,
    idempotencyKey: "nova-linha-b-encontro-2", edicao: edicao({ protocoloId: "protocolo-linha-2-sintetico",
      motivo: "Nova linha sintética para próximo encontro.", planejamento: {
        modo: "NOVA_LINHA", linha: 2, intencao: "PALIATIVA", numeroCiclo: 1,
      } }) });
  expect(preparoBResponse.status).toBe(200);
  const preparoB = PrescricaoExecutavelPreparada.parse(preparoBResponse.data);
  const assinadaB = await a.request(CONFIRMAR, { contexto: contextoB, draftId: preparoB.draftId,
    expectedRevision: preparoB.revision, conteudoHash: preparoB.conteudoHash,
    idempotencyKey: "assinar-linha-b-encontro-2" });
  expect(assinadaB.status).toBe(200);
  const respostaB = PrescricaoExecutavelConfirmada.parse(assinadaB.data);
  expect(respostaB.episodioId).not.toBe(respostaA.episodioId);

  const contextoC = { ...contexto, encounterId: "encontro-linha-c-sintetico" };
  a.sessoes.selecionarConsulta(a.token, contextoC);
  const baseCResponse = await a.request(BASE, contextoC);
  expect(baseCResponse.status).toBe(200);
  const baseC = BasePrescricaoExecutavelResposta.parse(baseCResponse.data);
  expect(baseC.pendencias).toEqual([]);
  expect(baseC.ciclo).toBeNull();
  expect(baseC.episodio?.episodioId).toBe(respostaB.episodioId);

  const eventoAHistorico = a.eventos().find(evento => evento.eventId === eventoA.eventId)!;
  expect(eventoAHistorico).toEqual(eventoA);
  expect((dadosEvento(eventoAHistorico).fim as { valor?: unknown }).valor).toBeNull();
});

it("nega dose final que contradiz cálculo e percentual informado em item manual", async () => {
  const a = await abrir();
  const base = await carregarBase(a);
  const contraditoria = { ...itemPrescrito(50), item: { ...itemPrescrito(50).item,
    standardDose: 100, calculatedDose: 100, adjustmentPercent: -25,
    adjustmentReason: "Ajuste sintético informado, mas dose final inconsistente." } };
  const antes = a.eventos();
  const resposta = await a.request(PREPARAR, { contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "dose-manual-incoerente-sintetica", edicao: edicao({ itens: [contraditoria] }) });
  expect(resposta.status).toBe(409);
  expect(a.eventos()).toEqual(antes);
  expect(listarDrafts(a.db, PACIENTE).some(draft => draft.draftId.startsWith("rx-preparada:"))).toBe(false);
});

it("preserva percentual ausente como null na redução do Ciclo para dose manual declarada", async () => {
  const a = await abrir();
  const { preparada } = await prepararNovaLinha(a);
  const confirmada = await assinar(a, preparada, "assinar-dose-sem-percentual-sintetica");
  const ciclo = a.eventos().find(evento => evento.tipo === "Ciclo" && dadosEvento(evento).cicloId === confirmada.cicloId)!;
  const dados = dadosEvento(ciclo);
  const itens = dados.itens as Array<{ reducaoPct: number | null }>;
  expect(itens[0]?.reducaoPct).toBeNull();
});

it("não mantém origem PROTOCOL ao alterar dose final sem conversão manual explícita", async () => {
  const a = await abrir();
  const contextoExecutavel = { ...contexto, episodioId: "episodio-protocolo-tipado-sintetico",
    cicloId: "ciclo-protocolo-tipado-sintetico" };
  const itemProtocolar = { itemId: "item-protocolo-tipado-sintetico", item: {
    drug: "Fármaco protocolar sintético", classe: "QT" as const, sequence: 1,
    standardDose: 100, doseBasis: "FIXED" as const, calculatedDose: 100, prescribedDose: 100, unit: "mg",
    adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "SF 0,9%", finalVolumeMl: 250,
    infusionTime: "60 min", days: ["d1"], observacao: null, source: "PROTOCOL" as const, overrideMotivo: null,
  } };
  const conteudo = ConteudoPrescricaoExecutavel.parse({ schema: "PrescricaoExecutavel@1",
    contexto: contextoExecutavel, documentId: "prescricao-protocolo-tipado-sintetico", documentVersion: 1,
    protocoloId: "protocolo-tipado-sintetico", dataPrevista: "2026-10-20",
    motivo: "Prescrição protocolar inteiramente sintética.", itens: [itemProtocolar], origemProposta: null });
  const documento = { documentId: conteudo.documentId, documentVersion: conteudo.documentVersion,
    tipoDocumento: "PRESCRICAO_QT", texto: "Documento protocolar sintético assinado.",
    contexto: conteudo.contexto, prescricao: conteudo };
  a.seed("TreatmentEpisode", { episodioId: contextoExecutavel.episodioId,
    tumorLotId: contexto.tumorLotId, modalidade: "QT", intencao: "PALIATIVA", intentModifier: null,
    linha: 1, esquemaId: conteudo.protocoloId, inicio: ausente<string>(), fim: ausente<string>() });
  a.seed("DOCUMENTO", (_eventId: string, reviewDecisionId: string) => ({ data: documento, signature: {
    documentId: documento.documentId, documentVersion: documento.documentVersion,
    documentHash: hashConteudoExibido(documento), reviewDecisionId,
    serverActorId: a.sessoes.obter(a.token)!.medicoId,
  } }), "ASSINADO");
  a.seed("Ciclo", { cicloId: contextoExecutavel.cicloId, episodioId: contextoExecutavel.episodioId,
    numero: 1, previstoEm: conteudo.dataPrevista, pesoKg: presente(70), origemPeso: "MEDIDO",
    ciclosSemPesoConsecutivos: 0, prescricaoRef: { documentId: documento.documentId, documentVersion: 1 },
    itens: [{ item: 1, droga: "Fármaco protocolar sintético", doseMg: 100, reducaoPct: 0 }], comMedico: true });

  const base = await carregarBase(a);
  expect(base.vigente?.itens[0]?.item.source).toBe("PROTOCOL");
  const alteradoSemConverter = { ...itemProtocolar, item: { ...itemProtocolar.item, prescribedDose: 50 } };
  const antes = a.eventos();
  const resposta = await a.request(PREPARAR, { contexto, expectedBaseHash: base.revisao,
    idempotencyKey: "alterar-dose-protocolo-sem-manual-sintetico", edicao: edicao({
      protocoloId: conteudo.protocoloId, dataPrevista: "2026-10-21",
      motivo: "Dose final alterada sem marcar origem manual.",
      planejamento: { modo: "CICLO_ATUAL", linha: 1, intencao: "PALIATIVA", numeroCiclo: 1 },
      itens: [alteradoSemConverter],
    }) });
  expect(resposta.status).toBe(409);
  expect(a.eventos()).toEqual(antes);
  expect(listarDrafts(a.db, PACIENTE).some(draft => draft.draftId.startsWith("rx-preparada:"))).toBe(false);
});
