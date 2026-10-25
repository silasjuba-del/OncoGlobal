import { afterEach, expect, it } from "vitest";
import { z } from "zod";
import type { ServidorDeps } from "../../src/server/rotas.js";
import { ConsultaResposta } from "../../src/contracts/api/respostas.js";
import { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";
import { confirmar, salvarDraft } from "../../src/kernel/ledger/writeRouter.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { ausente, fonteSintetica, presente } from "../fixtures/triagem.js";
import { ambienteHttp } from "./http-fixture.js";
import {carregarCorpusServidor} from '../../src/server/corpus.js';

const AGORA = "2026-10-05T12:00:00Z";
const DATA = "2026-10-05";
const PACIENTE = "paciente-l4-projecao-sintetico";
const LOTE = "lote-l4-projecao-sintetico";
const EPISODIO = "episodio-l4-projecao-sintetico";
const ENCONTRO_ATUAL = "encontro-l4-projecao-atual";
const ambientes: Array<Awaited<ReturnType<typeof ambienteHttp>>> = [];

afterEach(async () => {
  for (const ambiente of ambientes.splice(0)) await ambiente.close();
});

async function abrir(corpus?: Pick<NonNullable<ServidorDeps["corpus"]>, "templatesProtocolo">) {
  const ambiente = await ambienteHttp(corpus ? { corpus: {...carregarCorpusServidor(),...corpus} } : {});
  ambientes.push(ambiente);
  return ambiente;
}

function gravar(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, entrada: {
  id: string;
  encounterId: string;
  tumorLotId: string | null;
  tipo: string;
  payload: unknown;
  patientId?: string;
}) {
  const patientId = entrada.patientId ?? PACIENTE;
  const fonte = { ...fonteSintetica(`fonte-${entrada.id}`), dataClinica: DATA, dataCaptura: AGORA,
    contentHash: "a".repeat(64) };
  salvarDraft(ambiente.db, { draftId: `draft-${entrada.id}`, patientId, sourceId: fonte.sourceId,
    rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  const sessao = ambiente.sessoes.obter(ambiente.token);
  if (!sessao) throw new Error("SESSAO_SINTETICA_AUSENTE");
  const resultado = confirmar(ambiente.db, { operationId: `op-${entrada.id}`, patientId,
    tumorLotId: entrada.tumorLotId, encounterId: entrada.encounterId, reviewDecisionId: `review-${entrada.id}`,
    sessao, em: AGORA, registros: [{ draftId: `draft-${entrada.id}`, expectedRevision: 0,
      eventId: entrada.id, tipo: entrada.tipo, payload: entrada.payload, fontes: [fonte], revisao: "CONFIRMADO" }] });
  expect(resultado.estado, JSON.stringify(resultado)).toBe("GRAVADA");
}

function respostaConsulta(body: string) {
  return ConsultaResposta.parse(JSON.parse(body) as unknown);
}

async function carregar(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, contexto: {
  patientId: string; encounterId: string; tumorLotId: string | null;
}) {
  const resposta = await ambiente.request("/consulta/carregar", "POST", JSON.stringify(contexto), ambiente.token, "application/json");
  expect(resposta.status, resposta.body).toBe(200);
  return respostaConsulta(resposta.body);
}

function semearPacienteELote(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, encounterId: string, ciclo?: number) {
  gravar(ambiente, { id: "cadastro-l4-projecao", encounterId, tumorLotId: null, tipo: "Paciente",
    payload: { patientId: PACIENTE, identificadores: [], nome: PACIENTE, nascimento: null,
      sexoCadastral: "NAO_INFORMADO", divergencia: false } });
  gravar(ambiente, { id: "agenda-l4-projecao", encounterId, tumorLotId: LOTE, tipo: "AgendaEntry",
    payload: { patientId: PACIENTE, encounterId, horario: "09:00", data: DATA } });
  gravar(ambiente, { id: "lote-l4-projecao", encounterId, tumorLotId: LOTE, tipo: "TumorLot",
    payload: { tumorLotId: LOTE, patientId: PACIENTE, cid: ausente(), topografia: ausente(), histologia: ausente(),
      estadiamentos: [], finalidadeApac: ausente(), marcos: [] } });
  gravar(ambiente, { id: "episodio-l4-projecao", encounterId, tumorLotId: LOTE, tipo: "TreatmentEpisode",
    payload: { episodioId: EPISODIO, tumorLotId: LOTE, modalidade: "QT", intencao: "PALIATIVA",
      intentModifier: null, linha: 1, esquemaId: "esquema-sintetico-l4", inicio: presente(DATA), fim: ausente() } });
  if (ciclo !== undefined) {
    gravar(ambiente, { id: `ciclo-l4-projecao-${ciclo}`, encounterId, tumorLotId: LOTE, tipo: "Ciclo",
      payload: { cicloId: `ciclo-l4-projecao-${ciclo}`, episodioId: EPISODIO, numero: ciclo, previstoEm: DATA,
        pesoKg: presente(70), origemPeso: "MEDIDO", ciclosSemPesoConsecutivos: 0,
        prescricaoRef: { documentId: `prescricao-sintetica-${ciclo}`, documentVersion: 1 },
        itens: [{ item: 1, droga: "doxorrubicina", doseMg: 1, reducaoPct: null }], comMedico: true } });
  }
}

it("medicamento de encontro anterior não preenche a lista atual; reconciliação explícita grava e é recuperada", async () => {
  const ambiente = await abrir();
  const encontroAnterior = "encontro-l4-projecao-anterior";
  semearPacienteELote(ambiente, ENCONTRO_ATUAL);
  gravar(ambiente, { id: "agenda-l4-projecao-anterior", encounterId: encontroAnterior, tumorLotId: null,
    tipo: "AgendaEntry", payload: { patientId: PACIENTE, encounterId: encontroAnterior, horario: "09:00", data: "2026-10-01" } });
  gravar(ambiente, { id: "medicamentos-l4-anteriores", encounterId: encontroAnterior, tumorLotId: null,
    tipo: "FATO", payload: { campo: "medicamentos", valor: ["medicamento sintético anterior"], dataClinica: "2026-10-01" } });

  const contexto = { patientId: PACIENTE, encounterId: ENCONTRO_ATUAL, tumorLotId: LOTE };
  const antes = await carregar(ambiente, contexto);
  expect(antes.medicamentosAtuais).toMatchObject({ medicamentos: [], conflito: false, confirmadoNesteEncontro: false });
  expect(antes.medicamentosAtuais?.eventId).toBe("medicamentos-l4-anteriores");

  const reconciliacao = await ambiente.request("/consulta/medicamentos/reconciliar", "POST", JSON.stringify({
    ...contexto, operationId: "reconciliar-medicamentos-l4-atual", expectedEventId: antes.medicamentosAtuais?.eventId ?? null,
    medicamentos: ["medicamento sintético atual"], listaAtualCompleta: true,
  }), ambiente.token, "application/json");
  expect(reconciliacao.status, reconciliacao.body).toBe(201);
  const gravada = z.object({ codigo: z.literal("GRAVADA"), eventId: z.string().min(1) })
    .parse(JSON.parse(reconciliacao.body) as unknown);
  const eventos = listarEventos(ambiente.db, PACIENTE);
  const eventoAtual = eventos.find(evento => evento.eventId === gravada.eventId);
  expect(eventoAtual).toMatchObject({ encounterId: ENCONTRO_ATUAL, tumorLotId: LOTE,
    supersedesEventId: "medicamentos-l4-anteriores", revisao: "CONFIRMADO" });

  const recuperada = await carregar(ambiente, contexto);
  expect(recuperada.medicamentosAtuais).toMatchObject({ eventId: gravada.eventId,
    medicamentos: ["medicamento sintético atual"], conflito: false, confirmadoNesteEncontro: true });
});

it.each([3, 4, 5])("Flash sinaliza cumulativo indeterminado sem clique a partir do ciclo %i", async numeroCiclo => {
  const ambiente = await abrir();
  const encontro = `encontro-l4-projecao-ciclo-${numeroCiclo}`;
  semearPacienteELote(ambiente, encontro, numeroCiclo);
  gravar(ambiente, { id: `exposicao-l4-indeterminada-${numeroCiclo}`, encounterId: encontro, tumorLotId: LOTE,
    tipo: "FATO", payload: { campo: "exposicaoCumulativa", valor: { patientId: PACIENTE, droga: "doxorrubicina",
      administracoes: [], historicoCompleto: null, fonteCompletude: null } } });

  // A leitura HTTP é a única ação depois da semeadura: o aviso não depende de clique nem ciência.
  const consulta = await carregar(ambiente, { patientId: PACIENTE, encounterId: encontro, tumorLotId: LOTE });
  const avisos = consulta.flash?.avisos ?? [];
  const aviso = `Ciclo ${numeroCiclo}: doxorrubicina — exposição cumulativa indeterminada. Conferir histórico e doses.`;
  if (numeroCiclo === 3) expect(avisos).not.toContain(aviso);
  else expect(avisos).toContain(aviso);
});

it("templateId duplicado retorna TEMPLATE_AMBIGUO sem criar draft nem evento", async () => {
  const template = ProtocolTemplate.parse({ templateId: "template-duplicado-l4-sintetico", tumor: "Tumor sintético",
    nome: "Ficha sintética duplicada", cenario: "Fixture sem uso clínico", versao: "1.0.0", hash: "hash-sintetico",
    codigoInstitucional: null, intervaloDias: 21, ciclos: 4,
    itens: [{ drug: "substância sintética", classe: "QT", sequence: 1, standardDose: 1, doseBasis: "FIXED",
      calculatedDose: null, prescribedDose: null, unit: "mg", adjustmentPercent: null, adjustmentReason: null,
      route: "EV", diluent: null, finalVolumeMl: null, infusionTime: null, days: ["d1"], observacao: null,
      source: "PROTOCOL", overrideMotivo: null }], limiaresBula: null, fonte: "Fonte inteiramente sintética", status: "CONFERIDA_MEDICO" });
  const ambiente = await abrir({ templatesProtocolo: [template, template] });
  const contexto = { patientId: PACIENTE, encounterId: ENCONTRO_ATUAL, tumorLotId: LOTE };
  ambiente.sessoes.selecionarConsulta(ambiente.token, contexto);
  const draftsAntes = Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM draft_envelope").get() as { n: number }).n);
  const eventosAntes = listarEventos(ambiente.db, PACIENTE).length;

  const resposta = await ambiente.request("/consulta/prescricao/rascunho", "POST", JSON.stringify({
    ...contexto, templateId: template.templateId,
  }), ambiente.token, "application/json");

  expect(resposta.status).toBe(409);
  expect(z.object({ codigo: z.literal("TEMPLATE_AMBIGUO") }).parse(JSON.parse(resposta.body) as unknown).codigo)
    .toBe("TEMPLATE_AMBIGUO");
  expect(Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM draft_envelope").get() as { n: number }).n)).toBe(draftsAntes);
  expect(listarEventos(ambiente.db, PACIENTE)).toHaveLength(eventosAntes);
});
