import { describe, expect, it } from "vitest";
import {
  aplicarAjustePercentual,
  prescricaoSintetica,
  rotuloClasse,
} from "../../src/ui/oncochart/prescricao-visao.js";

describe("CURSOR-10 prescrição visão", () => {
  it("tem 4 classes e só exceções destacáveis; −20% via helper (função sintética)", () => {
    const p = prescricaoSintetica();
    expect(p.classes).toEqual(["PRE_QT", "QT", "POS_QT", "NAO_ONCO"]);
    expect(rotuloClasse("NAO_ONCO")).toBe("NÃO ONCOLÓGICAS");
    expect(p.linhas.some((l) => l.excecao)).toBe(true);
    expect(aplicarAjustePercentual("100 mg", 20)).toBe("80 mg");
    expect(aplicarAjustePercentual("144 mg", 30)).toBe("100.8 mg");
  });
});
