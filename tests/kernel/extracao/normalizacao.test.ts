import { describe, expect, it } from "vitest";
import type { ClinicalFact, FactDomain } from "../../../src/kernel/extracao/tipos.js";
import {
  dataCivilDoInstante, ehFebre, normalizarDataCivil, normalizarFarmaco, normalizarFatos,
  normalizarLab, normalizarLateralidade, normalizarSitioAnatomico, normalizarTemperatura,
  normalizarTnm, normalizarUnidade, orgaoCanonico,
} from "../../../src/kernel/extracao/normalizacao.js";

function fato(over: Partial<ClinicalFact> & { domain: FactDomain }): ClinicalFact {
  return {
    id: "f1", segmentId: "s1", patientCandidateId: null, value: null, sourceType: "medical_note",
    evidence: "EXPLICIT", sourceId: "src1", rawEvidence: "linha sintética",
    confidence: 1, requiresConfirmation: false, ...over,
  };
}

describe("FUGU-06 · unidades e temperatura", () => {
  it("canoniza as unidades aceitas e deixa o resto PENDENTE (null), sem adivinhar", () => {
    expect(normalizarUnidade("mg/dL")).toBe("mg/dL");
    expect(normalizarUnidade("g/dl")).toBe("g/dL");
    expect(normalizarUnidade("mm3")).toBe("mm³");
    expect(normalizarUnidade("x10³/µL")).toBe("×10³/µL");
    expect(normalizarUnidade("mil/mm3")).toBe("×10³/µL");
    expect(normalizarUnidade("c")).toBe("°C");
    expect(normalizarUnidade("UI/L")).toBeNull();
    expect(normalizarUnidade(undefined)).toBeNull();
  });

  it("normaliza lab preservando o texto original; valor ambíguo não vira número", () => {
    expect(normalizarLab({ marker: "Hb", value: "11,2", unit: "g/dL" }))
      .toEqual({ marker: "Hb", value: 11.2, unit: "g/dL", raw: "11,2 g/dL", normalizado: true });
    const falado = normalizarLab({ marker: "Creatinina", value: null, unit: null, raw: "Creatinina quatorze." });
    expect(falado).toMatchObject({ value: null, unit: null, normalizado: false });
    expect(falado.raw).toBe("Creatinina quatorze.");
  });

  it("°C com tempDecimos e febre estritamente > 37,8 (D-W9-38)", () => {
    expect(normalizarTemperatura("Temperatura 38,2 °C")).toEqual({ celsius: 38.2, tempDecimos: 382 });
    expect(normalizarTemperatura("36,5 C")).toEqual({ celsius: 36.5, tempDecimos: 365 });
    expect(normalizarTemperatura("sem temperatura")).toBeNull();
    expect(ehFebre(37.8)).toBe(false);
    expect(ehFebre(37.9)).toBe(true);
    expect(ehFebre(null)).toBe(false);
  });
});

describe("FUGU-06 · data civil no fuso do serviço", () => {
  it("converte datas brasileiras para civil e rejeita data impossível", () => {
    expect(normalizarDataCivil("15/08/29")).toBe("2029-08-15");
    expect(normalizarDataCivil("19/08/2029")).toBe("2029-08-19");
    expect(normalizarDataCivil("2026-07-10")).toBe("2026-07-10");
    expect(normalizarDataCivil("31/02/2029")).toBeNull();
    expect(normalizarDataCivil("sem data")).toBeNull();
  });

  it("instante com offset vira data civil em −03:00 (D-W5-01)", () => {
    expect(dataCivilDoInstante("2026-10-07T23:30:00-03:00")).toBe("2026-10-07");
    expect(dataCivilDoInstante("2026-10-08T01:30:00Z")).toBe("2026-10-07");
    expect(dataCivilDoInstante("2026-10-08T00:30:00-03:00")).toBe("2026-10-08");
    expect(dataCivilDoInstante("07/10/2026")).toBeNull();
  });
});

describe("FUGU-06 · lateralidade, sítio e fármaco", () => {
  it("lateralidade é validada contra o domínio do órgão (D-W9-05)", () => {
    expect(normalizarLateralidade("esquerda", "mama")).toBe("ESQUERDO");
    expect(normalizarLateralidade("à direita", "mama")).toBe("DIREITO");
    expect(normalizarLateralidade("transverso", "colon")).toBe("TRANSVERSO");
    expect(normalizarLateralidade("transverso", "mama")).toBeNull();
    expect(normalizarLateralidade("bilateral", "mama")).toBeNull();
  });

  it("sítio anatômico canônico só existe quando reconhecido", () => {
    expect(normalizarSitioAnatomico("mamária")).toBe("mama");
    expect(orgaoCanonico("Próstata")).toBe("prostata");
    expect(normalizarSitioAnatomico("L5")).toBeNull();
    expect(normalizarSitioAnatomico("região inominada")).toBeNull();
  });

  it("fármaco exato é EXPLICIT; aproximado é incerto com proveniência; desconhecido não normaliza", () => {
    expect(normalizarFarmaco("Carboplatina"))
      .toEqual({ raw: "Carboplatina", normalizado: "CARBOPLATINA", incerto: false, confidence: 1 });
    const aproximado = normalizarFarmaco("carboplatna");
    expect(aproximado).toMatchObject({ normalizado: "CARBOPLATINA", incerto: true, confidence: 0.72 });
    expect(normalizarFarmaco("letrum").normalizado).toBeNull();
  });
});

describe("FUGU-06 · TNM por sistema e edição", () => {
  it("prefixo define o tipo e a edição padrão é AJCC 8", () => {
    expect(normalizarTnm("cT2N0M0")).toMatchObject({
      literal: "cT2N0M0", prefixo: "c", tipo: "CLINICO", sistema: "AJCC 8", edicao: "8",
      pendenteConfirmacao: false,
    });
    expect(normalizarTnm("ypT2N1a")).toMatchObject({ prefixo: "yp", tipo: "POS_TRATAMENTO" });
    expect(normalizarTnm("pT3N0")).toMatchObject({ prefixo: "p", tipo: "PATOLOGICO" });
  });

  it("orofaringe só é AJCC 9 com HPV comprovado e vigência; senão fica 8 e pendente", () => {
    expect(normalizarTnm("cT2N1M0", { sitio: "orofaringe", data: "01/05/2026", hpvPositivo: true }))
      .toMatchObject({ sistema: "AJCC 9", edicao: "9", pendenteConfirmacao: false });
    expect(normalizarTnm("cT2N1M0", { sitio: "orofaringe", data: "01/05/2026" }))
      .toMatchObject({ sistema: "AJCC 8", pendenteConfirmacao: true });
    expect(normalizarTnm("cT2N1M0", { sitio: "orofaringe", data: "01/05/2025", hpvPositivo: true }))
      .toMatchObject({ sistema: "AJCC 8", pendenteConfirmacao: true });
  });
});

describe("FUGU-06 · aplicação sobre os fatos", () => {
  it("reescreve lab, stage, imaging e drug preservando raw/rawEvidence", () => {
    const fatos = normalizarFatos([
      fato({ domain: "lab", value: { marker: "Hb", value: "11,2", unit: "g/dL" }, rawEvidence: "Hb: 11,2 g/dL" }),
      fato({ id: "f2", domain: "stage", value: "cT2N0M0", rawEvidence: "cT2N0M0 documentado" }),
      fato({ id: "f3", domain: "imaging", value: { siteRaw: "L5", measureRaw: "24", unit: "mm", lateralityRaw: "esquerda" }, rawEvidence: "foco em L5 à esquerda medindo 24 mm" }),
      fato({ id: "f4", domain: "drug", value: "carboplatna", rawEvidence: "carboplatna" }),
    ]);
    expect(fatos[0]!.value).toMatchObject({ marker: "Hb", value: 11.2, unit: "g/dL", normalizado: true });
    expect(fatos[1]!.value).toMatchObject({ literal: "cT2N0M0", sistema: "AJCC 8" });
    expect(fatos[1]!.raw).toBe("cT2N0M0");
    expect(fatos[2]!.value).toMatchObject({ sitioCanonico: null, lateralidade: "ESQUERDO", measureMm: 24 });
    expect(fatos[3]!.value).toMatchObject({ normalizado: "CARBOPLATINA", incerto: true });
    expect(fatos[3]!.evidence).toBe("INFERRED");
    expect(fatos[3]!.regra).toBe("FARMACO-FONETICO");
    expect(fatos[3]!.requiresConfirmation).toBe(true);
    expect(fatos.every((f) => f.rawEvidence.trim() !== "")).toBe(true);
  });

  it("não normaliza o que não reconhece: lab sem unidade fica PENDENTE e drug desconhecido mantém raw", () => {
    const [lab] = normalizarFatos([fato({ domain: "lab", value: { marker: "X", value: "10", unit: "UI/L" } })]);
    expect(lab!.value).toMatchObject({ value: null, unit: null, normalizado: false });
    const [drug] = normalizarFatos([fato({ domain: "drug", value: "letrum" })]);
    expect(drug!.value).toBe("letrum");
    expect(drug!.raw).toBe("letrum");
    expect(drug!.evidence).toBe("EXPLICIT");
  });
});
