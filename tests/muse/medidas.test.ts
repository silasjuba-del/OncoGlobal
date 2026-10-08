import { expect, it } from "vitest";
import { avaliarSerieRecist, type RecistSerieInput } from "../../src/rules/recist/index.js";
import { validarUnidadeMedida } from "../../src/rules/medidas.js";
import { validarUnidadeMedida as flat } from "../../src/rules/recist.js";
import { validarUnidadeMedida as morfo } from "../../src/rules/morfometria/index.js";
it("RECIST e morfometria usam a mesma validação de unidade", () => {
  expect(flat).toBe(validarUnidadeMedida); expect(morfo).toBe(validarUnidadeMedida);
  expect(validarUnidadeMedida({ valor: 2, unidade: "cm" })).toMatchObject({ estado: "OK", valorMm: 20 });
  expect(validarUnidadeMedida({ valor: 2, unidade: null }).estado).toBe("PENDENTE");
});
it.each([["cm", 2, false], [null, 2, true], ["cm", 20, true]] as const)(
  "série confronta original %s/%s com diametroMm explícito", (unidadeOriginal, valorOriginal, pendente) => {
    const input: RecistSerieInput = { patientId: "Paciente Teste 01", tumorLotId: null, episodioId: "episodio",
      baselineEventId: "base", alvos: [{ codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR", orgaoId: "pulmao",
        elegibilidadeBasal: "ELEGIVEL", fonteElegibilidadeIds: ["fonte"] }], pontos: [{ eventId: "base",
        patientId: "Paciente Teste 01", tumorLotId: null, episodioId: "episodio", data: "2026-10-07", metodo: "TC",
        tecnicaId: "tc", espessuraCorteMm: 5, qualidadeMedicao: "ADEQUADA", novasLesoes: false,
        naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: ["fonte"],
        lesoes: [{ codigo: "L1", diametroMm: 20, unidadeOriginal, valorOriginal, fonteIds: ["fonte"] }] }] };
    expect(avaliarSerieRecist(input).pontos[0]?.pendencias.includes("UNIDADE_MEDIDA_PENDENTE")).toBe(pendente);
  });
