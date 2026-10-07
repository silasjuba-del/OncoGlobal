// W10-INT-PRESC-05 · porta da morfometria + complementos RECIST (RT-06a/b/c/d). Fixtures sintéticas.
import { describe, expect, it } from "vitest";
import {
  avaliarLinfonodoAlvo, avaliarRecistComNovasLesoes, calcularVolume, eixoCurtoMm, medirLesao, morfometria, validarUnidadeMedida,
} from "../../src/rules/morfometria/index.js";
import { rulerScaleMmPerPx, trapezoidVolumeMm3 } from "../../src/rules/morfometria/morfometriaCore.js";

const reguaH = { direcao: "HORIZONTAL" as const, comprimentoMm: 30, comprimentoPx: 150 };

describe("RT-06d · medirLesao recusa o que a skill v4.0 proíbe", () => {
  it("anatomia média, máscara probabilística e modo desconhecido ⇒ recusado", () => {
    expect(medirLesao({ modo: "2D_CALIBRADO", escala: "ANATOMIA_MEDIA", medidasPx: [120, 90] })).toMatchObject({ recusado: true, reviewRequired: true });
    expect(medirLesao({ modo: "2D_CALIBRADO", escala: "ANATOMIA_MEDIA" }).motivo).toMatch(/anatomia/iu);
    expect(medirLesao({ modo: "VISUAL", entrada: "MASCARA_PROBABILISTICA" }).recusado).toBe(true);
    expect(medirLesao({ modo: "MAGICO" }).recusado).toBe(true);
  });
  it("MF ausente não vira 1,0; MF sem documentação não divide automaticamente", () => {
    const a = medirLesao({ modo: "2D_CALIBRADO", magnificacaoMF: null, medidasPx: [100] });
    expect(a).toMatchObject({ recusado: true, fator: null });
    expect(a.motivo).toMatch(/1,0/u);
    expect(medirLesao({ modo: "2D_CALIBRADO", magnificacaoMF: 1.3, medidasPx: [100] }).motivo).toMatch(/documentar/iu);
    expect(medirLesao({ modo: "2D_CALIBRADO", medidasPx: [100] }).recusado).toBe(true);
  });
  it("régua horizontal não calibra a vertical (sem isotropia demonstrada); com isotropia, sim", () => {
    const v = medirLesao({ modo: "2D_CALIBRADO", regua: reguaH, medida: { direcao: "VERTICAL", comprimentoPx: 60 } });
    expect(v.recusado).toBe(true);
    expect(v.motivo).toMatch(/vertical/iu);
    const iso = medirLesao({ modo: "2D_CALIBRADO", regua: { ...reguaH, isotropicaDemonstrada: true }, medida: { direcao: "VERTICAL", comprimentoPx: 60 } });
    expect(iso).toMatchObject({ recusado: false, medidaMm: 12 });
  });
  it("2D calibrado válido: mm = px × (mm/px), equivalente ao núcleo; REVIEW_REQUIRED; sem resposta", () => {
    const s = medirLesao({ modo: "2D_CALIBRADO", regua: reguaH, medida: { direcao: "HORIZONTAL", comprimentoPx: 150 } });
    expect(s).toMatchObject({ recusado: false, reviewRequired: true, medidaMm: 30, fator: rulerScaleMmPerPx(30, 150) });
    expect("resposta" in s).toBe(false);
    expect(medirLesao({ modo: "2D_CALIBRADO", regua: { ...reguaH, comprimentoPx: 0 } }).recusado).toBe(true);
    expect(morfometria).toBe(medirLesao);
  });
  it("VISUAL não produz número", () => {
    expect(medirLesao({ modo: "VISUAL" })).toMatchObject({ recusado: false, medidaMm: null, reviewRequired: true });
  });
  it("3D: polo truncado/não observado recusa; trapézio equivale ao núcleo", () => {
    expect(calcularVolume({ modo: "3D_GEOMETRICO", fatias: [{ poloSuperior: "TRUNCADO" }] }).motivo).toMatch(/polo|trunc/iu);
    expect(medirLesao({ modo: "3D_GEOMETRICO", fatias: [{}, {}] }).recusado).toBe(true);
    expect(medirLesao({ modo: "3D_GEOMETRICO", fatias: [] }).recusado).toBe(true);
    const fatias = [{ poloSuperior: "OBSERVADO" as const }, {}, { poloInferior: "OBSERVADO" as const }];
    const areasMm2 = [0, 100, 0], posicoesMm = [0, 2, 4];
    const v = calcularVolume({ modo: "3D_GEOMETRICO", fatias, areasMm2, posicoesMm });
    expect(v.volumeMm3).toBe(trapezoidVolumeMm3(areasMm2, posicoesMm, { coverageComplete: true, samplingVerified: true }));
    expect(calcularVolume({ modo: "3D_GEOMETRICO", fatias, areasMm2: [50, 100, 0], posicoesMm }).motivo).toMatch(/polos/u);
    expect(calcularVolume({ modo: "3D_GEOMETRICO", fatias, areasMm2, posicoesMm: [0, 2, 2] }).recusado).toBe(true);
    expect(calcularVolume({ modo: "2D_CALIBRADO" }).recusado).toBe(true);
    expect(calcularVolume({ modo: "3D_GEOMETRICO", fatias }).recusado).toBe(true);
  });
});

describe("RT-06a · lesão nova ⇒ PD", () => {
  it("nova confirmada vira PD mesmo com alvos em PR/SD/CR", () => {
    for (const alvo of ["CR", "PR", "SD", null] as const) {
      const r = avaliarRecistComNovasLesoes(alvo, [{ codigo: "N1", confirmadaPorMedico: true }]);
      expect(r).toMatchObject({ candidate_response: "PD", origem: "NOVA_LESAO", estado: "PENDENTE" });
    }
  });
  it("nova NÃO confirmada retém a resposta (nunca SD/PR/CR); alvo PD se mantém", () => {
    expect(avaliarRecistComNovasLesoes("PR", [{ codigo: "N1", confirmadaPorMedico: false }]).candidate_response).toBeNull();
    expect(avaliarRecistComNovasLesoes("PR", [{ codigo: "N1", confirmadaPorMedico: true, inequivoca: false }]).candidate_response).toBeNull();
    expect(avaliarRecistComNovasLesoes("PD", [{ codigo: "N1", confirmadaPorMedico: false }])).toMatchObject({ candidate_response: "PD", origem: "ALVOS" });
  });
  it("sem lesão nova: candidato dos alvos intacto", () => {
    expect(avaliarRecistComNovasLesoes("SD", [])).toMatchObject({ candidate_response: "SD", origem: "ALVOS" });
  });
});

describe("RT-06b · linfonodo por eixo curto", () => {
  it("8 mm não é alvo e não soma; 12 mm patológico não-alvo; 16 mm elegível; ausente PENDENTE", () => {
    expect(avaliarLinfonodoAlvo({ codigo: "LN1", eixoCurtoMm: 8 })).toMatchObject({ classe: "NORMAL_NAO_ALVO", contaNaSoma: false });
    expect(avaliarLinfonodoAlvo({ codigo: "LN1", eixoCurtoMm: 12 })).toMatchObject({ classe: "PATOLOGICO_NAO_ALVO", contaNaSoma: false });
    expect(avaliarLinfonodoAlvo({ codigo: "LN1", eixoCurtoMm: 15 })).toMatchObject({ classe: "ALVO_ELEGIVEL", contaNaSoma: true });
    expect(avaliarLinfonodoAlvo({ codigo: "LN1", eixoCurtoMm: null })).toMatchObject({ classe: "PENDENTE", contaNaSoma: false });
    expect(avaliarLinfonodoAlvo({ codigo: "LN1", eixoCurtoMm: 10 }, { normalMenorQueMm: 10, alvoMinMm: 10 }).classe).toBe("ALVO_ELEGIVEL");
    expect(eixoCurtoMm({ eixoCurtoMm: -1 })).toBeNull();
  });
});

describe("RT-06c · unidade e corte", () => {
  it("cm converte para mm; ausência de unidade nunca é presumida", () => {
    expect(validarUnidadeMedida({ valor: 3.4, unidade: "cm" })).toEqual({ estado: "OK", valorMm: 34, convertido: true, motivos: [] });
    expect(validarUnidadeMedida({ valor: 34, unidade: "mm" })).toMatchObject({ estado: "OK", valorMm: 34, convertido: false });
    expect(validarUnidadeMedida({ valor: 34, unidade: null })).toMatchObject({ estado: "PENDENTE", valorMm: null });
    expect(validarUnidadeMedida({ valor: null, unidade: "mm" }).estado).toBe("PENDENTE");
  });
  it("3,4 cm digitado como 34 (cm) vs anterior 34 mm ⇒ PENDENTE por fator 10", () => {
    const r = validarUnidadeMedida({ valor: 34, unidade: "cm", anteriorMm: 34 });
    expect(r.estado).toBe("PENDENTE");
    expect(r.motivos.join(" ")).toMatch(/cm×mm/u);
    expect(validarUnidadeMedida({ valor: 30, unidade: "mm", anteriorMm: 34 }).estado).toBe("OK");
  });
  it("cortes diferentes entre exames ⇒ PENDENTE", () => {
    expect(validarUnidadeMedida({ valor: 20, unidade: "mm", corte: "série 4", corteAnterior: "série 7" }).motivos[0]).toMatch(/cortes diferentes/u);
    expect(validarUnidadeMedida({ valor: 20, unidade: "mm", corte: "série 4", corteAnterior: null }).estado).toBe("PENDENTE");
    expect(validarUnidadeMedida({ valor: 20, unidade: "mm", corte: "Série 4", corteAnterior: "série 4" }).estado).toBe("OK");
  });
});
