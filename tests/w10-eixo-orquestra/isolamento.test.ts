import { expect, it } from "vitest";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";

it("data de diagnóstico de outro segmento não elimina laboratório do segundo paciente", () => {
  const result = executarPipelineExtracao({ recordingId: "gravacao-sintetica", sourceId: "fonte-sintetica",
    sourceType: "medical_note", rawTranscript: [
      "Bom dia, chamo Paciente Teste 07.", "Diagnóstico: carcinoma de mama em 10/09/2026",
      "Boa tarde, chamo Paciente Teste 08.", "01/09/2026 Hb 9,1 g/dL",
    ].join("\n") });
  const lab = result.facts.find((fact) => fact.domain === "lab");
  expect(lab).toMatchObject({ segmentId: "gravacao-sintetica:1", date: "2026-09-01" });
  expect(result.rejeitados.some((fact) => fact.domain === "lab")).toBe(false);
});
