import { describe, expect, it } from "vitest";
import type { ClinicalFact } from "../../src/contracts/w10/extracao.js";
import { projetarRetratoTransversal } from "../../src/server/retratoTransversal.js";

const fato = (overrides: Partial<ClinicalFact> = {}): ClinicalFact => ({
  id: "fact-a", segmentId: "segment-a", patientCandidateId: null, domain: "histology",
  value: "Adenocarcinoma invasivo", sourceType: "pathology", evidence: "EXPLICIT",
  sourceId: "laudo-a", rawEvidence: "Histologia: Adenocarcinoma invasivo", date: "2026-03-10",
  confidence: 1, requiresConfirmation: false, ...overrides,
});

describe("projeção do retrato transversal a partir de fatos revisados", () => {
  it("copia histologia literal de AP com fonte e mantém os demais campos ausentes, salvo TNM literal prefixado", () => {
    const retrato = projetarRetratoTransversal({ patientId: "Paciente Teste 81", tumorLotId: "lote-confirmado-81",
      fatos: [fato(), fato({ id: "fact-tnm", domain: "stage", value: "cT2N0M0", sourceId: "laudo-estadio" })] });
    expect(retrato).not.toBeNull();
    expect(retrato).toMatchObject({ pacienteRef: "Paciente Teste 81", tumorIndice: true, extensao: null,
      nucleo: { histologia: { estado: "VALOR", valor: "Adenocarcinoma invasivo",
        origem: { tipo: "LAUDO", documentoId: "laudo-a", dataDocumento: "2026-03-10",
          trecho: "Histologia: Adenocarcinoma invasivo" } }, cTNM: { estado: "VALOR", valor: "cT2N0M0" },
        pTNM: { estado: "NAO_INFORMADO", valor: null }, ypTNM: { estado: "NAO_INFORMADO", valor: null },
        lateralidade: { estado: "NAO_INFORMADO", valor: null }, topografia: { estado: "NAO_INFORMADO", valor: null } } });
  });

  it("ignora fontes sem rótulo de AP, fatos inferidos, pendentes e candidatos de identidade", () => {
    const retrato = projetarRetratoTransversal({ patientId: "Paciente Teste 82", tumorLotId: "lote-82",
      fatos: [
        fato({ id: "referral", sourceType: "medical_note", sourceId: "encaminhamento" }),
        fato({ id: "inferred", evidence: "INFERRED", regra: "r-qualquer" }),
        fato({ id: "confirmar", requiresConfirmation: true }),
        fato({ id: "unlinked-candidate", patientCandidateId: "candidato-99" }),
        fato({ id: "negated-value", value: { text: "Adenocarcinoma", negated: true } }),
      ] });
    expect(retrato?.nucleo.histologia).toMatchObject({ estado: "NAO_INFORMADO", valor: null, origem: null });
  });

  it("mantém todos os candidatos de histologia conflitante sem eleger um", () => {
    const retrato = projetarRetratoTransversal({ patientId: "Paciente Teste 83", tumorLotId: "lote-83",
      fatos: [fato({ id: "fact-z", sourceId: "laudo-z", value: "Carcinoma escamoso" }),
        fato({ id: "fact-a", sourceId: "laudo-a", value: "Adenocarcinoma" })] });
    expect(retrato?.nucleo.histologia).toMatchObject({ estado: "CONFLITO", valor: null, origem: null,
      candidatos: [
        { valor: "Adenocarcinoma", origem: { documentoId: "laudo-a" } },
        { valor: "Carcinoma escamoso", origem: { documentoId: "laudo-z" } },
      ] });
  });

  it("preserva fontes iguais em ordem estável e não afirma tumor-índice sem lote confirmado", () => {
    const entrada = { patientId: "Paciente Teste 84", tumorLotId: "lote-84", fatos: [
      fato({ id: "fact-z", sourceId: "laudo-z" }), fato({ id: "fact-a", sourceId: "laudo-a" }),
    ] };
    const primeiro = projetarRetratoTransversal(entrada);
    const invertido = projetarRetratoTransversal({ ...entrada, fatos: [...entrada.fatos].reverse() });
    expect(primeiro?.nucleo.histologia).toMatchObject({ estado: "VALOR", origem: { documentoId: "laudo-a" },
      candidatos: [{ origem: { documentoId: "laudo-a" } }, { origem: { documentoId: "laudo-z" } }] });
    expect(invertido?.nucleo.histologia).toEqual(primeiro?.nucleo.histologia);
    expect(projetarRetratoTransversal({ patientId: "Paciente Teste 84", tumorLotId: null, fatos: entrada.fatos })).toBeNull();
  });

  it("não promove TNM sem prefixo c/p/yp explícito e só aceita extensão estruturada válida", () => {
    const retrato = projetarRetratoTransversal({ patientId: "Paciente Teste 85", tumorLotId: "lote-85",
      fatos: [fato({ id: "stage-no-prefix", domain: "stage", value: "T2N0M0" })], extensao: { tumor: "PROSTATA" } });
    expect(retrato?.nucleo.cTNM).toMatchObject({ estado: "NAO_INFORMADO", valor: null });
    expect(retrato?.nucleo.pTNM).toMatchObject({ estado: "NAO_INFORMADO", valor: null });
    expect(retrato?.extensao).toBeNull();
  });

  it("retém uma extensão somente quando o objeto fornecido satisfaz o contrato tumoral", () => {
    const campoPendente = { estado: "NAO_INFORMADO", valor: null, origem: null };
    const extensao = { tumor: "PROSTATA", gleason: campoPendente, isup: campoPendente,
      psaNgMl: campoPendente, fragmentosPositivos: campoPendente };
    const retrato = projetarRetratoTransversal({ patientId: "Paciente Teste 86", tumorLotId: "lote-86",
      fatos: [], extensao });
    expect(retrato?.extensao).toMatchObject({ tumor: "PROSTATA" });
    expect(projetarRetratoTransversal({ patientId: "Paciente Teste 86", tumorLotId: "lote-86",
      fatos: [], extensao: { tumor: "PROSTATA" } })?.extensao).toBeNull();
  });
});
