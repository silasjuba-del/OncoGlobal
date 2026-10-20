import { describe, expect, it } from "vitest";
// proveniência: dados sintéticos - não utilizar em produção
import { extratorDeterministico } from "../../../src/kernel/extracao/extrator.js";
import { segmentarTranscricao } from "../../../src/kernel/extracao/segmenter.js";
import { reconciliarCampos } from "../../../src/kernel/extracao/reconciliacao.js";
import type { FactSourceType } from "../../../src/kernel/extracao/tipos.js";

function segment(text: string, sourceType: FactSourceType) {
  return segmentarTranscricao({
    recordingId: "doc-sintetico", sourceId: "fonte-sintetica", sourceType,
    turns: [{ text, startMs: null, endMs: null }],
  })[0]!;
}

describe("extrator: hipótese lexical não vira fato explícito (ARQ-03, recorte)", () => {
  it.each([
    "Paciente não sente dor.", "Paciente não apresentou dor.", "Paciente não apresentava náusea.",
    "Paciente nao sente dor.", "Ausência de dor.", "Dor ausente.",
    "Paciente sem piora da dor.",
  ])("negador com escopo não resolvido mantém candidato para revisão: %s", (frase) => {
    const facts = extratorDeterministico.extrair(segment(frase, "medical_note"));
    expect(facts.find(f => f.domain === "symptom")).toMatchObject({
      evidence: "UNCERTAIN", requiresConfirmation: true,
      qualificadores: { polaridade: "NAO_DETERMINADA" }, rawEvidence: frase,
    });
    expect(Object.values(reconciliarCampos(facts)).every(c => c.resolvedFactId === null)).toBe(true);
  });

  it.each([
    "Paciente não apresenta dor.", "Paciente não refere náusea.",
    "Paciente não relata formigamento.", "Paciente não tem dor.",
    "Paciente sem dor.", "Paciente sem náusea.",
  ])("negação sintomática não vira afirmação: %s", (frase) => {
    const facts = extratorDeterministico.extrair(segment(frase, "medical_note"));
    expect(facts.filter(f => f.domain === "symptom")).toHaveLength(0);
  });

  it("negação de uma cláusula preserva o sintoma afirmado na cláusula seguinte", () => {
    const frase = "Paciente não apresenta dor; paciente relata náusea.";
    const facts = extratorDeterministico.extrair(segment(frase, "medical_note"));
    expect(facts.filter(f => f.domain === "symptom")).toHaveLength(1);
    expect(facts.find(f => f.domain === "symptom")).toMatchObject({
      value: "paciente relata náusea.", evidence: "EXPLICIT", requiresConfirmation: false,
      qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" },
    });
    for (const positiva of ["Paciente apresenta dor.", "Paciente refere náusea.", "Paciente relata formigamento."]) {
      expect(extratorDeterministico.extrair(segment(positiva, "medical_note"))
        .find(f => f.domain === "symptom")).toMatchObject({ evidence: "EXPLICIT", requiresConfirmation: false });
    }
  });

  it("'possível' e 'suspeita' marcam UNCERTAIN + confirmação, com trecho literal preservado", () => {
    for (const frase of ["Possível lesão em L5 medindo 12 mm.", "Suspeita de lesão em fígado medindo 10 mm."]) {
      const facts = extratorDeterministico.extrair(segment(frase, "imaging_report"));
      const imagem = facts.find(f => f.domain === "imaging");
      expect(imagem, frase).toBeDefined();
      expect(imagem).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true });
      expect(imagem!.rawEvidence).toBe(frase);
      // Consumidor: candidato hipotético nunca é o fato resolvido do campo.
      const campos = reconciliarCampos(facts);
      expect(Object.values(campos).every(c => c.resolvedFactId === null)).toBe(true);
    }
  });

  it("controles: 'provável' já era incerto; afirmativa literal segue EXPLICIT; negação não produz achado positivo", () => {
    const provavel = extratorDeterministico.extrair(segment("Provável lesão em L5 medindo 12 mm.", "imaging_report"));
    expect(provavel.find(f => f.domain === "imaging")).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true });
    const afirmativa = extratorDeterministico.extrair(segment("Lesão em L5 medindo 12 mm.", "imaging_report"));
    expect(afirmativa.find(f => f.domain === "imaging")).toMatchObject({ evidence: "EXPLICIT", requiresConfirmation: false });
    expect(afirmativa.find(f => f.domain === "imaging")).toMatchObject({ qualificadores: {
      polaridade: "AFIRMADA", sujeito: "NAO_DETERMINADO", temporalidade: "NAO_DETERMINADA",
    } });
    expect(Object.values(reconciliarCampos(afirmativa)).some(c => c.resolvedFactId === afirmativa.find(f => f.domain === "imaging")?.id)).toBe(true);
    const negada = extratorDeterministico.extrair(segment("Não há lesão em L5 medindo 24 mm.", "imaging_report"));
    expect(negada.filter(f => f.domain === "imaging")).toHaveLength(0);
  });

  it("preserva qualifiers suportados literalmente e não transforma omissão em paciente atual", () => {
    const casos = [
      ["Em 2020 havia lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "NAO_DETERMINADO", temporalidade: "HISTORICA" }],
      ["A mãe tinha lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA" }],
      ["A avó tinha lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA" }],
      ["Paciente terá lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "FUTURA" }],
      ["Paciente apresenta lesão em L5 medindo 12 mm em 20/10/2026.", { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" }],
      ["Paciente apresenta lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" }],
      ["Lesão em L5 medindo 12 mm em 2026.", { polaridade: "AFIRMADA", sujeito: "NAO_DETERMINADO", temporalidade: "NAO_DETERMINADA" }],
      ["Lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "NAO_DETERMINADO", temporalidade: "NAO_DETERMINADA" }],
    ] as const;
    for (const [frase, qualificadores] of casos) {
      const facts = extratorDeterministico.extrair(segment(frase, "imaging_report"));
      const imagem = facts.find(f => f.domain === "imaging");
      expect(imagem, frase).toBeDefined();
      expect(imagem).toMatchObject({ qualificadores });
      expect(imagem?.rawEvidence).toBe(frase);
    }
    expect(extratorDeterministico.extrair(segment("Não há lesão em L5 medindo 12 mm.", "imaging_report"))
      .filter(f => f.domain === "imaging")).toHaveLength(0);
  });

  it("passado e terceiro ficam candidatos revisáveis e não resolvem campo atual", () => {
    for (const frase of ["Em 2020 havia lesão em L5 medindo 12 mm.", "A mãe tinha lesão em L5 medindo 12 mm.", "A avó tinha lesão em L5 medindo 12 mm.", "Paciente terá lesão em L5 medindo 12 mm."]) {
      const fact = extratorDeterministico.extrair(segment(frase, "imaging_report")).find(f => f.domain === "imaging");
      expect(fact, frase).toMatchObject({ requiresConfirmation: true });
      expect(Object.values(reconciliarCampos(fact ? [fact] : []))).toMatchObject([{ resolvedFactId: null }]);
    }
  });
});
