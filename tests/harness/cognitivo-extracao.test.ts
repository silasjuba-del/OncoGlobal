import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { avaliarExtracaoCognitiva } from "../../src/kernel/llm/cognitivoExtracao.js";
import type { ResultadoExtracao } from "../../src/kernel/llm/openai/index.js";

const original = "Marcador presente.";
const resultado: Extract<ResultadoExtracao, { status: "PROPOSTA" }> = {
  status: "PROPOSTA", revisaoObrigatoria: true, fonteHash: "hash-sintetico", modelo: "sintetico", promptId: "teste",
  correlacao: { patientId: "p", encounterId: "e", tumorLotId: null, operationId: "o", revisaoFatos: "0", regras: [],
    biblioteca: { id: "b", versao: "1", hash: "hash-sintetico" }, proposta: null },
  candidatos: [], resumo: [],
};
const fonte = { sourceId: "s", versao: "1", modalidade: "TEXTO" as const, conteudoOriginal: original,
  contentHash: createHash("sha256").update(original).digest("hex") };
const avaliar = (r: typeof resultado) => avaliarExtracaoCognitiva({ resultado: r, fonte, agora: "2026-10-21T12:00:00Z" });

describe("Adapter cognitivo preserva limites da prova", () => {
  it("resposta sem alegações não vira verificação positiva", () => {
    expect(avaliar(resultado)).toMatchObject({ estado: "NAO_VERIFICADO", codigo: "SEM_ALEGACOES", criaEventoClinico: false });
  });
  it("texto retornado pelo modelo não substitui original para sustentar a si mesmo", () => {
    expect(avaliar({ ...resultado, resumo: [{ texto: "Texto substituído", referencias: [{ fonteId: "FONTE_1", pagina: 1, trecho: "Texto substituído" }] }] }))
      .toMatchObject({ estado: "NAO_VERIFICADO", codigo: "CITACAO_NAO_LITERAL_NA_FONTE_ORIGINAL" });
  });
  it("resumo literal é confrontado pelo harness mesmo sem candidatos estruturados", () => {
    const r = avaliar({ ...resultado, resumo: [{ texto: original, referencias: [{ fonteId: "FONTE_1", pagina: 1, trecho: original }] }] });
    expect(r.estado).toBe("AVALIADO");
    if (r.estado !== "AVALIADO") throw Error("Avaliação ausente");
    expect(r.proposta.itensPropostos).toHaveLength(1);
    expect(r.harness.itensVerificados[0]?.validado).toBe(false);
  });
});
