// Synthetic kernel/projection regressions; independent of the Trials service.
import { afterEach, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft, lerDraft } from "../../src/kernel/ledger/drafts.js";
import { eventosVigentes, projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { evento } from "../w10-eixo-temporal/fixtures.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
afterEach(async () => {
  for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); }
});
async function abrir() {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a); cadastrarPaciente(a);
  a.sessoes.selecionarConsulta(a.token, contexto);
  const preparar = (id: string, campo: string, valor: unknown, options: {
    tipo?: string; supersedesEventId?: string; em?: string; tumorLotId?: string | null;
  } = {}) => {
    salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "synthetic-local",
      payload: {}, revision: 0, diagnostics: [], criadoEm: AGORA });
    return { ...contexto, tumorLotId: options.tumorLotId ?? null, operationId: id, reviewDecisionId: id,
      sessao: a.sessoes.obter(a.token)!, em: options.em ?? AGORA, registros: [{
        draftId: id, expectedRevision: 0, eventId: id, tipo: options.tipo ?? "FATO",
        payload: { campo, valor }, fontes: [], revisao: "CONFIRMADO" as const,
        supersedesEventId: options.supersedesEventId ?? null,
      }] };
  };
  const gravar = (req: ReturnType<typeof preparar>) => executarConfirmacao(a.db, req);
  return Object.assign(a, { preparar, gravar });
}

it.each(["campo", "tipo", "tempo"])("kernel rejeita substituicao de %s incompativel sem consumir draft", async (caso) => {
  const a = await abrir();
  const futuro = "2026-10-09T12:00:20-03:00";
  expect(a.gravar(a.preparar("anterior", "ecog", 2, { em: caso === "tempo" ? futuro : AGORA })).estado).toBe("GRAVADA");
  const req = a.preparar("substituto", caso === "campo" ? "nota" : "ecog", 1,
    { tipo: caso === "tipo" ? "ReviewDecision" : "FATO", supersedesEventId: "anterior" });
  const antes = a.eventos();
  expect(() => a.gravar(req)).toThrow("SUPERSEDES_CONTEXT_INVALID");
  expect(a.eventos()).toEqual(antes);
  expect(lerDraft(a.db, "substituto")?.revision).toBe(0);
  expect(a.db.prepare("SELECT * FROM operation WHERE operationId=?").get("substituto")).toBeUndefined();
});

it("correcao explicita aceita alias v1, mesmo instante e replay sem precedencia lexical", async () => {
  const a = await abrir();
  a.gravar(a.preparar("z-anterior", "ecog", 2));
  const req = a.preparar("a-correcao", "ecog", 1, { tipo: "FATO@1", supersedesEventId: "z-anterior" });
  expect(a.gravar(req).estado).toBe("GRAVADA");
  expect(a.gravar(req).estado).toBe("REPLAY");
  const atual = projetarSnapshot(a.eventos(), PACIENTE, null, ENCONTRO, "teste");
  expect(atual.campos.ecog).toMatchObject({ valor: 1, estado: "VERDE", eventIds: ["a-correcao"] });
});

it("preserva excecao explicita da lista de medicamentos entre lotes do mesmo paciente", async () => {
  const a = await abrir();
  a.gravar(a.preparar("lista-1", "medicamentos", ["Item sintetico"], { tumorLotId: "lote-1" }));
  expect(a.gravar(a.preparar("lista-2", "medicamentos", [], {
    tipo: "FATO@1", tumorLotId: "lote-2", supersedesEventId: "lista-1",
  })).estado).toBe("GRAVADA");
  expect(eventosVigentes(a.eventos()).map(e => e.eventId)).toContain("lista-2");
  expect(eventosVigentes(a.eventos()).map(e => e.eventId)).not.toContain("lista-1");
});

const claim = (id: string, valor: number, patch: Partial<ClinicalEvent> = {}) =>
  evento(id, { campo: "ecog", valor }, { ...contexto, criadoEm: AGORA, ...patch });

it("ciclo legado nao elimina os candidatos conflitantes", () => {
  const eventos = [claim("a", 2, { supersedesEventId: "b" }), claim("b", 3, { supersedesEventId: "a" }), claim("c", 1)];
  const snapshot = projetarSnapshot(eventos, PACIENTE, null, ENCONTRO, "teste");
  expect(snapshot.campos.ecog).toMatchObject({ estado: "VERMELHO", eventIds: ["a", "b", "c"] });
});

it("historico TNM nao marca como substituida uma avaliacao apontada por outro campo", () => {
  const eventos = [evento("tnm", { campo: "TNM", valor: "cT1N0M0" }),
    evento("nota", { campo: "nota", valor: "sintetico" }, { supersedesEventId: "tnm" })];
  const snapshot = projetarSnapshot(eventos, eventos[0]!.patientId, eventos[0]!.tumorLotId, eventos[0]!.encounterId, "teste");
  expect(snapshot.stageHistory?.[0]?.superseded).toBe(false);
  expect(snapshot.campos.TNM?.eventIds).toEqual(["tnm"]);
});

it.each([
  { tipo: "ReviewDecision" }, { tipo: "FATO@2" }, { patientId: "outro-paciente" },
  { tumorLotId: "outro-lote" }, { revisao: "REVISAR" as const },
  { criadoEm: "2026-10-09T11:59:59-03:00" },
  { operationId: "op-anterior", eventIndex: 0 },
])("leitura legada conserva alvo de relacao incompativel: %j", (patch) => {
  const anterior = claim("anterior", 2);
  const atual = claim("atual", 1, { supersedesEventId: anterior.eventId, ...patch });
  expect(eventosVigentes([anterior, atual]).map(e => e.eventId)).toContain("anterior");
});

it("cadeia valida e ordem de eventos da mesma operacao permanecem deterministicas", () => {
  const anterior = claim("anterior", 3);
  const atual = claim("atual", 2, { operationId: anterior.operationId, eventIndex: 1, supersedesEventId: anterior.eventId });
  const final = claim("final", 1, { supersedesEventId: atual.eventId });
  expect(eventosVigentes([final, anterior, atual]).map(e => e.eventId)).toEqual(["final"]);
});
