import { afterEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CatalogoFichasRespostaSchema, FichaProtocoloCatalogoSchema,
  InstanciacaoFichaRespostaSchema } from "../../src/contracts/api/fichasPrescricao.js";
import { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";
import { confirmar, salvarDraft } from "../../src/kernel/ledger/writeRouter.js";
import { carregarCorpusServidor } from "../../src/server/corpus.js";
import { presente, ausente, fonteSintetica } from "../fixtures/triagem.js";
import { ambienteHttp } from "./http-fixture.js";

const AGORA = "2026-10-05T12:00:00Z";
const DATA = "2026-10-05";
const contexto = { patientId: "paciente-f4-19-sintetico", encounterId: "encontro-f4-19-sintetico",
  tumorLotId: "lote-f4-19-sintetico" };
const ambientes: Array<Awaited<ReturnType<typeof ambienteHttp>>> = [];

afterEach(async () => {
  for (const ambiente of ambientes.splice(0)) await ambiente.close();
});

function fichaSintetica() {
  return ProtocolTemplate.parse({ templateId: "ficha-f4-19-sintetica", versao: "1.0.0", hash: "rótulo-sintético",
    status: "RASCUNHO", nome: "Ficha sintética F4-19", tumor: "Tumor sintético", cenario: "Fixture de software",
    codigoInstitucional: null, intervaloDias: 21, ciclos: 4, fonte: "Fonte inteiramente sintética", limiaresBula: null,
    itens: [{ drug: "doxorrubicina", classe: "QT", sequence: 1, standardDose: 1, doseBasis: "FIXED",
      calculatedDose: null, prescribedDose: null, unit: "mg", adjustmentPercent: null, adjustmentReason: null,
      route: "EV", diluent: null, finalVolumeMl: null, infusionTime: null, days: ["d1"], observacao: null,
      source: "PROTOCOL", overrideMotivo: null }] });
}

function fonte(id: string) {
  return { ...fonteSintetica(id), dataClinica: DATA, dataCaptura: AGORA,
    contentHash: createHash("sha256").update(id).digest("hex") };
}

function semear(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, entrada: {
  id: string; tipo: string; payload: unknown; tumorLotId?: string | null;
}) {
  const eventoFonte = fonte(`fonte-${entrada.id}`);
  salvarDraft(ambiente.db, { draftId: `draft-${entrada.id}`, patientId: contexto.patientId,
    sourceId: eventoFonte.sourceId, rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  const sessao = ambiente.sessoes.obter(ambiente.token);
  if (!sessao) throw new Error("SESSAO_SINTETICA_AUSENTE");
  const gravacao = confirmar(ambiente.db, { operationId: `op-${entrada.id}`, patientId: contexto.patientId,
    tumorLotId: entrada.tumorLotId === undefined ? contexto.tumorLotId : entrada.tumorLotId,
    encounterId: contexto.encounterId, reviewDecisionId: `review-${entrada.id}`, sessao, em: AGORA,
    registros: [{ draftId: `draft-${entrada.id}`, expectedRevision: 0, eventId: entrada.id, tipo: entrada.tipo,
      payload: entrada.payload, fontes: [eventoFonte], revisao: "CONFIRMADO" }] });
  expect(gravacao.estado, JSON.stringify(gravacao)).toBe("GRAVADA");
}

async function abrir(corpus: ReturnType<typeof carregarCorpusServidor>) {
  const ambiente = await ambienteHttp({ corpus });
  ambientes.push(ambiente);
  semear(ambiente, { id: "cadastro-f4-19", tipo: "Paciente", tumorLotId: null,
    payload: { patientId: contexto.patientId, identificadores: [], nome: "Paciente sintético F4-19",
      nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false } });
  semear(ambiente, { id: "agenda-f4-19", tipo: "AgendaEntry",
    payload: { patientId: contexto.patientId, encounterId: contexto.encounterId, horario: "09:00", data: DATA } });
  semear(ambiente, { id: "lote-f4-19", tipo: "TumorLot", payload: { patientId: contexto.patientId,
    tumorLotId: contexto.tumorLotId, cid: presente("C50"), topografia: presente("Topografia sintética"),
    histologia: presente("Histologia sintética"), estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] } });
  semear(ambiente, { id: "episodio-f4-19", tipo: "TreatmentEpisode", payload: { episodioId: "episodio-f4-19-sintetico",
    tumorLotId: contexto.tumorLotId, modalidade: "QT", intencao: "PALIATIVA", intentModifier: null,
    linha: 1, esquemaId: "ficha-f4-19-sintetica", inicio: presente(DATA), fim: ausente() } });
  semear(ambiente, { id: "ciclo-f4-19", tipo: "Ciclo", payload: { cicloId: "ciclo-f4-19-sintetico",
    episodioId: "episodio-f4-19-sintetico", numero: 4, previstoEm: DATA, pesoKg: presente(70), origemPeso: "MEDIDO",
    ciclosSemPesoConsecutivos: 0, prescricaoRef: { documentId: "prescricao-sintetica-f4-19", documentVersion: 1 },
    itens: [{ item: 1, droga: "doxorrubicina", doseMg: 1, reducaoPct: null }], comMedico: true } });
  semear(ambiente, { id: "feve-f4-19", tipo: "FATO",
    payload: { campo: "feve", valor: { percentual: 40, metodo: "ECO", data: DATA } } });
  semear(ambiente, { id: "medicamentos-f4-19", tipo: "FATO",
    payload: { campo: "medicamentos", valor: ["capecitabina", "varfarina"] } });
  semear(ambiente, { id: "exposicao-f4-19", tipo: "FATO", payload: { campo: "exposicaoCumulativa",
    valor: { patientId: contexto.patientId, droga: "doxorrubicina", historicoCompleto: true,
      fonteCompletude: "fonte-completude-f4-19", administracoes: [{ adminId: "administracao-f4-19",
        patientId: contexto.patientId, episodioId: "episodio-f4-19-sintetico", droga: "doxorrubicina",
        status: "COMPLETA", quantidadeEfetivaMgM2: 550, unidade: "mg/m2", fonte: "fonte-administracao-f4-19",
        realizadaEm: AGORA }] } }, tumorLotId: null });
  const carregada = await ambiente.request("/consulta/carregar", "POST", JSON.stringify(contexto), ambiente.token, "application/json");
  expect(carregada.status, carregada.body).toBe(200);
  return ambiente;
}

async function instanciar(ambiente: Awaited<ReturnType<typeof ambienteHttp>>) {
  const lista = await ambiente.request("/consulta/prescricao/fichas/listar", "POST", "{}", ambiente.token, "application/json");
  expect(lista.status, lista.body).toBe(200);
  const catalogo = CatalogoFichasRespostaSchema.parse(JSON.parse(lista.body) as unknown);
  expect(catalogo.fichas).toHaveLength(1);
  const ficha = catalogo.fichas[0]!;
  const revisar = await ambiente.request("/consulta/prescricao/fichas/revisar", "POST", JSON.stringify({
    templateId: ficha.template.templateId, versao: ficha.template.versao, expectedContentHash: ficha.contentHash,
    expectedRevision: ficha.revision, decisao: "CONFERIR", motivo: "Conferência sintética de software",
    idempotencyKey: "revisar-ficha-f4-19",
  }), ambiente.token, "application/json");
  expect(revisar.status, revisar.body).toBe(200);
  const fichaRevisada = FichaProtocoloCatalogoSchema.parse(JSON.parse(revisar.body) as unknown);
  const resposta = await ambiente.request("/consulta/prescricao/fichas/instanciar", "POST", JSON.stringify({
    contexto, templateId: fichaRevisada.template.templateId, versao: fichaRevisada.template.versao,
    expectedContentHash: fichaRevisada.contentHash, expectedRevision: fichaRevisada.revision,
    idempotencyKey: "instanciar-ficha-f4-19",
  }), ambiente.token, "application/json");
  expect(resposta.status, resposta.body).toBe(200);
  return InstanciacaoFichaRespostaSchema.parse(JSON.parse(resposta.body) as unknown);
}

it("instanciarFichaPrescricao preserva avisos de FEVE, interação e teto do corpus; sem regras, esses avisos não aparecem", async () => {
  const protocolo = fichaSintetica();
  const corpusReal = carregarCorpusServidor();
  expect(corpusReal.feveRuleset.classes.some(classe => classe.sinonimos.includes("doxorrubicina"))).toBe(true);
  const regrasInteracao = corpusReal.interacoes?.interacoes ?? [];
  expect(regrasInteracao.some(regra => regra.ativo === true && regra.drogaA === "capecitabina"
    && regra.drogaBouClasse === "varfarina")).toBe(true);
  expect(corpusReal.tetosCumulativos.some(teto => teto.droga === "doxorrubicina" && teto.maximo === 550)).toBe(true);
  const comRegras = await abrir({ ...corpusReal, templatesProtocolo: [protocolo] });
  const eventosAntes = Number((comRegras.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n);
  const origemComRegras = await instanciar(comRegras);

  expect(origemComRegras.avisos).toEqual(expect.arrayContaining([
    expect.stringContaining("FEVE 40%"),
    expect.stringContaining("interação ativa: capecitabina × varfarina"),
    expect.stringContaining("doxorrubicina: dose acumulada chegou no teto"),
  ]));
  expect(origemComRegras).toMatchObject({ contexto, template: { templateId: protocolo.templateId },
    itens: [{ item: { drug: "doxorrubicina" } }] });
  expect(Number((comRegras.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n)).toBe(eventosAntes);

  const { feveRuleset, interacoes, tetosCumulativos: _tetos, ...semRegrasBase } = corpusReal;
  const semRegras = await abrir({ ...semRegrasBase, templatesProtocolo: [protocolo],
    feveRuleset: { ...feveRuleset, classes: [] }, interacoes: { ...interacoes, interacoes: [] }, tetosCumulativos: [] });
  const origemSemRegras = await instanciar(semRegras);
  expect(origemSemRegras.avisos.some(aviso => aviso.includes("FEVE 40%"))).toBe(false);
  expect(origemSemRegras.avisos.some(aviso => aviso.includes("interação ativa: capecitabina × varfarina"))).toBe(false);
  expect(origemSemRegras.avisos.some(aviso => aviso.includes("dose acumulada chegou no teto"))).toBe(false);
});
