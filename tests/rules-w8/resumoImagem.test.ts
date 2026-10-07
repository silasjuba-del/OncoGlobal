import { describe, expect, it } from "vitest";
import { gerarResumoImagem } from "../../src/rules/w8/resumoImagem.js";

describe("AG-08 · Resumo de imagem em 2 níveis (lições §3, S2)", () => {
  it("gera Resumo 1 (sede + tamanho) e Resumo 2 (8 campos com 1 palavra cada)", () => {
    const res = gerarResumoImagem({
      sede: "Próstata (zona periférica)",
      tamanho: "1.8 cm",
      achados: {
        lesao: "nodular",
        dimensaoRecist: "18mm",
        linfonodos: "sem linfonodomegalias",
        osso: "sem lesoes osseas",
        pleura: null, // não descrito
        orgaosAdjacentes: "livre",
        infiltracaoObstrucaoPerfuracao: "ausente",
        naoOncologicos: null,
      },
    });

    expect(res.resumo1).toEqual({
      sede: "Próstata (zona periférica)",
      tamanho: "1.8 cm",
    });

    expect(res.resumo2).toEqual({
      lesao: "nodular",
      dimensaoRecist: "18mm",
      linfonodos: "ausente",
      osso: "ausente",
      pleura: "nao_descrito",
      orgaosAdjacentes: "ausente",
      infiltracaoObstrucaoPerfuracao: "ausente",
      naoOncologicos: "nao_descrito",
    });
    expect(res.estado).toBe("VERDE");
  });

  it("distingue categoricamente 'ausente' de 'nao_descrito'", () => {
    const res = gerarResumoImagem({
      achados: {
        linfonodos: "ausente", // Negação explícita no laudo
        pleura: null,          // Campo omitido no laudo
      },
    });

    expect(res.resumo2.linfonodos).toBe("ausente");
    expect(res.resumo2.pleura).toBe("nao_descrito");
    expect(res.resumo2.linfonodos).not.toBe(res.resumo2.pleura);
  });

  it("S2: captação articular/degenerativa em cintilografia NUNCA vira 'osso: lesao'", () => {
    const res = gerarResumoImagem({
      sede: "Esqueleto total",
      tamanho: null,
      textoLaudo: "Cintilografia óssea: captação articular em joelhos e coluna lombar por artrose. Sem lesões metastáticas.",
      achados: {
        osso: "captacao", // Título de hiperfixação decorrente de artrose
        naoOncologicos: "artrose",
      },
    });

    // osso NUNCA pode ser lesão/captação neoplásica
    expect(res.resumo2.osso).toBe("ausente");
    // achado não oncológico recebe a menção degenerativa
    expect(res.resumo2.naoOncologicos).toBe("degenerativo");
  });

  it("trecho riscado transforma os campos em PENDENTE", () => {
    const res = gerarResumoImagem({
      sede: "Próstata",
      tamanho: "4.5 cm",
      trechoRiscado: true,
      achados: {
        lesao: "nodular",
      },
    });

    expect(res.resumo1.sede).toBeNull();
    expect(res.resumo1.tamanho).toBeNull();
    expect(res.resumo2.lesao).toBe("PENDENTE");
    expect(res.estado).toBe("PENDENTE");
    expect(res.motivo).toContain("rasura");
  });
});
