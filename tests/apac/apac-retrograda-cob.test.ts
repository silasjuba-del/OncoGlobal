import { describe, expect, it } from "vitest";
import { apacRetrograda } from "../../src/rules/apac.js";

// FN-13 / T-31: negativa externa aponta ao campo de origem, sem redigitar APAC.
describe("FN-13 / T-31: pendencia retrograda da APAC", () => {
  const base = { apacId: "apac-sintetica-01", comprovanteRef: "comprovante-local-opaco" };

  it.each([
    ["HISTOLOGIA_AUSENTE", "histologia"],
    ["TOPOGRAFIA_AUSENTE", "topografia"],
    ["CID_AUSENTE", "cid"],
  ] as const)("positivo: %s aponta ao campo %s, preservando o comprovante", (codigo, campoOrigem) => {
    expect(apacRetrograda({ ...base, codigo })).toEqual({
      ...base, campoOrigem, estado: "PENDENTE",
    });
  });

  it("negativo: sem comprovante externo nao cria pendencia clinica", () => {
    expect(() => apacRetrograda({
      ...base, codigo: "HISTOLOGIA_AUSENTE", comprovanteRef: "",
    })).toThrow("NEGATIVA_SEM_COMPROVANTE");
  });

  it("borda: negativa OUTRO nao atribui campo clinico por palpite", () => {
    expect(apacRetrograda({ ...base, codigo: "OUTRO" })).toEqual({
      ...base, campoOrigem: null, estado: "PENDENTE",
    });
  });
});
