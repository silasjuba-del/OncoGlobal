// GROK-07 · nódulo < 1 cm fica INDETERMINADO; Mx é sugestão (D-W9-31).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  avaliarNodulo,
  lerNodulo,
  sugerirMx,
  type RulesetNodulo,
} from "../../src/rules/noduloIndeterminado.js";

const rs = lerNodulo(JSON.parse(readFileSync("corpus/rulesets/rads-nodulo.v1.json", "utf8")));

describe("GROK-07 nódulo e Mx", () => {
  it("6–7 mm e 9 mm ficam INDETERMINADO, com a pendência da decisão, e não geram M1", () => {
    for (const texto of ["nódulo de 6–7 mm", "nódulo de 6-7 mm", "nódulo de 6 a 7 mm"]) {
      const r = avaliarNodulo({ texto, medidaMm: null }, rs);
      expect(r.classificacao).toBe("INDETERMINADO");
      expect(r.estado).toBe("ALERTA");
      expect(r.bloqueiaSalvar).toBe(false);
      expect(r.geraM1).toBe(false);
      expect(r.pendencia).toBe("TC em 4 meses comparando");
      expect(r.motivos[0]?.texto).toContain("D-W9-31");
      expect(r.motivos[0]?.texto).toContain("Não gera M1");
    }
    const nove = avaliarNodulo({ texto: null, medidaMm: 9 }, rs);
    expect(nove.classificacao).toBe("INDETERMINADO");
    expect(nove.geraM1).toBe(false);
    const cm = avaliarNodulo({ texto: "0,9 cm", medidaMm: null }, rs);
    expect(cm.classificacao).toBe("INDETERMINADO");
    expect(cm.geraM1).toBe(false);
  });

  it("1 cm e 10 mm não ficam INDETERMINADO e não viram M1", () => {
    expect(avaliarNodulo({ texto: "nódulo de 1 cm", medidaMm: null }, rs).classificacao).toBeNull();
    expect(avaliarNodulo({ texto: "nódulo de 10 mm", medidaMm: null }, rs).estado).toBe("SEM_ALERTA");
    const igual = avaliarNodulo({ texto: null, medidaMm: 10 }, rs);
    expect(igual.classificacao).toBeNull();
    expect(igual.geraM1).toBe(false);
    expect(igual.estado).toBe("SEM_ALERTA");
    const acima = avaliarNodulo({ texto: "12 mm", medidaMm: null }, rs);
    expect(acima.classificacao).toBeNull();
    expect(acima.geraM1).toBe(false);
  });

  it("o limite vem do ruleset; faixa que cruza 1 cm não vira M1", () => {
    const baixo: RulesetNodulo = { ...rs, limiteExclusivoMm: 5 };
    expect(avaliarNodulo({ texto: "6 mm", medidaMm: null }, baixo).classificacao).toBeNull();
    const cruza = avaliarNodulo({ texto: "8–12 mm", medidaMm: null }, rs);
    expect(cruza.classificacao).toBeNull();
    expect(cruza.estado).toBe("PENDENTE");
    expect(cruza.geraM1).toBe(false);
    expect(cruza.pendencias[0]?.codigo).toBe("pendente.nodulo.faixa");
  });

  it("medida ausente fica PENDENTE e não vira 0; texto e número divergentes não somem", () => {
    const ausente = avaliarNodulo({ texto: "nódulo pulmonar", medidaMm: null }, rs);
    expect(ausente.estado).toBe("PENDENTE");
    expect(ausente.classificacao).toBeNull();
    expect(ausente.geraM1).toBe(false);
    expect(ausente.pendencias[0]?.texto).toContain("Não vira 0");
    const conflito = avaliarNodulo({ texto: "6–7 mm", medidaMm: 14 }, rs);
    expect(conflito.estado).toBe("PENDENTE");
    expect(conflito.classificacao).toBeNull();
    expect(conflito.geraM1).toBe(false);
    expect(conflito.pendencias[0]?.codigo).toBe("pendente.nodulo.conflito");
  });

  it("Mx sugere cM0 com nódulos indeterminados e não troca o texto", () => {
    const original = "cT2 cN1 Mx — texto do médico";
    const r = sugerirMx({ texto: original }, rs);
    expect(r.estado).toBe("ALERTA");
    expect(r.sugestao).toBe("cM0 com nódulos indeterminados");
    expect(r.textoOriginal).toBe(original);
    expect(r.substituiu).toBe(false);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.motivos[0]?.texto).toContain("sem trocar o texto");
    expect(r.motivos[0]?.texto).toContain("D-W9-31");
    expect(sugerirMx({ texto: "cT2N0Mx" }, rs).sugestao).toBe("cM0 com nódulos indeterminados");
    expect(sugerirMx({ texto: "cT2 cN0 cM0" }, rs).estado).toBe("SEM_ALERTA");
    expect(sugerirMx({ texto: "Máximo de 2 cm" }, rs).sugestao).toBeNull();
    expect(sugerirMx({ texto: null }, rs).estado).toBe("SEM_ALERTA");
  });
});
