import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { AvaliacaoEstudoRespostaSchema, EstudoServicoSchema,
  type AvaliarEstudoPedido, type AvaliacaoEstudoResposta,
  type EstudoServico, type RevisarEstudoPedido } from "../../src/contracts/api/trialsServico.js";
import { ErroPorta } from "../../src/ui/api/porta.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceText = "Synthetic trial document; all content is fictional.";
const sourceHash = sha(sourceText);
const candidateHash = sha("synthetic candidate v1");
const reviewHash = sha("synthetic review v1");
const factsHash = sha("synthetic clinical ledger v1");
const contexto = ContextoAcaoComposta.parse({ patientId: "patient-synthetic-1",
  encounterId: "encounter-synthetic-1", tumorLotId: "tumor-lot-synthetic-1" });
const title = "Synthetic trial title";
const titleEvidence = { sourceId: "source-synthetic-1", sourceRef: "local:source-synthetic-1",
  locator: "page:1/title", exactText: title, contentHash: sourceHash };
const criterionEvidence = { ...titleEvidence, locator: "page:2/inclusion-1",
  exactText: "Age is at least 18 years." };
const expression = { kind: "NUMBER" as const, factKey: "ageYears", operator: "GTE" as const, value: 18, unit: "years" };

function studyServico(overrides: Partial<EstudoServico> = {}): EstudoServico {
  const base: EstudoServico = {
    draftId: "draft-synthetic-1",
    revision: 4,
    source: { sourceId: "source-synthetic-1", sourceRef: "local:source-synthetic-1",
      originalName: "trial-synthetic.txt", mimeType: "text/plain", kind: "TXT", contentHash: sourceHash,
      originalContent: sourceText, attachmentRef: null, locator: null },
    candidate: { candidateId: "candidate-synthetic-1", sourceId: "source-synthetic-1", sourceHash,
      reviewStatus: "PENDENTE_REVISAO_MEDICA", studyId: "study-synthetic-1",
      title: { text: title, evidence: [titleEvidence] }, description: null,
      arms: [{ armId: "arm-synthetic-1", name: { text: "Arm A", evidence: [titleEvidence] }, description: null }],
      inclusionCriteria: [{ criterionId: "criterion-age", polarity: "INCLUSAO", groupId: null, groupOperator: null,
        expression, rawText: "Age is at least 18 years.", status: "PENDENTE", evidence: [criterionEvidence] }],
      exclusionCriteria: [], outcomes: [], warnings: [] },
    candidateHash,
    review: { candidateId: "candidate-synthetic-1", decisionId: "decision-synthetic-1", reviewerId: "reviewer-synthetic-1",
      reviewedAt: "2026-10-20T14:30:00-03:00", decision: "CONFIRMAR", version: 1,
      candidateHash, reviewHash, studyId: "study-synthetic-1",
      title: { text: title, evidence: [titleEvidence] },
      reviewedCriteria: [{ criterionId: "criterion-age", polarity: "INCLUSAO", groupId: null, groupOperator: null,
        expression, applicability: "APLICAVEL", notApplicableReason: null,
        rawText: "Age is at least 18 years.", evidence: [criterionEvidence] }],
      reviewedArmIds: ["arm-synthetic-1"] },
  };
  return EstudoServicoSchema.parse({ ...base, ...overrides });
}

function pedidoRevisao(overrides: Partial<RevisarEstudoPedido> = {}): RevisarEstudoPedido {
  return { draftId: "draft-synthetic-1", expectedRevision: 3, candidateHash,
    studyId: "study-synthetic-1", decision: "CONFIRMAR", titleText: title,
    titleEvidenceLocator: "page:1/title",
    bindings: [{ criterionId: "criterion-age", groupId: null, groupOperator: null,
      expression, applicability: "APLICAVEL", notApplicableReason: null }],
    reviewedArmIds: ["arm-synthetic-1"], idempotencyKey: "review-synthetic-1", ...overrides };
}

function respostaAvaliacao(overrides: Partial<AvaliacaoEstudoResposta> = {}): AvaliacaoEstudoResposta {
  const base: AvaliacaoEstudoResposta = {
    contexto,
    estudo: studyServico(),
    revisaoFatos: factsHash,
    resultado: { status: "POSSIBLE_MATCH", criteria: [{ criterionId: "criterion-age", status: "ATENDIDO",
      reason: "Idade confirmada atende ao critério sintético.", sources: [criterionEvidence] }], reviewedStudyVersion: 1 },
    fatos: [{ patientId: contexto.patientId, factKey: "ageYears", value: 62, unit: "years", status: "CONFIRMADO",
      source: criterionEvidence, validFrom: "2025-01-01", validTo: "2026-12-31" }],
    elegivel: false,
  };
  return AvaliacaoEstudoRespostaSchema.parse({ ...base, ...overrides });
}

function clienteComResposta(initial: { status: number; json: unknown }) {
  let response = initial;
  const chamadas: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    chamadas.push({ url, init });
    if (url === "/login") return new Response(JSON.stringify({ token: "token-synthetic", expiraEm: null }), { status: 200 });
    return new Response(JSON.stringify(response.json), { status: response.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    porta: criarPortaHttp({ onSessaoExpirada: vi.fn() }),
    fetchMock,
    chamadas,
    responder(next: { status: number; json: unknown }) { response = next; },
  };
}

describe("porta HTTP para Trials", () => {
  it("aceita revisão tipada quando bindings, limiar, revisão e arms correspondem ao pedido", async () => {
    const pedido = pedidoRevisao();
    const resposta = studyServico();
    const cliente = clienteComResposta({ status: 200, json: resposta });
    await cliente.porta.login("synthetic-password");

    await expect(cliente.porta.revisarEstudoTrial!(pedido)).resolves.toEqual(resposta);
    const chamada = cliente.chamadas.find(item => item.url === "/consulta/trials/revisar")!;
    expect(JSON.parse(String(chamada.init?.body))).toEqual(pedido);
    expect(new Headers(chamada.init?.headers).get("Authorization")).toBe("Bearer token-synthetic");
    expect(chamada.init?.credentials).toBe("omit");
    expect(cliente.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejeita resposta de schema válido se o binding/limiar divergir do pedido", async () => {
    const pedido = pedidoRevisao();
    const resposta = studyServico();
    const originalReview = resposta.review!;
    const divergente = EstudoServicoSchema.parse({ ...resposta, review: { ...originalReview,
      reviewedCriteria: originalReview.reviewedCriteria.map(item => ({ ...item,
        expression: { kind: "NUMBER", factKey: "ageYears", operator: "GTE", value: 21, unit: "years" } })) } });
    expect(EstudoServicoSchema.safeParse(divergente).success).toBe(true);
    const cliente = clienteComResposta({ status: 200, json: divergente });
    await expect(cliente.porta.revisarEstudoTrial!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it.each(["draftId", "revision", "candidateHash", "title", "arms"])(
    "rejeita resposta tipada com %s divergente do pedido", async (campo) => {
      const pedido = pedidoRevisao();
      const original = studyServico();
      let divergente = original;
      if (campo === "draftId") divergente = { ...original, draftId: "other-draft" };
      if (campo === "revision") divergente = { ...original, revision: pedido.expectedRevision + 2 };
      if (campo === "candidateHash") {
        const otherHash = sha("other candidate hash");
        divergente = { ...original, candidateHash: otherHash,
          review: { ...original.review!, candidateHash: otherHash } };
      }
      if (campo === "title") divergente = { ...original, review: { ...original.review!,
        title: { text: "Other synthetic title", evidence: [titleEvidence] } } };
      if (campo === "arms") divergente = { ...original, review: { ...original.review!, reviewedArmIds: ["other-arm"] } };
      expect(EstudoServicoSchema.safeParse(divergente).success).toBe(true);
      const cliente = clienteComResposta({ status: 200, json: divergente });
      await expect(cliente.porta.revisarEstudoTrial!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    },
  );

  it("preserva codigo devolvido por HTTP ao rejeitar revisão", async () => {
    const cliente = clienteComResposta({ status: 409, json: { codigo: "REVISAO_ESTUDO_OBSOLETA" } });
    await expect(cliente.porta.revisarEstudoTrial!(pedidoRevisao())).rejects.toMatchObject({
      codigo: "REVISAO_ESTUDO_OBSOLETA",
    });
  });

  it("converte resposta HTTP 200 malformada em PAYLOAD_INVALIDO", async () => {
    const cliente = clienteComResposta({ status: 200, json: { codigo: "REVIEW_COMPLETE" } });
    await expect(cliente.porta.revisarEstudoTrial!(pedidoRevisao())).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("nega resposta de avaliação com contexto ou reviewHash divergentes", async () => {
    const pedido: AvaliarEstudoPedido = { contexto, draftId: "draft-synthetic-1", expectedRevision: 4, expectedReviewHash: reviewHash };
    const valida = respostaAvaliacao();
    expect(AvaliacaoEstudoRespostaSchema.safeParse(valida).success).toBe(true);
    const contextoDivergente = { ...valida, contexto: { ...contexto, encounterId: "other-encounter" } };
    const clienteContexto = clienteComResposta({ status: 200, json: contextoDivergente });
    await expect(clienteContexto.porta.avaliarEstudoTrial!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });

    const hashDivergente = { ...valida, estudo: { ...valida.estudo,
      review: { ...valida.estudo.review!, reviewHash: sha("other review") } } };
    expect(AvaliacaoEstudoRespostaSchema.safeParse(hashDivergente).success).toBe(true);
    const clienteHash = clienteComResposta({ status: 200, json: hashDivergente });
    await expect(clienteHash.porta.avaliarEstudoTrial!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("envia somente contexto/revisão ao avaliar; fatos clínicos vêm exclusivamente na resposta do servidor", async () => {
    const pedido: AvaliarEstudoPedido = { contexto, draftId: "draft-synthetic-1", expectedRevision: 4, expectedReviewHash: reviewHash };
    const resposta = respostaAvaliacao();
    const cliente = clienteComResposta({ status: 200, json: resposta });
    await expect(cliente.porta.avaliarEstudoTrial!(pedido)).resolves.toEqual(resposta);
    const chamada = cliente.chamadas.find(item => item.url === "/consulta/trials/avaliar")!;
    const body = JSON.parse(String(chamada.init?.body)) as Record<string, unknown>;
    expect(body).toEqual(pedido);
    expect(Object.hasOwn(body, "fatos")).toBe(false);
    expect(Object.hasOwn(body, "patientFacts")).toBe(false);
    expect(resposta.elegivel).toBe(false);
  });
});
