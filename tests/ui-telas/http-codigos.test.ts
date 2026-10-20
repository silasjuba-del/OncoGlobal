import { afterEach, describe, expect, it, vi } from "vitest";
// proveniência: dados sintéticos - não utilizar em produção
import { criarPortaHttp } from "../../src/ui/api/http.js";

afterEach(() => vi.unstubAllGlobals());

function portaComResposta(status: number, corpo: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(corpo), { status })));
  return criarPortaHttp({ onSessaoExpirada: () => {} });
}

describe("porta HTTP: recusa específica do servidor não vira PAYLOAD_INVALIDO genérico (ARQ-06)", () => {
  const acao = { verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "documento-sintetico", versao: 1 },
    escopo: { patientId: "paciente-sintetico", encounterId: "encontro-sintetico" }, destino: null,
    idempotencyKey: "http-payload-sintetico" } as const;
  const operacoes = [
    ["carregarFonteRevisao", (porta: ReturnType<typeof criarPortaHttp>) => porta.carregarFonteRevisao!("draft-sintetico")],
    ["prepararRevisaoExtracao", (porta: ReturnType<typeof criarPortaHttp>) => porta.prepararRevisaoExtracao!({} as never)],
    ["confirmarRevisaoExtracao", (porta: ReturnType<typeof criarPortaHttp>) => porta.confirmarRevisaoExtracao!({} as never)],
    ["acao", (porta: ReturnType<typeof criarPortaHttp>) => porta.acao(acao)],
  ] as const;

  it.each(operacoes)("resposta 200 fora do contrato em %s sempre é PAYLOAD_INVALIDO", async (_nome, chamar) => {
    await expect(chamar(portaComResposta(200, { codigo: "REVISAO_PREPARADA" })))
      .rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("401 e 409 preservam o código do servidor nas leituras/preparos de revisão", async () => {
    await expect(portaComResposta(401, { codigo: "SESSAO_EXPIRADA" }).carregarFonteRevisao!("draft-sintetico"))
      .rejects.toMatchObject({ codigo: "SESSAO_EXPIRADA" });
    await expect(portaComResposta(409, { codigo: "CONTEXTO_CONSULTA_ALTERADO" })
      .prepararRevisaoExtracao!({} as never)).rejects.toMatchObject({ codigo: "CONTEXTO_CONSULTA_ALTERADO" });
    await expect(portaComResposta(409, { codigo: "EXPECTED_REVISION_CONFLICT" })
      .confirmarRevisaoExtracao!({} as never)).rejects.toMatchObject({ codigo: "EXPECTED_REVISION_CONFLICT" });
    await expect(portaComResposta(409, { codigo: "CONTEXTO_CONSULTA_ALTERADO" }).acao(acao))
      .resolves.toMatchObject({ codigo: "CONTEXTO_CONSULTA_ALTERADO", decisao: null });
  });

  it("controle: resposta 200 fora do contrato continua PAYLOAD_INVALIDO", async () => {
    await expect(portaComResposta(200, {}).carregarFonteRevisao!("draft-sintetico"))
      .rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });
});
