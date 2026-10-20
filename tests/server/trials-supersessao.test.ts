// All patients, sources and trial criteria in this regression are synthetic.
import { afterEach, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
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

// Direct INSERT represents immutable legacy rows accepted before the writer fix.
// It is deliberately not the current writer; no trigger is disabled or row rewritten.
function legado(a: Awaited<ReturnType<typeof abrir>>, e: ClinicalEvent) {
  a.db.prepare("INSERT INTO operation VALUES (?,?,?,?)").run(e.operationId, "legacy-fixture", e.eventId, e.criadoEm);
  a.db.prepare(`INSERT INTO clinical_event
    (eventId,operationId,eventIndex,patientId,tumorLotId,encounterId,tipo,payload,fontes,revisao,criadoEm,criadoPor,supersedesEventId)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(e.eventId, e.operationId, e.eventIndex, e.patientId,
    e.tumorLotId, e.encounterId, e.tipo, JSON.stringify(e.payload), JSON.stringify(e.fontes), e.revisao,
    e.criadoEm, JSON.stringify(e.criadoPor), e.supersedesEventId);
}
it("HTTP conserva conflito legado e nao transforma supressao de outro campo em POSSIBLE_MATCH", async () => {
  const a = await abrir();
  a.gravar(a.preparar("ecog-1", "ecog", 1));
  a.gravar(a.preparar("ecog-2", "ecog", 2));
  legado(a, evento("nota-legada", { campo: "nota", valor: "sintetico" }, {
    ...contexto, criadoEm: AGORA, supersedesEventId: "ecog-2",
  }));
  const antes = a.eventos();
  const importado = await a.request("/consulta/trials/importar", {
    nome: "sintetico.json", mimeType: "application/json", idempotencyKey: "importacao",
    conteudo: JSON.stringify({ title: "Estudo sintetico", inclusionCriteria: ["ECOG igual a 1"],
      exclusionCriteria: [], arms: [], outcomes: ["Desfecho sintetico"] }),
  });
  expect(importado.status).toBe(200);
  const estudo = importado.data;
  const revisto = await a.request("/consulta/trials/revisar", {
    draftId: estudo.draftId, expectedRevision: estudo.revision, candidateHash: estudo.candidateHash,
    studyId: "SINTETICO", decision: "CONFIRMAR", titleText: estudo.candidate.title.text,
    titleEvidenceLocator: estudo.candidate.title.evidence[0].locator, reviewedArmIds: [],
    idempotencyKey: "revisao", bindings: estudo.candidate.inclusionCriteria.map((c: { criterionId: string }) => ({
      criterionId: c.criterionId, groupId: null, groupOperator: null,
      expression: { kind: "EQUALS", factKey: "ecog", value: 1 },
      applicability: "APLICAVEL", notApplicableReason: null,
    })),
  });
  expect(revisto.status).toBe(200);
  const resposta = await a.request("/consulta/trials/avaliar", { contexto, draftId: estudo.draftId,
    expectedRevision: revisto.data.revision, expectedReviewHash: revisto.data.review.reviewHash });
  expect(resposta.status).toBe(200);
  expect(resposta.data.resultado.status).toBe("PENDENTE");
  expect(resposta.data.fatos.find((f: { factKey: string }) => f.factKey === "ecog").status).toBe("CONFLITO");
  expect(resposta.data.elegivel).toBe(false);
  expect(a.eventos()).toEqual(antes);
});
