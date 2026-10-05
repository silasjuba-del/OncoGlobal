import { describe, expect, it } from "vitest";
import { resolverSubstituicao } from "../../src/modules/documentos/substituicao.js";
import type { DraftPedido } from "../../src/modules/documentos/substituicao.js";

const tc: DraftPedido = { draftId: "d-tc", rotulo: "TC", substituiDraftId: null };
const rm: DraftPedido = { draftId: "d-rm", rotulo: "RM", substituiDraftId: "d-tc" };

describe("GRK-05 substituição de drafts", () => {
  it("positivo: RM substitui TC, só o vigente imprime e o anterior fica no histórico", () => {
    const r = resolverSubstituicao([tc, rm]);
    expect(r.estado).toBe("VERDE");
    expect(r.vigente?.draftId).toBe("d-rm");
    expect(r.historico.map((d) => d.draftId)).toEqual(["d-tc"]);
    expect(r.imprimivelId).toBe("d-rm");
    expect(r.emRevisao).toEqual([]);
  });

  it("negativo: dois vigentes, alvo duplicado ou ponteiro solto vão para revisão e não imprimem", () => {
    const dois = resolverSubstituicao([
      tc,
      { draftId: "d-outro", rotulo: "US", substituiDraftId: null },
    ]);
    expect(dois.estado).toBe("VERMELHO");
    expect(dois.imprimivelId).toBeNull();
    expect(dois.vigente).toBeNull();

    const mesmoAlvo = resolverSubstituicao([
      tc,
      rm,
      { draftId: "d-pet", rotulo: "PET", substituiDraftId: "d-tc" },
    ]);
    expect(mesmoAlvo.imprimivelId).toBeNull();
    expect(mesmoAlvo.motivo).toContain("mesmo pedido");

    const solto = resolverSubstituicao([
      { draftId: "d-rm", rotulo: "RM", substituiDraftId: "d-inexistente" },
    ]);
    expect(solto.estado).toBe("VERMELHO");
    expect(solto.imprimivelId).toBeNull();
  });

  it("borda: vazio é PENDENTE; um draft só é o vigente; ciclo não elege", () => {
    expect(resolverSubstituicao([])).toMatchObject({ estado: "PENDENTE", imprimivelId: null, vigente: null });

    const unico = resolverSubstituicao([tc]);
    expect(unico.vigente?.draftId).toBe("d-tc");
    expect(unico.historico).toEqual([]);
    expect(unico.imprimivelId).toBe("d-tc");

    const ciclo = resolverSubstituicao([
      { draftId: "a", rotulo: "TC", substituiDraftId: "b" },
      { draftId: "b", rotulo: "RM", substituiDraftId: "a" },
    ]);
    expect(ciclo.estado).toBe("VERMELHO");
    expect(ciclo.imprimivelId).toBeNull();
    expect(ciclo.motivo).toContain("ciclo");

    const cadeia = resolverSubstituicao([
      { draftId: "a", rotulo: "TC", substituiDraftId: null },
      { draftId: "b", rotulo: "RM", substituiDraftId: "a" },
      { draftId: "c", rotulo: "PET", substituiDraftId: "b" },
    ]);
    expect(cadeia.imprimivelId).toBe("c");
    expect(cadeia.historico.map((d) => d.rotulo)).toEqual(["TC", "RM"]);
  });
});
