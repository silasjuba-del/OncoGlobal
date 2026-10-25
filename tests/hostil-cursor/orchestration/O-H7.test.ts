import { describe, expect, it } from "vitest";
import {
  deduplicarFatos,
  executarPipelineExtracao,
  type ExtractionInput,
  type ExtractionSource,
} from "../../../src/orchestration/pipeline-extracao.js";

const EXAME_IMAGEM_SINTETICO = {
  tipo: "IMAGEM" as const,
  servico: "Serviço Sintético O-H7",
  registro: "IMG-SINTETICO-OH7-001",
  dataExame: "15/02/2026",
  versao: "v1",
};

function criarFonteImagem(
  recordingId: string,
  sourceId: string,
  rawTranscript: string,
  versao = "v1",
): ExtractionSource {
  return {
    recordingId,
    sourceId,
    sourceType: "imaging_report",
    page: 1,
    rawTranscript,
    examIdentity: { ...EXAME_IMAGEM_SINTETICO, versao },
  };
}

describe("O-H7 · idempotência documental, ordem trocada, lote vazio e documento gigante", () => {
  it("mesmo documento duas vezes na mesma fonte colapsa fato idêntico e entre fontes marca repetição pendente de revisão", () => {
    const linhaLaudo = "Lesão em L4 medindo 15 mm em 15/02/2026.";
    const mesmaFonte = executarPipelineExtracao({
      recordingId: "rec-oh7-unario",
      sourceId: "src-oh7-unario",
      sourceType: "imaging_report",
      rawTranscript: `${linhaLaudo}\n${linhaLaudo}`,
      examIdentity: EXAME_IMAGEM_SINTETICO,
    });
    expect(mesmaFonte.facts.filter((f) => f.domain === "imaging")).toHaveLength(1);

    const f1 = criarFonteImagem("rec-oh7-1", "src-oh7-a", `Impresso em 16/02/2026\n${linhaLaudo}`);
    const f2 = criarFonteImagem("rec-oh7-2", "src-oh7-b", `Reimpresso em 20/02/2026\n${linhaLaudo}`);
    const multiFonte = executarPipelineExtracao({ ...f1, additionalSources: [f2] });
    expect(multiFonte.facts.filter((f) => f.domain === "imaging")).toHaveLength(2);
    expect(multiFonte.deduplicacao.repeticoes).toHaveLength(1);
    expect(multiFonte.deduplicacao.repeticoes[0]?.estado).toBe("PENDENTE_REVISAO");
    expect(multiFonte.deduplicacao.versoesDiscordantes).toEqual([]);

    const repeticaoExecucao = executarPipelineExtracao({ ...f1, additionalSources: [f2] });
    expect(repeticaoExecucao).toEqual(multiFonte);
  });

  it("mesmo documento (mesmo recordingId e sourceId) passado em input e em additionalSources é rejeitado explicitamente", () => {
    const doc = criarFonteImagem("rec-oh7-dup", "src-oh7-dup", "Lesão em L4 medindo 15 mm em 15/02/2026.");
    expect(() => executarPipelineExtracao({ ...doc, additionalSources: [doc] })).toThrow(
      /recordingId distintos/,
    );
  });

  it("documentos em ordem trocada (A+B vs B+A) produzem mesma resolução, deduplicação e conflitos", () => {
    const docA = criarFonteImagem("rec-oh7-ord-a", "src-oh7-ord-a", "Impresso em 16/02/2026\nLesão em L4 medindo 15 mm em 15/02/2026.");
    const docB = criarFonteImagem("rec-oh7-ord-b", "src-oh7-ord-b", "Reimpresso em 20/02/2026\nLesão em L4 medindo 15 mm em 15/02/2026.");

    const ordemAB = executarPipelineExtracao({ ...docA, additionalSources: [docB] });
    const ordemBA = executarPipelineExtracao({ ...docB, additionalSources: [docA] });

    expect(ordemAB.facts.length).toBe(ordemBA.facts.length);
    expect(ordemAB.deduplicacao.repeticoes).toHaveLength(1);
    expect(ordemBA.deduplicacao.repeticoes).toHaveLength(1);
    expect(ordemAB.deduplicacao.repeticoes[0]?.chaveExame).toBe(
      ordemBA.deduplicacao.repeticoes[0]?.chaveExame,
    );
    expect(Object.keys(ordemAB.fields).sort()).toEqual(Object.keys(ordemBA.fields).sort());
    expect(ordemAB.caixaRevisao.resumo.reconciliadosAutomaticamente).toBe(
      ordemBA.caixaRevisao.resumo.reconciliadosAutomaticamente,
    );
    expect(ordemAB.caixaRevisao.resumo.precisamConfirmacao).toBe(
      ordemBA.caixaRevisao.resumo.precisamConfirmacao,
    );
  });

  it("lote vazio (transcrição vazia/espaços) retorna estrutura vazia consistente e rejeita identificadores em branco", () => {
    const vazio = executarPipelineExtracao({
      recordingId: "rec-oh7-vazio",
      sourceId: "src-oh7-vazio",
      sourceType: "medical_note",
      rawTranscript: "   \n\t  \r\n ",
      additionalSources: [],
    });

    expect(vazio.segments).toEqual([]);
    expect(vazio.facts).toEqual([]);
    expect(vazio.exceptions).toEqual([]);
    expect(vazio.conflitos).toEqual([]);
    expect(vazio.timeline).toBeNull();
    expect(vazio.caixaRevisao.itens).toEqual([]);
    expect(vazio.caixaRevisao.resumo.precisamConfirmacao).toBe(0);
    expect(deduplicarFatos([])).toEqual([]);
    expect(deduplicarFatos([], [])).toEqual({
      repeticoes: [],
      versoesDiscordantes: [],
      fatoRepetidoIds: [],
    });

    expect(() =>
      executarPipelineExtracao({
        recordingId: "   ",
        sourceId: "src-oh7-vazio",
        sourceType: "medical_note",
        rawTranscript: "",
      }),
    ).toThrow(/recordingId e sourceId/);
  });

  it("documento gigante (~1 MB de texto sintético com fatos clínicos) processa sem estourar pilha nem perder fatos", () => {
    const blocoRuido = "Observação administrativa SINTETICA sem achado estruturado de prontuário. ".repeat(20);
    const linhas = Array.from({ length: 700 }, (_, i) =>
      i === 0
        ? "Bom dia, chamo Paciente SINTETICO Gigante 01. Diagnóstico: carcinoma de mama em 10/01/2026."
        : i === 350
          ? "12/01/2026 Hb 11,4 g/dL; plaquetas 210.000 /mm3; HER2: 3+."
          : i === 699
            ? "Lesão em L3 medindo 18 mm em 14/01/2026."
            : blocoRuido,
    );
    const rawTranscript = linhas.join("\n");
    expect(rawTranscript.length).toBeGreaterThan(900_000);

    const entrada: ExtractionInput = {
      recordingId: "rec-oh7-gigante",
      sourceId: "src-oh7-gigante",
      sourceType: "medical_note",
      rawTranscript,
    };

    const estado = executarPipelineExtracao(entrada);
    expect(estado.segments.length).toBeGreaterThanOrEqual(1);
    expect(estado.facts.some((f) => f.domain === "diagnosis")).toBe(true);
    expect(estado.facts.some((f) => f.domain === "lab")).toBe(true);
    expect(estado.facts.some((f) => f.domain === "biomarker")).toBe(true);
    expect(estado.facts.some((f) => f.domain === "imaging")).toBe(true);
  });
});
