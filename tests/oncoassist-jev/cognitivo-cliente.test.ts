import { afterEach, expect, it, vi } from "vitest";
import { criarPortaHttp } from "../../src/ui/api/http.js";

afterEach(() => vi.unstubAllGlobals());
const pedido = { patientId: "p", encounterId: "e", tumorLotId: null, draftId: "d" };
const resposta = () => ({ codigo: "PROPOSTA_LLM_CARREGADA", draftId: "d", criaEventoClinico: false,
  proposta: { correlacao: { patientId: "p", encounterId: "e", tumorLotId: null } }, cognitivo: null,
  validadeFonte: "FONTE_ALTERADA", validadeContexto: "CONTEXTO_ALTERADO", validadePolitica: "NAO_VERIFICAVEL" });
async function abrir(body: unknown) {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url === "/login"
    ? { token: "token-sintetico", expiraEm: "2026-10-21T18:00:00Z" } : body), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const porta = criarPortaHttp({ onSessaoExpirada: vi.fn() });
  expect((await porta.login("senha-sintetica")).ok).toBe(true);
  return { porta, fetch };
}
it("cliente recupera resultado histórico preservando invalidades, sem promover legado", async () => {
  const { porta, fetch } = await abrir(resposta());
  const r = await porta.oncoassistResultadoCognitivo!(pedido);
  expect(r).toEqual(resposta());
  const chamada = fetch.mock.calls.at(-1)!;
  expect(chamada[0]).toBe("/consulta/llm/resultado");
});
it.each(["paciente", "rascunho", "autoridade"])("cliente recusa resposta divergente de %s", async tipo => {
  const r = resposta();
  if (tipo === "paciente") r.proposta.correlacao.patientId = "outro";
  if (tipo === "rascunho") r.draftId = "outro";
  if (tipo === "autoridade") r.criaEventoClinico = true;
  const { porta } = await abrir(r);
  await expect(porta.oncoassistResultadoCognitivo!(pedido)).rejects.toThrow();
});
