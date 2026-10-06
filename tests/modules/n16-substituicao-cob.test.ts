import { describe, expect, it } from "vitest";
import { resolverSubstituicao } from "../../src/modules/documentos/substituicao.js";
import type { DraftPedido } from "../../src/modules/documentos/substituicao.js";

// N16: pedidos e rótulos são sintéticos; não representam conteúdo clínico.
const tc: DraftPedido = { draftId: "pedido-tc-teste", rotulo: "TC", substituiDraftId: null };
const rm: DraftPedido = { draftId: "pedido-rm-teste", rotulo: "RM", substituiDraftId: tc.draftId };
const posterior: DraftPedido = {
  draftId: "pedido-posterior-teste", rotulo: "outro pedido sintético", substituiDraftId: rm.draftId,
};

describe("N16 · substituição de documentos (escopo: seleção do draft imprimível)", () => {
  it("positivo: TC substituída por RM preserva TC no histórico independentemente da ordem de entrada", () => {
    for (const entrada of [[tc, rm], [rm, tc]]) {
      const resultado = resolverSubstituicao(entrada);
      expect(resultado).toMatchObject({
        estado: "VERDE",
        imprimivelId: rm.draftId,
        vigente: rm,
        emRevisao: [],
      });
      expect(resultado.historico).toEqual([tc]);
      expect(entrada).toHaveLength(2); // não apaga nem altera os drafts de entrada
    }
  });

  it("positivo: nova versão elege só a última e mantém toda a cadeia anterior", () => {
    const resultado = resolverSubstituicao([posterior, tc, rm]);
    expect(resultado.imprimivelId).toBe(posterior.draftId);
    expect(resultado.historico).toEqual([tc, rm]);
    expect(resultado.emRevisao).toEqual([]);
  });

  it("negativo: concorrência para substituir a mesma TC não escolhe um vencedor nem imprime", () => {
    const concorrente: DraftPedido = {
      draftId: "pedido-concorrente-teste", rotulo: "pedido sintético", substituiDraftId: tc.draftId,
    };
    const resultado = resolverSubstituicao([tc, rm, concorrente]);
    expect(resultado).toMatchObject({
      estado: "VERMELHO", vigente: null, imprimivelId: null, historico: [],
    });
    expect(resultado.emRevisao).toEqual([tc, rm, concorrente]);
  });

  it("negativo: referência inexistente não transforma o substituto em pedido imprimível", () => {
    const solto: DraftPedido = { ...rm, substituiDraftId: "pedido-ausente-teste" };
    const resultado = resolverSubstituicao([tc, solto]);
    expect(resultado.imprimivelId).toBeNull();
    expect(resultado.emRevisao).toEqual([tc, solto]);
  });
});
