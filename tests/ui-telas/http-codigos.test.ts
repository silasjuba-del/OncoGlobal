import { afterEach, describe, expect, it, vi } from "vitest";
// proveniência: dados sintéticos - não utilizar em produção
import { criarPortaHttp } from "../../src/ui/api/http.js";

afterEach(() => vi.unstubAllGlobals());

function portaComResposta(status: number, corpo: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(corpo), { status })));
  return criarPortaHttp({ onSessaoExpirada: () => {} });
}

describe("porta HTTP: recusa específica do servidor não vira PAYLOAD_INVALIDO genérico (ARQ-06)", () => {
  it("401 e 409 preservam o código do servidor nas leituras/preparos de revisão", async () => {
    await expect(portaComResposta(401, { codigo: "SESSAO_EXPIRADA" }).carregarFonteRevisao!("draft-sintetico"))
      .rejects.toMatchObject({ codigo: "SESSAO_EXPIRADA" });
    await expect(portaComResposta(409, { codigo: "CONTEXTO_CONSULTA_ALTERADO" })
      .prepararRevisaoExtracao!({} as never)).rejects.toMatchObject({ codigo: "CONTEXTO_CONSULTA_ALTERADO" });
    await expect(portaComResposta(409, { codigo: "EXPECTED_REVISION_CONFLICT" })
      .confirmarRevisaoExtracao!({} as never)).rejects.toMatchObject({ codigo: "EXPECTED_REVISION_CONFLICT" });
  });

  it("controle: resposta 200 fora do contrato continua PAYLOAD_INVALIDO", async () => {
    await expect(portaComResposta(200, {}).carregarFonteRevisao!("draft-sintetico"))
      .rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });
});
