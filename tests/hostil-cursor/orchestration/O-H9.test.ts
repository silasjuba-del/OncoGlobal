import { describe, expect, it } from "vitest";
import { maestro } from "../../../src/orchestration/maestro.js";
import { concluirRun, executarOrk, verificarChamadaAgente } from "../../../src/orchestration/ork.js";
import { executarPipelineExtracao, type ExtractionInput } from "../../../src/orchestration/pipeline-extracao.js";

describe("O-H9 · reentrância e execuções simultâneas do mesmo paciente sintético", () => {
  it("duas execuções simultâneas de executarOrk compartilhando o mesmo plano, agentes e opções do mesmo paciente sintético não vazam estado nem resultados", async () => {
    const planoCompartilhado = maestro("LAB_CHEGOU")!;
    const opcoesCompartilhadas = {
      onTimeout: () => {},
      aoDescartarTardio: () => {},
    };

    let barreiraLiberar!: () => void;
    const barreira = new Promise<void>((resolve) => {
      barreiraLiberar = resolve;
    });
    let entradasLab = 0;

    // Agentes compartilhados entre as duas execuções concorrentes do mesmo paciente sintético
    const agentesCompartilhados = {
      LAB: async ({ evento }: { evento: string }) => {
        entradasLab += 1;
        const ordem = entradasLab;
        if (ordem === 2) barreiraLiberar();
        await barreira;
        return {
          paciente: "PACIENTE_SINTETICO_OH9",
          evento,
          ordemExecucao: ordem,
          hb: ordem === 1 ? "10,2 g/dL" : "8,9 g/dL",
        };
      },
      INTERACTION: async ({ resultados }: { resultados: readonly { id: string; resultado: string; saida?: unknown }[] }) => {
        const lab = resultados.find((r) => r.id === "LAB")?.saida as { ordemExecucao: number };
        await new Promise((r) => setTimeout(r, ordemDelay(lab.ordemExecucao)));
        return { paciente: "PACIENTE_SINTETICO_OH9", ordem: lab.ordemExecucao, interacao: "nenhuma" };
      },
      EMERGENCY: async ({ resultados }: { resultados: readonly { id: string; resultado: string; saida?: unknown }[] }) => {
        const lab = resultados.find((r) => r.id === "LAB")?.saida as { ordemExecucao: number };
        return { paciente: "PACIENTE_SINTETICO_OH9", ordem: lab.ordemExecucao, emergencia: false };
      },
      DELTA: async ({ resultados }: { resultados: readonly { id: string; resultado: string; saida?: unknown }[] }) => {
        const lab = resultados.find((r) => r.id === "LAB")?.saida as { ordemExecucao: number; hb: string };
        return { paciente: "PACIENTE_SINTETICO_OH9", ordem: lab.ordemExecucao, deltaHb: lab.hb };
      },
    };

    function ordemDelay(ordem: number): number {
      return ordem === 1 ? 15 : 2;
    }

    const [run1, run2] = await Promise.all([
      executarOrk(planoCompartilhado, agentesCompartilhados, opcoesCompartilhadas),
      executarOrk(planoCompartilhado, agentesCompartilhados, opcoesCompartilhadas),
    ]);

    expect(run1.estado).toBe("PRONTO");
    expect(run2.estado).toBe("PRONTO");
    expect(run1).not.toBe(run2);
    expect(run1.resultados).toHaveLength(4);
    expect(run2.resultados).toHaveLength(4);

    const delta1 = run1.resultados.find((r) => r.id === "DELTA");
    const delta2 = run2.resultados.find((r) => r.id === "DELTA");
    expect(delta1).toMatchObject({
      resultado: "ok",
      saida: { paciente: "PACIENTE_SINTETICO_OH9", ordem: 1, deltaHb: "10,2 g/dL" },
    });
    expect(delta2).toMatchObject({
      resultado: "ok",
      saida: { paciente: "PACIENTE_SINTETICO_OH9", ordem: 2, deltaHb: "8,9 g/dL" },
    });

    expect(concluirRun(run1).estado).toBe("CONCLUIDO");
    expect(concluirRun(run2).estado).toBe("CONCLUIDO");
  });

  it("reentrância direta de agente chamando executarOrk é bloqueada por AsyncLocalStorage sem afetar execução paralela legítima fora do agente", async () => {
    const plano = {
      evento: "TESTE_REENTRANCIA_SINTETICO",
      passos: [{ id: "PASSO_A", dependsOn: [], timeoutMs: 100 }],
    };

    let liberarInterno!: () => void;
    const aguardarInterno = new Promise<void>((r) => {
      liberarInterno = r;
    });

    // Run A entra no agente e tenta reentrar no ORK enquanto Run B roda fora do contexto de A
    const promessaRunA = executarOrk(plano, {
      PASSO_A: async () => {
        expect(verificarChamadaAgente().decisao).toBe("REJEITA");
        liberarInterno();
        await new Promise((r) => setTimeout(r, 15));
        // Tentativa proibida de reentrância recursiva pelo mesmo paciente sintético
        return executarOrk(plano, { PASSO_A: async () => "PROIBIDO_SINTETICO" });
      },
    });

    await aguardarInterno;
    // Fora do contexto assíncrono do agente A, outra execução paralela para o paciente sintético deve passar
    expect(verificarChamadaAgente().decisao).toBe("PASSA");
    const runB = await executarOrk(plano, {
      PASSO_A: async () => ({ paciente: "PACIENTE_SINTETICO_OH9", status: "PARALELO_LEGITIMO" }),
    });
    const runA = await promessaRunA;

    expect(runB.estado).toBe("PRONTO");
    expect(runB.resultados[0]).toMatchObject({
      resultado: "ok",
      saida: { paciente: "PACIENTE_SINTETICO_OH9", status: "PARALELO_LEGITIMO" },
    });
    expect(runA.estado).toBe("FALHOU");
    expect(runA.resultados[0]).toMatchObject({
      id: "PASSO_A",
      resultado: "error",
      motivo: "AGENTE_ERRO",
      tentativas: 2,
    });
    expect(verificarChamadaAgente().decisao).toBe("PASSA");
  });

  it("duas execuções simultâneas de executarPipelineExtracao compartilhando o mesmo objeto de configuração e cadastro do paciente sintético não contaminam estado", async () => {
    const cadastroCompartilhado = [
      {
        patientId: "PACIENTE_SINTETICO_OH9",
        name: "Paciente Sintetico Reentrancia",
        age: 62,
        sex: "feminino",
        tumor: "mama",
      },
    ];
    const contextoTumorCompartilhado = {
      tumor: "mama",
      histologia: "carcinoma ductal invasivo",
      estadio: "II",
    };

    const baseInput: ExtractionInput = {
      recordingId: "rec-sintetico-oh9",
      sourceId: "src-sintetico-oh9",
      sourceType: "medical_note",
      rawTranscript:
        "Bom dia, chamo Paciente Sintetico Reentrancia, 62 anos, sexo feminino, tumor de mama.\nDiagnóstico: carcinoma de mama em 10/01/2026.\n12/01/2026 Hb 10,8 g/dL; HER2: 3+.",
      registeredPatients: cadastroCompartilhado,
      openedPatientId: "PACIENTE_SINTETICO_OH9",
      tumorContexto: contextoTumorCompartilhado,
    };

    const [estado1, estado2] = await Promise.all([
      Promise.resolve().then(() => executarPipelineExtracao(baseInput)),
      Promise.resolve().then(() => executarPipelineExtracao(baseInput)),
    ]);

    expect(estado1).toEqual(estado2);
    expect(estado1).not.toBe(estado2);
    expect(estado1.facts).not.toBe(estado2.facts);
    expect(estado1.patientCandidates[0]?.patientId).toBe("PACIENTE_SINTETICO_OH9");
    expect(estado2.patientCandidates[0]?.patientId).toBe("PACIENTE_SINTETICO_OH9");
  });
});
