// Dados integralmente sintéticos. A leitura usa SQLite e eventos confirmados do ledger.
import { afterEach, expect, it } from "vitest";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { lerFatosTrials } from "../../src/server/trialsFatos.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  AGORA, ENCONTRO, PACIENTE } from "../f0-fecha/fixtures/consulta-completa.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: "lote-trials-sintetico-a" };
const outroPaciente = "Paciente Teste 93";
const outroEncontro = "encontro-teste-93";

afterEach(async () => {
  for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); }
});

async function ambiente() {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a);
  cadastrarPaciente(a);
  cadastrarPaciente(a, "93");
  return a;
}

let sequencia = 0;
function instantOffset(seconds: number): string {
  return new Date(Date.parse(AGORA) + seconds * 1000).toISOString();
}

function registrar(a: Awaited<ReturnType<typeof abrirAmbiente>>, input: {
  campo: string; valor: unknown; patientId?: string; encounterId?: string; tumorLotId?: string | null;
  em?: string; extras?: Record<string, unknown>; revisao?: "CONFIRMADO" | "ASSINADO";
}) {
  const patientId = input.patientId ?? PACIENTE;
  const encounterId = input.encounterId ?? ENCONTRO;
  const tumorLotId = input.tumorLotId === undefined ? contexto.tumorLotId : input.tumorLotId;
  const id = `trials-fato-${++sequencia}`;
  const em = input.em ?? AGORA;
  const ctx = { patientId, encounterId, tumorLotId };
  a.sessoes.selecionarConsulta(a.token, ctx);
  salvarDraft(a.db, { draftId: id, patientId, sourceId: id, rawRef: "referencia-sintetica-local",
    payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  const result = executarConfirmacao(a.db, { ...ctx, operationId: id, reviewDecisionId: id,
    sessao: a.sessoes.obter(a.token)!, em, registros: [{ draftId: id, expectedRevision: 0,
      eventId: id, tipo: "FATO", payload: { campo: input.campo, valor: input.valor, ...input.extras },
      fontes: [fonteSintetica(id)], revisao: input.revisao ?? "CONFIRMADO" }] });
  expect(result.estado).toBe("GRAVADA");
  return id;
}

it("não promove draft local sem evento confirmado", async () => {
  const a = await ambiente();
  salvarDraft(a.db, { draftId: "trial-rascunho", patientId: PACIENTE, sourceId: "trial-rascunho",
    rawRef: "rascunho-sintetico", payload: { campo: "fato-sintetico", valor: "candidato" },
    diagnostics: [], revision: 0, criadoEm: AGORA });

  expect(lerFatosTrials(a.db, contexto, AGORA).fatos).toEqual([]);
});

it("isola paciente e lote tumoral ao projetar somente o contexto solicitado", async () => {
  const a = await ambiente();
  registrar(a, { campo: "marcador-sintetico", valor: "outro-paciente", patientId: outroPaciente,
    encounterId: outroEncontro, tumorLotId: contexto.tumorLotId });
  registrar(a, { campo: "marcador-sintetico", valor: "outro-lote", tumorLotId: "lote-trials-sintetico-b" });

  expect(lerFatosTrials(a.db, contexto, AGORA).fatos).toEqual([]);
});

it("exclui evento futuro relativo ao instante de leitura", async () => {
  const a = await ambiente();
  const futuro = instantOffset(30);
  registrar(a, { campo: "marcador-sintetico", valor: "futuro", em: futuro });

  expect(lerFatosTrials(a.db, contexto, AGORA).fatos).toEqual([]);
});

it("mantém observação clínica datada em estado pendente fora dos fatos de matching", async () => {
  const a = await ambiente();
  registrar(a, { campo: "marcador-sintetico", valor: "observacao-datada",
    extras: { observacaoDatada: true, dataClinica: "2026-10-08" } });

  expect(lerFatosTrials(a.db, contexto, AGORA).fatos).toEqual([]);
});

it("expõe conflito projetado com as fontes do ledger, sem escolher um valor", async () => {
  const a = await ambiente();
  const primeira = registrar(a, { campo: "marcador-sintetico", valor: "A" });
  const segunda = registrar(a, { campo: "marcador-sintetico", valor: "B" });

  const resposta = lerFatosTrials(a.db, contexto, AGORA);
  expect(resposta.fatos).toHaveLength(1);
  expect(resposta.fatos[0]).toMatchObject({ patientId: PACIENTE, factKey: "marcador-sintetico", status: "CONFLITO" });
  if (resposta.fatos[0]?.status === "CONFLITO") {
    expect(resposta.fatos[0].sources.map(source => source.sourceRef).sort())
      .toEqual([`ledger:${primeira}`, `ledger:${segunda}`].sort());
    expect(resposta.fatos[0].sources.every(source => source.locator === "payload.data"
      && /^[a-f0-9]{64}$/.test(source.contentHash) && source.exactText.includes(source.sourceId))).toBe(true);
  }
});

it("converte mesmo valor com unidades divergentes em conflito explícito", async () => {
  const a = await ambiente();
  registrar(a, { campo: "medida-sintetica", valor: 7, extras: { unidade: "unidade-A" } });
  registrar(a, { campo: "medida-sintetica", valor: 7, extras: { unit: "unidade-B" } });

  const resultado = lerFatosTrials(a.db, contexto, AGORA).fatos;
  expect(resultado).toHaveLength(1);
  expect(resultado[0]).toMatchObject({ factKey: "medida-sintetica", status: "CONFLITO" });
});

it("não usa negação ou confirmação pendente como fato positivo atual", async () => {
  const a = await ambiente();
  registrar(a, { campo: "marcador-negado-sintetico", valor: true, extras: { negado: true } });
  registrar(a, { campo: "marcador-incerto-sintetico", valor: "candidato", extras: { requiresConfirmation: true } });
  registrar(a, { campo: "marcador-evidencia-incerta-sintetico", valor: "candidato", extras: { evidence: "UNCERTAIN" } });

  const fatos = lerFatosTrials(a.db, contexto, AGORA).fatos;
  expect(fatos.map(f => f.factKey)).not.toContain("marcador-negado-sintetico");
  expect(fatos.map(f => f.factKey)).not.toContain("marcador-incerto-sintetico");
  expect(fatos.map(f => f.factKey)).not.toContain("marcador-evidencia-incerta-sintetico");
});

it.each([
  { name: "negada", qualificadores: { polaridade: "NEGADA", sujeito: "PACIENTE", temporalidade: "ATUAL" } },
  { name: "terceiro", qualificadores: { polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "ATUAL" } },
  { name: "histórica", qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "HISTORICA" } },
])("não promove qualificadores documentais de polaridade/sujeito/tempo: $name", async ({ name, qualificadores }) => {
  const a = await ambiente();
  const factKey = `marcador-${name}-sintetico`;
  registrar(a, { campo: factKey, valor: "candidato", extras: { qualificadores } });

  expect(lerFatosTrials(a.db, contexto, AGORA).fatos.map(f => f.factKey)).not.toContain(factKey);
});

it("preserva fontes ledger auditáveis e a leitura não grava no ledger", async () => {
  const a = await ambiente();
  const eventId = registrar(a, { campo: "fato-sintetico", valor: "valor-sintetico" });
  const antes = {
    eventos: listarEventos(a.db, PACIENTE).length,
    operacoes: Number((a.db.prepare("SELECT COUNT(*) AS n FROM operation").get() as { n: number }).n),
    auditorias: Number((a.db.prepare("SELECT COUNT(*) AS n FROM audit_event").get() as { n: number }).n),
  };

  const resultado = lerFatosTrials(a.db, contexto, AGORA);

  expect(resultado.fatos).toHaveLength(1);
  expect(resultado.fatos[0]).toMatchObject({ patientId: PACIENTE, factKey: "fato-sintetico",
    value: "valor-sintetico", status: "CONFIRMADO", source: { sourceId: eventId,
      sourceRef: `ledger:${eventId}`, locator: "payload.data" } });
  expect(resultado.fatos[0]?.status === "CONFIRMADO" && resultado.fatos[0].source.exactText).toContain(eventId);
  expect(resultado.fatos[0]?.status === "CONFIRMADO" && resultado.fatos[0].source.contentHash)
    .toMatch(/^[a-f0-9]{64}$/);
  expect({
    eventos: listarEventos(a.db, PACIENTE).length,
    operacoes: Number((a.db.prepare("SELECT COUNT(*) AS n FROM operation").get() as { n: number }).n),
    auditorias: Number((a.db.prepare("SELECT COUNT(*) AS n FROM audit_event").get() as { n: number }).n),
  }).toEqual(antes);
});
