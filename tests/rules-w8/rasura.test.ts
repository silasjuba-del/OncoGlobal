import { describe, expect, it } from "vitest";
import { avaliarRasuraEConfianca } from "../../src/rules/w8/rasura.js";

describe("AG-06 · Trecho riscado e baixa confiança (lições R1, C1)", () => {
  it("R1: campo marcado como riscado vira PENDENTE, anula o valor e expõe recorteRef para conferência", () => {
    const res = avaliarRasuraEConfianca(
      {
        valor: "Volume prostático: 45 cc",
        riscado: true,
        confianca: 0.98,
        recorteRef: "img://recortes/caso07/rm_linha_riscada.png",
      },
      { limiarConfiancaMinima: 0.8 },
    );

    expect(res).toEqual({
      valor: null,
      estado: "PENDENTE",
      motivo: "trecho riscado à mão: não usar sem revisão médica (R1)",
      recorteRef: "img://recortes/caso07/rm_linha_riscada.png",
      pendenteRevisao: true,
    });
  });

  it("C1: campo com confiança abaixo do limiar vira PENDENTE com recorteRef", () => {
    const res = avaliarRasuraEConfianca(
      {
        valor: "PIRADS 4",
        riscado: false,
        confianca: 0.65,
        recorteRef: "img://recortes/caso07/foto_inclinada_baixo_contraste.png",
      },
      { limiarConfiancaMinima: 0.85 },
    );

    expect(res.estado).toBe("PENDENTE");
    expect(res.valor).toBeNull();
    expect(res.pendenteRevisao).toBe(true);
    expect(res.motivo).toContain("baixa confiança");
    expect(res.recorteRef).toBe("img://recortes/caso07/foto_inclinada_baixo_contraste.png");
  });

  it("prova que o limiar não é fixo: o mesmo score passa a ser aceito se o ruleset injetar limiar menor", () => {
    const campo = {
      valor: "Sem linfonodomegalias",
      riscado: false,
      confianca: 0.72,
    };

    // Com limiar alto de 0.80 -> PENDENTE
    const reprovado = avaliarRasuraEConfianca(campo, { limiarConfiancaMinima: 0.8 });
    expect(reprovado.estado).toBe("PENDENTE");

    // Com limiar permissivo de 0.70 -> VERDE
    const aprovado = avaliarRasuraEConfianca(campo, { limiarConfiancaMinima: 0.7 });
    expect(aprovado.estado).toBe("VERDE");
    expect(aprovado.valor).toBe("Sem linfonodomegalias");
  });

  it("campo íntegro acima do limiar resulta em VERDE", () => {
    const res = avaliarRasuraEConfianca(
      {
        valor: "Gleason 4+3",
        riscado: false,
        confianca: 0.95,
        recorteRef: "img://recortes/bx_clara.png",
      },
      { limiarConfiancaMinima: 0.85 },
    );

    expect(res).toEqual({
      valor: "Gleason 4+3",
      estado: "VERDE",
      motivo: "extração íntegra e confiança satisfatória",
      recorteRef: "img://recortes/bx_clara.png",
      pendenteRevisao: false,
    });
  });
});
