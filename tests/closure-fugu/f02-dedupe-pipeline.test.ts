import { describe, expect, it } from "vitest";
import {
  deduplicarFatos, executarPipelineExtracao, type ExtractionInput, type ExtractionSource,
} from "../../src/orchestration/pipeline-extracao.js";

const exame = {
  tipo: "IMAGEM" as const, servico: "Hospital sintético",
  registro: "IMG-001", dataExame: "03/01/2030", versao: "v1",
};
const linha = "Lesão em L5 medindo 12 mm em 03/01/2030.";

function fonte(recordingId: string, sourceId: string, rawTranscript = linha): ExtractionSource {
  return {
    recordingId, sourceId, sourceType: "imaging_report", page: 2,
    rawTranscript, examIdentity: exame,
  };
}

function executar(principal: ExtractionSource, secundaria: ExtractionSource): ReturnType<typeof executarPipelineExtracao> {
  return executarPipelineExtracao({ ...principal, additionalSources: [secundaria] });
}

describe("F02 · deduplicação documental no pipeline real", () => {
  it("reimpressão com outra data de extração: marca repetição e conserva fatos, fontes e páginas", () => {
    const r = executar(
      fonte("ingestao-1", "laudo-original", `Impresso em 04/01/2030\n${linha}`),
      fonte("ingestao-2", "laudo-reimpresso", `Reimpresso em 08/01/2030\n${linha}`),
    );
    const achados = r.facts.filter((f) => f.domain === "imaging");
    expect(achados).toHaveLength(2);
    expect(achados.map((f) => [f.sourceId, f.page, f.date]))
      .toEqual([["laudo-original", 2, "2030-01-03"], ["laudo-reimpresso", 2, "2030-01-03"]]);
    expect(r.deduplicacao.repeticoes).toHaveLength(1);
    expect(r.deduplicacao.repeticoes[0]).toMatchObject({
      estado: "PENDENTE_REVISAO",
      fatoPrincipalIds: [achados[0]!.id],
      fatoRepetidoIds: [achados[1]!.id],
      fontes: [
        { recordingId: "ingestao-1", sourceId: "laudo-original", page: 2, versao: "v1" },
        { recordingId: "ingestao-2", sourceId: "laudo-reimpresso", page: 2, versao: "v1" },
      ],
    });
    expect(r.deduplicacao.versoesDiscordantes).toEqual([]);
    expect(deduplicarFatos(r.facts, [r.input, ...r.input.additionalSources!]))
      .toEqual(r.deduplicacao);
    // Sem ações persistidas não existe junção automática de segmentos/pacientes.
    expect(r.timeline).toBeNull();
    expect(r.segments.every((s) => s.patientId === null)).toBe(true);
    expect(Object.keys(r.fields)).toHaveLength(2);
  });

  it("outro laudo com conclusão idêntica e registro diferente NÃO é duplicata", () => {
    const r = executar(fonte("exame-1", "fonte-1"), {
      ...fonte("exame-2", "fonte-2"),
      examIdentity: { ...exame, registro: "IMG-002" },
    });
    expect(r.facts).toHaveLength(2);
    expect(r.deduplicacao.repeticoes).toEqual([]);
    expect(r.deduplicacao.versoesDiscordantes).toEqual([]);
  });

  it("mesmo registro mas data clínica diferente NÃO é laudo repetido", () => {
    const r = executar(fonte("exame-1", "fonte-1"), {
      ...fonte("exame-2", "fonte-2", "Lesão em L5 medindo 14 mm em 04/01/2030."),
      examIdentity: { ...exame, dataExame: "04/01/2030" },
    });
    expect(r.facts.map((f) => f.date)).toEqual(["2030-01-03", "2030-01-04"]);
    expect(r.deduplicacao.repeticoes).toEqual([]);
    expect(r.deduplicacao.versoesDiscordantes).toEqual([]);
  });

  it("mesma identidade com achados discordantes vira CONFLICT, nunca colapsa os fatos", () => {
    const r = executar(fonte("exame-1", "fonte-1"), fonte(
      "exame-2", "fonte-2", "Lesão em L5 medindo 14 mm em 03/01/2030.",
    ));
    expect(r.facts).toHaveLength(2);
    expect(r.deduplicacao.repeticoes).toEqual([]);
    expect(r.deduplicacao.versoesDiscordantes).toHaveLength(1);
    expect(r.deduplicacao.versoesDiscordantes[0]?.factIds).toEqual(r.facts.map((f) => f.id));
    expect(r.exceptions).toContainEqual(expect.objectContaining({
      kind: "CONFLICT", segmentId: null,
      sourceIds: ["fonte-1", "fonte-2"], factIds: r.facts.map((f) => f.id),
    }));
  });

  it("texto clínico ainda não extraído mas discordante não desaparece sob fatos iguais", () => {
    const r = executar(fonte("exame-1", "fonte-1"), fonte(
      "exame-2", "fonte-2", `${linha}\nConclusão: achado adicional ainda não estruturado.`,
    ));
    expect(r.facts).toHaveLength(2);
    expect(r.facts[0]?.value).toEqual(r.facts[1]?.value);
    expect(r.deduplicacao.repeticoes).toEqual([]);
    expect(r.deduplicacao.versoesDiscordantes).toHaveLength(1);
    expect(r.exceptions.some((e) => e.kind === "CONFLICT" && e.segmentId === null)).toBe(true);
  });

  it("versões explícitas distintas ficam separadas mesmo com texto idêntico", () => {
    const r = executar(fonte("exame-1", "fonte-1"), {
      ...fonte("exame-2", "fonte-2"),
      examIdentity: { ...exame, versao: "v2" },
    });
    expect(r.deduplicacao.repeticoes).toEqual([]);
    expect(r.deduplicacao.versoesDiscordantes).toHaveLength(1);
    expect(r.deduplicacao.versoesDiscordantes[0]?.fontes.map((f) => f.versao)).toEqual(["v1", "v2"]);
    expect(r.facts).toHaveLength(2);
  });

  it("chave incompleta não agrupa fontes independentes; a mesma fonte repetida é rastreável", () => {
    const a: ExtractionInput = { ...fonte("exame-1", "fonte-1"),
      examIdentity: { tipo: "IMAGEM", registro: "IMG-001" } };
    const independente = executarPipelineExtracao({ ...a, additionalSources: [{
      ...fonte("exame-2", "fonte-2"), examIdentity: a.examIdentity,
    }] });
    expect(independente.deduplicacao.repeticoes).toEqual([]);
    const reingestao = executarPipelineExtracao({ ...a, additionalSources: [{
      ...fonte("exame-2", "fonte-1"), examIdentity: a.examIdentity,
    }] });
    expect(reingestao.deduplicacao.repeticoes).toHaveLength(1);
    expect(reingestao.facts).toHaveLength(2);
  });

  it("não aceita recordingId reutilizado por duas fontes: IDs de fato não podem colidir", () => {
    expect(() => executar(fonte("mesmo", "fonte-1"), fonte("mesmo", "fonte-2")))
      .toThrow(/recordingId distintos/);
  });
});
