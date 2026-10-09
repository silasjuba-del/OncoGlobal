import { describe, expect, it } from "vitest";
import { Triagem } from "../../src/contracts/clinico.js";
import { triagemBase } from "../fixtures/triagem.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";

describe("C2 · compatibilidade com eventos de triagem anteriores à W12", () => {
  it("chaves ausentes são lidas como desconhecidas sem alterar o objeto original", () => {
    const { vertigemHistoricoAnterior: _historico, vertigemInicioNovo: _inicio, ...legado } = triagemBase();
    const original = JSON.stringify(legado);
    const leitura = Triagem.parse(legado);
    expect(leitura.vertigemHistoricoAnterior).toBeNull();
    expect(leitura.vertigemInicioNovo).toBeNull();
    expect(JSON.stringify(legado)).toBe(original);
    expect(legado).not.toHaveProperty("vertigemInicioNovo");
  });
});

describe("C2 · rótulo documental anatomopatológico", () => {
  it("preserva a histologia literal e não cria valor a partir de ausência declarada", () => {
    const entrada = { recordingId: "ap-sintetico-c2", sourceId: "fonte-ap-c2", sourceType: "pathology" as const };
    const r = executarPipelineExtracao({ ...entrada, rawTranscript: "Diagnóstico anatomopatológico: carcinoma ductal invasivo sintético." });
    expect(r.facts).toContainEqual(expect.objectContaining({ domain: "histology", value: "carcinoma ductal invasivo sintético" }));
    const vazio = executarPipelineExtracao({ ...entrada, rawTranscript: "Diagnóstico anatomopatológico: NÃO CONSTA." });
    expect(vazio.facts.some((f) => f.domain === "histology")).toBe(false);
  });
});
