// Apenas prontuário sintético; estes testes não representam critérios clínicos.
import { afterEach, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import type { Triagem } from "../../src/contracts/clinico.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { adaptarFatosTipados } from "../../src/server/trialsFatosTipados.js";
import { lerFatosTrials } from "../../src/server/trialsFatos.js";
import { hashCanonico, projetarRetrato } from "../../src/kernel/projections/retrato/index.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  AGORA, PACIENTE, ENCONTRO } from "../f0-fecha/fixtures/consulta-completa.js";
import { ausente, fonteSintetica, presente, triagemBase } from "../fixtures/triagem.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: "lote-sintetico-trial" };
const retratoContexto = { ...contexto, agora: AGORA, regras: [],
  biblioteca: { id: "fixture-sintetica", versao: "1", hash: "fixture" } };

afterEach(async () => {
  for (const ambiente of ambientes.splice(0)) {
    await ambiente.close();
    removerDiretorio(ambiente.dir);
  }
});

async function ambiente() {
  const a = await abrirAmbiente(criarDiretorio());
  ambientes.push(a);
  cadastrarPaciente(a);
  a.sessoes.selecionarConsulta(a.token, contexto);
  let sequencia = 0;

  function registrar(tipo: string, payload: unknown, extra: {
    tumorLotId?: string;
    encounterId?: string;
    fontes?: ReturnType<typeof fonteSintetica>[];
    supersedesEventId?: string | null;
  } = {}) {
    const eventId = `typed-trial-adversarial-${++sequencia}`;
    const encounterId = extra.encounterId ?? contexto.encounterId;
    const tumorLotId = extra.tumorLotId ?? contexto.tumorLotId;
    const eventContext = { patientId: PACIENTE, encounterId, tumorLotId };
    salvarDraft(a.db, { draftId: eventId, patientId: PACIENTE, sourceId: eventId,
      rawRef: "reference-synthetic", payload: { contexto: eventContext }, diagnostics: [], revision: 0, criadoEm: AGORA });
    a.sessoes.selecionarConsulta(a.token, eventContext);
    const result = executarConfirmacao(a.db, { ...eventContext, operationId: eventId,
      reviewDecisionId: `review-${eventId}`, sessao: a.sessoes.obter(a.token)!, em: AGORA,
      registros: [{ draftId: eventId, expectedRevision: 0, eventId, tipo, payload,
        fontes: extra.fontes ?? [fonteSintetica(eventId)], revisao: "CONFIRMADO",
        supersedesEventId: extra.supersedesEventId ?? null }] });
    if (result.estado !== "GRAVADA") throw new Error(`SEED_NOT_WRITTEN:${tipo}:${result.estado}`);
    a.sessoes.selecionarConsulta(a.token, contexto);
    return eventId;
  }

  const triagem = (overrides: Partial<Triagem> = {}) => triagemBase({
    patientId: PACIENTE, encounterId: ENCONTRO, ecog: presente(1), ...overrides,
  });
  return Object.assign(a, { registrar, triagem });
}

function projetar(eventos: readonly ClinicalEvent[]) {
  return projetarRetrato(eventos, retratoContexto);
}

function ler(a: Awaited<ReturnType<typeof ambiente>>) {
  const retrato = projetar(a.eventos());
  return { retrato, resposta: lerFatosTrials(a.db, contexto, AGORA, retrato) };
}

function fato(a: Awaited<ReturnType<typeof ambiente>>, factKey = "ecog") {
  return ler(a).resposta.fatos.find(item => item.factKey === factKey);
}

it("não deixa data futura em subcampo FATO sobrescrever ECOG tipado atual", async () => {
  const a = await ambiente();
  a.registrar("Triagem", a.triagem());
  const futuro = { ...presente(4), data: "2099-01-01" };
  a.registrar("FATO", { campo: "ecog", valor: futuro });

  expect(fato(a)).toMatchObject({ status: "CONFIRMADO", value: 1 });
  expect(fato(a, "ecog.data")).toMatchObject({ status: "CONFIRMADO", value: "2026-10-01" });
  expect(ler(a).resposta.fatos).not.toContainEqual(expect.objectContaining({ value: "2099-01-01" }));
});

it("deixa ECOG pendente quando a data do Dado é desconhecida, ainda que o evento tenha data de captura", async () => {
  const a = await ambiente();
  const ecog = { ...presente(1), fontes: [{ ...fonteSintetica("ecog-sem-data"), dataClinica: null }] } as Triagem["ecog"];
  a.registrar("Triagem", a.triagem({ ecog }));

  expect(fato(a)).toBeUndefined();
  expect(fato(a, "ecog.data")).toBeUndefined();
});

it("não usa ECOG de Triagem vinculada a outro encontro do mesmo paciente", async () => {
  const a = await ambiente();
  const outroEncontro = "encontro-anterior-sintetico";
  a.registrar("Triagem", a.triagem({ encounterId: outroEncontro, ecog: presente(4) }), { encounterId: outroEncontro });

  expect(fato(a)).toBeUndefined();
});

it.each([
  { atual: 1, historico: 1 },
  { atual: 1, historico: 4 },
])("usa somente ECOG do encontro atual quando Triagem histórica é do mesmo dia: %j", async ({ atual, historico }) => {
  const a = await ambiente();
  const atualId = a.registrar("Triagem", a.triagem({ ecog: presente(atual) }));
  const encontroHistorico = "encontro-anterior-mesmo-dia-sintetico";
  const historicoId = a.registrar("Triagem", a.triagem({ encounterId: encontroHistorico, ecog: presente(historico) }), {
    encounterId: encontroHistorico,
  });

  const resultado = fato(a);
  expect(resultado).toMatchObject({ status: "CONFIRMADO", value: atual });
  expect(resultado?.status === "CONFIRMADO" && resultado.source.sourceId).toBe(atualId);
  expect(resultado?.status === "CONFIRMADO" && resultado.source.exactText).toContain(atualId);
  expect(resultado?.status === "CONFIRMADO" && resultado.source.exactText).not.toContain(historicoId);
});

it("não transforma um único Dado internamente conflitante em fato ou conflito fabricado", async () => {
  const a = await ambiente();
  const conflitoEcog = {
    valor: null,
    estado: "VERMELHO" as const,
    campo: "CONFLITO" as const,
    motivo: "Duas fontes sintéticas discordam sobre ECOG.",
    fontes: [fonteSintetica("wrapper-conflito")],
    revisao: "CONFIRMADO" as const,
    candidatos: [
      { valor: 1, fontes: [fonteSintetica("candidato-1")] },
      { valor: 2, fontes: [fonteSintetica("candidato-2")] },
    ],
  };
  a.registrar("Triagem", a.triagem({ ecog: conflitoEcog }));

  expect(fato(a)).toBeUndefined();
});

it.each([
  { patientId: "patient-other-envelope", encounterId: ENCONTRO },
  { patientId: PACIENTE, encounterId: "encounter-other-envelope" },
])("não projeta Triagem quando patientId/encounterId no payload divergem do envelope: %j", payloadContext => {
  const evento: ClinicalEvent = {
    eventId: "event-envelope-mismatch-synthetic",
    operationId: "operation-envelope-mismatch-synthetic",
    eventIndex: 0,
    patientId: PACIENTE,
    tumorLotId: contexto.tumorLotId,
    encounterId: ENCONTRO,
    tipo: "Triagem",
    payload: { data: triagemBase({ patientId: payloadContext.patientId, encounterId: payloadContext.encounterId }) },
    fontes: [fonteSintetica("source-envelope-mismatch")],
    revisao: "CONFIRMADO",
    criadoEm: AGORA,
    criadoPor: { tipo: "SESSAO", id: "physician-synthetic" },
    supersedesEventId: null,
  };
  const retrato = projetar([evento]);

  expect(retrato.fatos.some(item => item.ref.eventId === evento.eventId)).toBe(false);
  expect(retrato.integridade).toContainEqual(expect.objectContaining({
    eventoId: evento.eventId, motivo: "TRIAGEM_CONTEXTO_OU_PAYLOAD_INVALIDO",
  }));
  expect(adaptarFatosTipados([evento], contexto, AGORA, retrato).fatos).toEqual([]);
});

it("não promove qualificador de terceiro/passado dentro do wrapper FATO.valor", async () => {
  const a = await ambiente();
  a.registrar("Triagem", a.triagem());
  a.registrar("FATO", { campo: "ecog", valor: { ...presente(4), qualificadores: {
    polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA",
  } } });

  expect(ler(a).resposta.fatos).not.toContainEqual(expect.objectContaining({ factKey: "ecog", value: 4, status: "CONFIRMADO" }));
});

it("aceita apenas os aliases versionados Triagem@1 e ignora versões futuras desconhecidas", async () => {
  const a = await ambiente();
  a.registrar("Triagem@1", a.triagem());
  expect(fato(a)).toMatchObject({ status: "CONFIRMADO", value: 1 });

  const eventoFuturo: ClinicalEvent = {
    eventId: "triagem-version-futura-synthetic",
    operationId: "triagem-version-futura-synthetic",
    eventIndex: 0,
    patientId: PACIENTE,
    tumorLotId: contexto.tumorLotId,
    encounterId: ENCONTRO,
    tipo: "Triagem@2",
    payload: { data: a.triagem({ ecog: presente(4) }) },
    fontes: [fonteSintetica("triagem-version-futura")],
    revisao: "CONFIRMADO",
    criadoEm: AGORA,
    criadoPor: { tipo: "SESSAO", id: "physician-synthetic" },
    supersedesEventId: null,
  };
  expect(projetar([eventoFuturo]).fatos.some(item => item.ref.eventId === eventoFuturo.eventId)).toBe(false);
  expect(adaptarFatosTipados([eventoFuturo], contexto, AGORA, projetar([eventoFuturo])).fatos).toEqual([]);
});

it("não permite que supersession genérica inválida substitua Triagem tipada", async () => {
  const a = await ambiente();
  const typedEventId = a.registrar("Triagem", a.triagem());
  const antes = a.eventos();
  expect(() => a.registrar("FATO", { campo: "ecog", valor: 4 }, { supersedesEventId: typedEventId }))
    .toThrow("SUPERSEDES_CONTEXT_INVALID");
  expect(a.eventos()).toEqual(antes);
  expect(fato(a)).toMatchObject({ status: "CONFIRMADO", value: 1 });
  // Histórico legado inválido continua defensivo mesmo quando não passa mais pelo writer.
  const original = antes.find(e => e.eventId === typedEventId)!;
  const legado: ClinicalEvent = { ...original, eventId: "generic-legacy-invalid", operationId: "legacy-invalid",
    tipo: "FATO", payload: { data: { campo: "ecog", valor: 4 } }, supersedesEventId: typedEventId };
  const eventos = [...antes, legado], retrato = projetar(eventos);
  const resposta = adaptarFatosTipados(eventos, contexto, AGORA, retrato);

  expect(retrato.fatos.some(item => item.ref.eventId === typedEventId)).toBe(true);
  expect(retrato.integridade).toContainEqual(expect.objectContaining({
    eventoId: legado.eventId, motivo: "SUPERSESSION_CONTEXTO_INVALIDO",
  }));
  expect(resposta.fatos).not.toContainEqual(expect.objectContaining({ factKey: "ecog", value: 4, status: "CONFIRMADO" }));
});

it("mantém FATO observacaoDatada fora do ECOG tipado atual mesmo que seja mais recente", async () => {
  const a = await ambiente();
  a.registrar("Triagem", a.triagem());
  a.registrar("FATO", { campo: "ecog", valor: 4, observacaoDatada: true, dataClinica: "2026-10-05" });

  expect(fato(a)).toMatchObject({ status: "CONFIRMADO", value: 1 });
  expect(fato(a, "ecog.data")).toMatchObject({ status: "CONFIRMADO", value: "2026-10-01" });
});
