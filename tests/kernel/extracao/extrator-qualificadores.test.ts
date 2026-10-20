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
    const negada = extratorDeterministico.extrair(segment("Não há lesão em L5 medindo 24 mm.", "imaging_report"));
    expect(negada.filter(f => f.domain === "imaging")).toHaveLength(0);
  });
});
