import { describe, expect, it } from "vitest";
import type { ClinicalFact } from "../../../src/kernel/extracao/tipos.js";
import { DADOS_OBRIGATORIOS, faltantesObrigatorios, requiredBiomarkers } from "../../../src/kernel/extracao/biomarcadores.js";

function marcador(nome: string): ClinicalFact {
  return {
    id: `bm-${nome}`, segmentId: "seg-1", patientCandidateId: null, domain: "biomarker",
    sourceType: "pathology", evidence: "EXPLICIT", sourceId: "fonte-1", rawEvidence: `IHQ: ${nome}`,
    confidence: 1, requiresConfirmation: false, value: { marker: nome, value: "2+" },
  };
}

describe("FUGU-11b · Biomarker Requirement Engine (tabela de dados, não LLM)", () => {
  it("mama exige RE/RP/HER2/Ki-67 sempre e BRCA/PALB2 quando indicado, com fonte", () => {
    const r = requiredBiomarkers({ tumor: "mama" });
    expect(r.aplicavel).toBe(true);
    expect(r.tumor).toBe("mama");
    expect(r.fonte).toContain("D-W9-33");
    expect(r.biomarcadores.filter((b) => b.indicacao === "SEMPRE").map((b) => b.marcador))
      .toEqual(["RE", "RP", "HER2", "Ki-67"]);
    expect(r.biomarcadores.find((b) => b.marcador === "BRCA/PALB2")?.indicacao).toBe("QUANDO_INDICADO");
    expect(r.dadosObrigatorios).toEqual([...DADOS_OBRIGATORIOS]);
  });

  it("CPNPC adenocarcinoma IV exige os dez biomarcadores da spec §9", () => {
    const r = requiredBiomarkers({ tumor: "pulmão", histologia: "adenocarcinoma", estadio: "IV" });
    expect(r.biomarcadores.map((b) => b.marcador)).toEqual([
      "PD-L1", "EGFR", "ALK", "ROS1", "BRAF", "KRAS G12C", "MET éxon 14", "RET", "NTRK", "HER2",
    ]);
    expect(r.verificar).toEqual([]);
  });

  it("contexto sem tabela curada devolve [VERIFICAR] em vez de regra inventada", () => {
    const semEstadio = requiredBiomarkers({ tumor: "pulmão", histologia: "adenocarcinoma" });
    expect(semEstadio.biomarcadores).toEqual([]);
    expect(semEstadio.verificar.length).toBe(1);
    const prostata = requiredBiomarkers({ tumor: "próstata" });
    expect(prostata.verificar).toEqual(["prostata"]);
    expect(prostata.biomarcadores).toEqual([]);
  });

  it("sem tumor identificado não há exigência nenhuma", () => {
    const r = requiredBiomarkers({});
    expect(r).toMatchObject({ aplicavel: false, tumor: null, biomarcadores: [], dadosObrigatorios: [] });
  });

  it("campos obrigatórios ausentes viram MISSING_REQUIRED; presente não é cobrado", () => {
    const faltantes = faltantesObrigatorios([marcador("HER2")], requiredBiomarkers({ tumor: "mama" }), "seg-1");
    const campos = faltantes.map((f) => f.reason.replace(/^campo obrigatório ausente para mama: /, "").replace(/ \(NÃO SEI.*$/, ""));
    expect(campos).toEqual(["RE", "RP", "Ki-67", "HISTOLOGIA", "ESTADIAMENTO"]);
    expect(faltantes.every((f) => f.kind === "MISSING_REQUIRED" && f.segmentId === "seg-1")).toBe(true);
    const semExigencia = faltantesObrigatorios([marcador("HER2")], requiredBiomarkers({}), "seg-1");
    expect(semExigencia).toEqual([]);
  });
});