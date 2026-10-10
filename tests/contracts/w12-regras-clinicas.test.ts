import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Triagem } from "../../src/contracts/clinico.js";
import { SalaoRuleset } from "../../src/contracts/regras.js";
import { triagemBase } from "../fixtures/triagem.js";

describe("contratos clínicos W12", () => {
  it("lê evento legado sem inventar histórico ou início e preserva o original", () => {
    const { vertigemHistoricoAnterior: _a, vertigemInicioNovo: _b, ...legado } = triagemBase();
    const antes = JSON.stringify(legado);
    expect(Triagem.parse(legado)).toMatchObject({ vertigemHistoricoAnterior: null, vertigemInicioNovo: null });
    expect(JSON.stringify(legado)).toBe(antes);
  });
  it("representa histórico e início da vertigem desconhecidos como null", () => {
    const triagem = triagemBase({ vertigemHistoricoAnterior: null, vertigemInicioNovo: null });
    expect(Triagem.parse(triagem)).toMatchObject({
      vertigemHistoricoAnterior: null,
      vertigemInicioNovo: null,
    });
  });

  it("publica fcMin e não mantém o corte por tontura no ruleset", () => {
    const json = JSON.parse(readFileSync("corpus/rulesets/salao-triagem.v1.json", "utf8"));
    const ruleset = SalaoRuleset.parse(json);
    expect(ruleset.cortes.fcMin).toBe(50);
    expect(ruleset.cortes).not.toHaveProperty("fcMinNaoCorta");
    expect(ruleset.cortes).not.toHaveProperty("ecog2ComTonturaCorta");
  });
});
