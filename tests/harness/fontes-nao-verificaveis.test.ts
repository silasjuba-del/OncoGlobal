import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verificarPropostaNoHarnessRuntime } from "../../src/kernel/harness/runtime.js";

const texto = "Texto sintético: marcador presente.";
const hash = createHash("sha256").update(texto).digest("hex");
const fonte = { sourceId: "fonte-sintetica", versao: "1", modalidade: "TEXTO" as const, conteudoOriginal: texto, contentHash: hash };
const citacao = { sourceId: fonte.sourceId, versao: "1", contentHash: hash, trecho: texto };

describe("Harness: nenhuma proposta sem evidência recebe aptidão", () => {
  it.each([
    ["fonte desconhecida", [{ ...citacao, sourceId: "inexistente" }]],
    ["nenhuma citação", []],
    ["trecho vazio", [{ ...citacao, trecho: "" }]],
  ])("bloqueia %s mesmo com outra fonte íntegra disponível", (_nome, citacoes) => {
    const resultado = verificarPropostaNoHarnessRuntime({
      proposta: {
        propostaId: "proposta-sintetica",
        itensPropostos: [{ itemId: "item-sintetico", campo: "marcador", valorProposto: "marcador", qualificador: "AFIRMADO", citacoes }],
      },
      fontesOriginais: [fonte],
    });
    expect(resultado.status).toBe("BLOQUEADO_FALHA_CRITICA");
    expect(resultado.manifestacoes.some((m) => m.tipo === "CITACAO_NAO_SUSTENTADA")).toBe(true);
    expect(resultado.itensVerificados[0]?.verificacaoDeterministicaIndependenteOk).toBe(false);
  });
});
