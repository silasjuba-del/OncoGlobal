import { describe, expect, it } from "vitest";
import { maestro } from "../../src/orchestration/maestro.js";
import { executarOrk } from "../../src/orchestration/ork.js";
import type { AgenteFake, Passo, Plano } from "../../src/orchestration/tipos.js";

// APIs reais: maestro(evento) e executarOrk(plano, agentes).
// AgenteFake devolve unknown: não há API pública para impedir que um callback
// chame outro agente por conta própria. Só se prova aqui que o ORK não interpreta
// a saída como novos passos/agentes nem executa agentes fora do plano.
const passo = (id: string, dependsOn: readonly string[] = [], timeoutMs = 100): Passo =>
  ({ id, dependsOn, timeoutMs });
const plano = (passos: Plano["passos"]): Plano => ({ evento: "EVENTO_TESTE", passos });

const CHAVES_PROTOTYPE = [
  "__proto__", "constructor", "toString", "valueOf", "hasOwnProperty",
  "isPrototypeOf", "propertyIsEnumerable", "toLocaleString",
  "__defineGetter__", "__lookupGetter__",
] as const;

describe("FUGU-EIXO-04 · Maestro e ORK", () => {
  it("Maestro mantém o plano tabelado para um evento conhecido", () => {
    expect(maestro("VOZ_COMANDO")?.passos.map((p) => p.id)).toEqual(["VOICE_INTENT"]);
  });

  it.each(["EVENTO_INVENTADO", "VOZ_COMANDO ", "voz_comando"])(
    "Maestro não improvisa plano para evento desconhecido %s",
    (evento) => expect(maestro(evento)).toBeNull(),
  );

  it.each(CHAVES_PROTOTYPE)(
    "Maestro não transforma chave herdada %s em plano",
    (evento) => expect(maestro(evento)).toBeNull(),
  );

  it("ORK não cria passos/agentes a partir da saída e não chama agente fora do plano", async () => {
    const chamadas: string[] = [];
    const extra: AgenteFake = async () => {
      chamadas.push("EXTRA");
      return "não deve executar";
    };
    const declarado: AgenteFake = async () => {
      chamadas.push("DECLARADO");
      return {
        passos: [passo("EXTRA")],
        agentes: { EXTRA: extra },
        estado: "CONCLUIDO",
      };
    };
    const entrada = plano([passo("DECLARADO")]);
    const run = await executarOrk(entrada, { DECLARADO: declarado, EXTRA: extra });

    expect(chamadas).toEqual(["DECLARADO"]);
    expect(run.resultados.map((r) => r.id)).toEqual(["DECLARADO"]);
    expect(entrada.passos.map((p) => p.id)).toEqual(["DECLARADO"]);
    expect(run).toMatchObject({ estado: "PRONTO", etapa: "JOIN" });
  });

  it.each(CHAVES_PROTOTYPE)(
    "ORK não executa agente herdado para passo %s não registrado",
    async (id) => {
      const run = await executarOrk(plano([passo(id)]), {});
      expect(run.resultados).toEqual([
        { id, resultado: "missing", motivo: "AGENTE_INDISPONIVEL", tentativas: 0 },
      ]);
      expect(run.estado).toBe("FALHOU");
    },
  );

  const composicoesInvalidas: ReadonlyArray<{
    caso: string;
    passos: Plano["passos"];
    erro: "PLANO_INVALIDO" | "PLANO_CICLICO";
  }> = [
    { caso: "IDs duplicados", passos: [passo("OK"), passo("OK")], erro: "PLANO_INVALIDO" },
    { caso: "dependência inexistente", passos: [passo("OK"), passo("B", ["FANTASMA"])], erro: "PLANO_INVALIDO" },
    { caso: "auto-dependência", passos: [passo("OK"), passo("B", ["B"])], erro: "PLANO_INVALIDO" },
    { caso: "ciclo após passo pronto", passos: [passo("OK"), passo("B", ["C"]), passo("C", ["B"])], erro: "PLANO_CICLICO" },
    { caso: "timeout zero", passos: [passo("OK"), passo("B", [], 0)], erro: "PLANO_INVALIDO" },
    { caso: "timeout NaN", passos: [passo("OK"), passo("B", [], Number.NaN)], erro: "PLANO_INVALIDO" },
    { caso: "timeout infinito", passos: [passo("OK"), passo("B", [], Number.POSITIVE_INFINITY)], erro: "PLANO_INVALIDO" },
  ];

  it.each(composicoesInvalidas)(
    "ORK rejeita composição inválida ($caso) antes de invocar agentes",
    async ({ passos, erro }) => {
      let invocacoes = 0;
      const agente: AgenteFake = async () => {
        invocacoes += 1;
        return "ok";
      };

      await expect(executarOrk(plano(passos), { OK: agente, B: agente, C: agente }))
        .rejects.toThrow(erro);
      expect(invocacoes).toBe(0);
    },
  );
});
