// GLM-09 · parseSigtapCsv: pura, com CSV SINTÉTICO de 3 linhas; sem código real e sem rede.
import { describe, expect, it } from "vitest";
import { parseSigtapCsv } from "../../scripts/sigtap-import.mjs";

const padrao = { separador: ";", colunas: { codigo: 0, nome: 1 } };

describe("parseSigtapCsv (função pura)", () => {
  it("parseia CSV sintético de 3 linhas com o mapeamento padrão", () => {
    const csv = [
      "03.04.03.014-3;QUIMIOTERAPIA DE TUMOR SINTETICO A",
      "03.04.03.015-1;QUIMIOTERAPIA DE TUMOR SINTETICO B",
      "03.04.03.016-0;QUIMIOTERAPIA; observing extra coluna",
    ].join("\r\n");
    const r = parseSigtapCsv(csv, "2026-10", padrao);
    expect(r.competencia).toBe("2026-10");
    expect(r.procedimentos.length).toBe(3);
    expect(r.procedimentos[0]).toEqual({ codigo: "03.04.03.014-3", nome: "QUIMIOTERAPIA DE TUMOR SINTETICO A" });
    expect(r.procedimentos[2]?.nome).toBe("QUIMIOTERAPIA");
  });

  it("respeita mapeamento de colunas alternativo e separador configurável (formato oficial é [VERIFICAR])", () => {
    const csv = "nome qualquer,10.01.02.003-0\nOutro Nome,10.01.02.004-9";
    const r = parseSigtapCsv(csv, "2026-11", { separador: ",", colunas: { codigo: 1, nome: 0 } });
    expect(r.procedimentos[0]).toEqual({ codigo: "10.01.02.003-0", nome: "nome qualquer" });
  });

  it("suporta linha de cabeçalho e campos entre aspas com separador interno", () => {
    const csv = 'CODIGO;NOME\n"03.04.03.014-3";"PROCEDIMENTO; COM PONTO E VIRGULA"';
    const r = parseSigtapCsv(csv, "2026-10", { ...padrao, primeiraLinhaCabecalho: true });
    expect(r.procedimentos).toEqual([{ codigo: "03.04.03.014-3", nome: "PROCEDIMENTO; COM PONTO E VIRGULA" }]);
  });

  it("rejeita competencia fora de YYYY-MM", () => {
    for (const ruim of ["202610", "2026-13", "26-10", ""])
      expect(() => parseSigtapCsv("a;b", ruim, padrao)).toThrow(/competencia/);
  });

  it("rejeita mapeamento sem codigo/nome e coluna inexistente", () => {
    expect(() => parseSigtapCsv("a;b", "2026-10", { colunas: { nome: 1 } })).toThrow(/mapeamento/);
    expect(() => parseSigtapCsv("a;b", "2026-10", { colunas: { codigo: 0, nome: 5 } })).toThrow(/coluna 5/);
  });
});
