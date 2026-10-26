import { describe, expect, it } from "vitest";
import { maestro } from "../../../src/orchestration/maestro.js";
import { concluirRun, executarOrk } from "../../../src/orchestration/ork.js";
import { executarPipelineExtracao } from "../../../src/orchestration/pipeline-extracao.js";
import { SetorClinico } from "../../../src/contracts/f1/achadosSetor.js";
import type { VisaoIntegrada } from "../../../src/contracts/f1/visaoIntegrada.js";
import type { Plano } from "../../../src/orchestration/tipos.js";

// O-H6 · Falha no último passo do pipeline não pode deixar estado parcial gravado
// (nem mutar objetos de entrada/contexto nem permitir conclusão do run).
describe("O-H6 · falha no último passo do pipeline", () => {
  it("falha no último passo de plano sequencial marca run como FALHOU e impede concluirRun", async () => {
    const gravadoExterno: string[] = [];
    const planoEntrada: Plano = {
      evento: "TESTE_SINTETICO_OH6",
      passos: [
        { id: "PASSO_1", dependsOn: [], timeoutMs: 50 },
        { id: "PASSO_2", dependsOn: ["PASSO_1"], timeoutMs: 50 },
        { id: "ULTIMO_PASSO", dependsOn: ["PASSO_2"], timeoutMs: 50 },
      ],
    };
    const snapshotPlanoAntes = JSON.stringify(planoEntrada);

    const run = await executarOrk(planoEntrada, {
      PASSO_1: async () => ({ rascunho: "SINTETICO_1" }),
      PASSO_2: async ({ resultados }) => {
        // Tentativa hostil de mutar resultado anterior em trânsito
        const r0 = resultados[0];
        if (r0 && r0.resultado === "ok") {
          (r0.saida as Record<string, unknown>).rascunho = "ADULTERADO_SINTETICO";
        }
        return { rascunho: "SINTETICO_2" };
      },
      ULTIMO_PASSO: async () => {
        throw new Error("SINTETICO: falha determinística no último passo");
      },
    });

    expect(JSON.stringify(planoEntrada)).toBe(snapshotPlanoAntes);
    expect(run.resultados[0]).toMatchObject({
      id: "PASSO_1",
      resultado: "ok",
      saida: { rascunho: "SINTETICO_1" },
    });
    expect(run.resultados.find((r) => r.id === "ULTIMO_PASSO")).toMatchObject({
      id: "ULTIMO_PASSO",
      resultado: "error",
      motivo: "AGENTE_ERRO",
      tentativas: 2,
    });
    // Quando o último passo do pipeline falha, o run NÃO pode ficar PRONTO (estado parcial gravável)
    expect(run.estado).toBe("FALHOU");
    expect(() => {
      const concluido = concluirRun(run);
      gravadoExterno.push(concluido.estado);
    }).toThrow("RUN_NAO_PRONTO");
    expect(gravadoExterno).toEqual([]);
  });

  it("falha ou timeout no último passo de evento tabelado do Maestro (ex.: VALIDAR_BLOCO / INICIAR_CONSULTA) resulta em FALHOU", async () => {
    const planoMaestro = maestro("VALIDAR_BLOCO")!;
    const tabelaAntes = JSON.stringify(maestro("VALIDAR_BLOCO"));

    const runErro = await executarOrk(planoMaestro, {
      WriteRouter: async () => ({ ok: true, id: "SINTETICO_WR" }),
      DOCUMENT: async () => ({ ok: true, id: "SINTETICO_DOC" }),
      APAC_RASCUNHO: async () => ({ failure: "error" }),
    });

    expect(runErro.estado).toBe("FALHOU");
    expect(() => concluirRun(runErro)).toThrow("RUN_NAO_PRONTO");
    expect(JSON.stringify(maestro("VALIDAR_BLOCO"))).toBe(tabelaAntes);

    const runTimeout = await executarOrk(
      {
        evento: "VALIDAR_BLOCO",
        passos: [
          { id: "WriteRouter", dependsOn: [], timeoutMs: 50 },
          { id: "DOCUMENT", dependsOn: ["WriteRouter"], timeoutMs: 50 },
          { id: "APAC_RASCUNHO", dependsOn: ["DOCUMENT"], timeoutMs: 5 },
        ],
      },
      {
        WriteRouter: async () => ({ ok: true }),
        DOCUMENT: async () => ({ ok: true }),
        APAC_RASCUNHO: async () => {
          await new Promise((r) => setTimeout(r, 30));
          return { ok: true };
        },
      },
    );

    expect(runTimeout.resultados.at(-1)).toMatchObject({
      id: "APAC_RASCUNHO",
      resultado: "unattempted",
      motivo: "TIMEOUT",
    });
    expect(runTimeout.estado).toBe("FALHOU");
    expect(() => concluirRun(runTimeout)).toThrow("RUN_NAO_PRONTO");
  });

  it("RECONCILIADOR falhando ou devolvendo visão incompleta no último passo marca FALHOU e preserva input de extração intacto", async () => {
    const planoReconciliador = maestro("FATO_CONFIRMADO")!;
    const agentesSetores = Object.fromEntries(
      SetorClinico.options.map((s) => [s, async () => ({ setor: s, dado: "SINTETICO" })]),
    );
    const visaoParcialSemLacuna: VisaoIntegrada = {
      schema: "VisaoIntegrada@1",
      correlacao: {
        patientId: "PACIENTE_SINTETICO_OH6",
        encounterId: "ENC_SINTETICO_OH6",
        tumorLotId: null,
        operationId: "OP_SINTETICO_OH6",
        revisaoFatos: "REV_SINTETICO",
        regras: [],
        biblioteca: { id: "bib-sintetica", versao: "1", hash: "hash-sintetico" },
        proposta: null,
      },
      achados: [],
      lacunas: [],
      cobertura: {
        setoresEsperados: [...SetorClinico.options],
        setoresAvaliados: SetorClinico.options.slice(0, -1),
        avaliados: SetorClinico.options.length - 1,
        semRegraAprovada: 0,
      },
    };

    const run = await executarOrk(planoReconciliador, {
      ...agentesSetores,
      RECONCILIADOR: async () => visaoParcialSemLacuna,
    });
    expect(run.estado).toBe("FALHOU");

    const inputExtracao = {
      recordingId: "rec-sintetico-oh6",
      sourceId: "src-sintetico-oh6",
      sourceType: "medical_note" as const,
      rawTranscript: "Paciente SINTETICO OH6. Diagnóstico: carcinoma de mama em 10/01/2026.",
      additionalSources: [],
    };
    const copiaInput = structuredClone(inputExtracao);
    const estadoExtracao = executarPipelineExtracao(inputExtracao);
    expect(inputExtracao).toEqual(copiaInput);
    expect(estadoExtracao.timeline).toBeNull();
  });
});
