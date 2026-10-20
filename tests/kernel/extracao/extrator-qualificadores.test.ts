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
    "Diagnóstico: câncer. “Biomarcadores não disponíveis.”",
    "Diagnóstico: câncer.) Biomarcadores não disponíveis.",
    "“Diagnóstico: câncer.” Biomarcadores não disponíveis.",
    "“Diagnóstico: câncer.”) Biomarcadores não disponíveis.",
    "‘Diagnóstico: câncer.’ Biomarcadores não disponíveis.",
    "Diagnóstico: câncer. ‘Biomarcadores não disponíveis.’",
    "Diagnóstico: câncer. (Biomarcadores não disponíveis.)",
    "Diagnóstico: câncer etc. Biomarcadores não disponíveis.",
  ])("isola a negação posterior com aspas, parênteses ou fim de lista: %s", (frase) => {
    expect(extratorDeterministico.extrair(segment(frase, "medical_note"))
      .find(f => f.domain === "diagnosis")).toMatchObject({
        evidence: "EXPLICIT", requiresConfirmation: false, rawEvidence: frase,
      });
  });

  it("negação em outra sentença não torna diagnóstico e hemoglobina explícitos incertos", () => {
    const diagnostico = "Diagnóstico oncológico: câncer de cólon metastático. Tratamento informado: FOLFIRI em curso. Biomarcadores: não disponíveis no material apresentado.";
    const laboratorio = "09/10/2026 Hemoglobina 8,2 g/dL. Neutrofilos: nao informado.";
    expect(extratorDeterministico.extrair(segment(diagnostico, "medical_note"))
      .find(f => f.domain === "diagnosis")).toMatchObject({
        evidence: "EXPLICIT", requiresConfirmation: false, rawEvidence: diagnostico,
      });
    expect(extratorDeterministico.extrair(segment(laboratorio, "medical_note"))
      .find(f => f.domain === "lab")).toMatchObject({
        evidence: "EXPLICIT", requiresConfirmation: false, value: { marker: "Hemoglobina", value: "8,2" },
      });
  });

  it("separa sentenças sem cortar decimal nem abreviação e preserva relato positivo após negação", () => {
    const sintomas = extratorDeterministico.extrair(segment("Paciente não apresenta dor. Paciente relata náusea.", "medical_note"));
    expect(sintomas.filter(f => f.domain === "symptom")).toHaveLength(1);
    expect(sintomas.find(f => f.domain === "symptom")).toMatchObject({ value: "Paciente relata náusea.", evidence: "EXPLICIT" });
    const imagem = extratorDeterministico.extrair(segment("Lesão em L5 medindo 1.2 cm. Paciente não apresenta dor.", "imaging_report"));
    expect(imagem.find(f => f.domain === "imaging")).toMatchObject({ value: { measureRaw: "1.2", unit: "cm" }, evidence: "EXPLICIT" });
    const abreviada = "Paciente relata dor há aprox. dois dias.";
    expect(extratorDeterministico.extrair(segment(abreviada, "medical_note")).find(f => f.domain === "symptom"))
      .toMatchObject({ value: abreviada, rawEvidence: abreviada });
  });

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

  it("mantém uma queixa afirmada coordenada depois de 'sem' sem anular uma lista negada", () => {
    const frase = "Paciente sem dor e com náusea.";
    const sintomas = extratorDeterministico.extrair(segment(frase, "medical_note")).filter(f => f.domain === "symptom");
    expect(sintomas).toHaveLength(1);
    expect(sintomas[0]).toMatchObject({
      value: "náusea", evidence: "EXPLICIT", requiresConfirmation: false, rawEvidence: frase,
      qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "NAO_DETERMINADA" },
    });
    expect(extratorDeterministico.extrair(segment("Paciente sem dor e sem náusea.", "medical_note"))
      .filter(f => f.domain === "symptom")).toHaveLength(0);
    expect(extratorDeterministico.extrair(segment("Paciente sem dor e com náusea, mas sem formigamento.", "medical_note"))
      .filter(f => f.domain === "symptom").map(f => f.value)).toEqual(["náusea"]);
    const terceiro = "Mãe da paciente sem dor e com náusea.";
    expect(extratorDeterministico.extrair(segment(terceiro, "medical_note")).find(f => f.domain === "symptom"))
      .toMatchObject({ value: "náusea", requiresConfirmation: true, rawEvidence: terceiro,
        qualificadores: { polaridade: "AFIRMADA", sujeito: "TERCEIRO" } });
    expect(extratorDeterministico.extrair(segment("Paciente nega dor e náusea.", "medical_note"))
      .filter(f => f.domain === "symptom")).toHaveLength(0);
  });

  it("usa o sujeito paciente em vez de parentesco acompanhante", () => {
    const acompanhante = "Paciente, acompanhada da filha, relata dor.";
    const dorAcompanhada = extratorDeterministico.extrair(segment(acompanhante, "medical_note"))
      .find(f => f.domain === "symptom");
    expect(dorAcompanhada).toMatchObject({
      evidence: "EXPLICIT", requiresConfirmation: false, rawEvidence: acompanhante,
      qualificadores: { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" },
    });
  });

  it.each([
    "Paciente sem dor e com náusea ausente.",
    "Paciente sem dor e com ausência de náusea.",
    "Hipótese: paciente sem dor e com náusea.",
  ])("trecho misto não apaga incerteza ou negador dentro da queixa: %s", (frase) => {
    const sintoma = extratorDeterministico.extrair(segment(frase, "medical_note"))
      .find(f => f.domain === "symptom");
    expect(sintoma).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true,
      qualificadores: { polaridade: "NAO_DETERMINADA" }, rawEvidence: frase });
  });

  it.each(["Paciente sem dor e com dor.", "Paciente sem dor e com náusea e dor."])(
    "contradição do mesmo sintoma permanece incerta: %s", (frase) => {
      const sintomas = extratorDeterministico.extrair(segment(frase, "medical_note")).filter(f => f.domain === "symptom");
      expect(sintomas.find(f => f.value === "dor")).toMatchObject({
        evidence: "UNCERTAIN", requiresConfirmation: true,
        qualificadores: { polaridade: "NAO_DETERMINADA" }, rawEvidence: frase,
      });
      if (frase.includes("náusea")) expect(sintomas.find(f => f.value === "náusea")).toMatchObject({
        evidence: "EXPLICIT", qualificadores: { polaridade: "AFIRMADA" },
      });
    },
  );

  it("mantém a mãe como sujeito quando ela relata o próprio sintoma", () => {
    const terceiro = "Mãe da paciente relata dor.";
    expect(extratorDeterministico.extrair(segment(terceiro, "medical_note")).find(f => f.domain === "symptom"))
      .toMatchObject({ requiresConfirmation: true, rawEvidence: terceiro,
        qualificadores: { sujeito: "TERCEIRO" } });
  });

  it("mantém incerta a queixa de terceiro relatada pela paciente", () => {
    const relatado = "Paciente relata que a mãe tem dor.";
    expect(extratorDeterministico.extrair(segment(relatado, "medical_note")).find(f => f.domain === "symptom"))
      .toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true, rawEvidence: relatado,
        qualificadores: { polaridade: "NAO_DETERMINADA", sujeito: "TERCEIRO" } });
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

  it.each([
    ["Em 2020 havia lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "NAO_DETERMINADO", temporalidade: "HISTORICA" }],
    ["A mãe tinha lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA" }],
    ["A avó tinha lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA" }],
    ["Paciente terá lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "FUTURA" }],
    ["Paciente apresenta lesão em L5 medindo 12 mm em 20/10/2026.", { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" }],
    ["Paciente apresenta lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL" }],
    ["Lesão em L5 medindo 12 mm em 2026.", { polaridade: "AFIRMADA", sujeito: "NAO_DETERMINADO", temporalidade: "NAO_DETERMINADA" }],
    ["Lesão em L5 medindo 12 mm.", { polaridade: "AFIRMADA", sujeito: "NAO_DETERMINADO", temporalidade: "NAO_DETERMINADA" }],
  ] as const)("preserva qualifiers suportados literalmente: %s", (frase, qualificadores) => {
    const facts = extratorDeterministico.extrair(segment(frase, "imaging_report"));
    const imagem = facts.find(f => f.domain === "imaging");
    expect(imagem).toBeDefined();
    expect(imagem).toMatchObject({ qualificadores });
    expect(imagem?.rawEvidence).toBe(frase);
  });

  it("não transforma omissão em paciente atual", () => {
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
