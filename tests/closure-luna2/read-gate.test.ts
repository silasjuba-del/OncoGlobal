import { describe, expect, it } from "vitest";
import { executarLeitura } from "../../src/kernel/gateway/gateway.js";

const sessao = {
  medicoId: "medico-sintetico", crm: "CRM-SINTETICO",
  emitidaEm: "2026-10-08T08:00:00-03:00", expiraEm: "2026-10-08T10:00:00-03:00",
};
const request = {
  requestId: "read-req-0001", purpose: "RESEARCH", destination: "PUBMED",
  payload: { query: "synthetic query" }, timeoutMs: 250,
};
const now = () => "2026-10-08T09:00:00-03:00";
const context = { territory: "STUDY" as const };
const provenance = { sourceId: "pubmed-offline-fixture", version: "1" };
const dicionario = { nomes: ["Paciente Sintetico Conhecido"], identificadores: ["700000000000001"] };

describe("F06 · READ separado de WORLD_EFFECT", () => {
  it("permite somente destino/finalidade allowlisted por transporte injetado e audita sem payload", async () => {
    const audit: Array<Record<string, unknown>> = [];
    const result = await executarLeitura(request, {
      agora: now, sessao, context, provenance, dicionarioPaciente: dicionario, auditar: (event) => audit.push(event),
      transportes: { PUBMED: async (input) => {
        expect(Object.keys(input).sort()).toEqual(["query", "signal"]);
        return { query: input.query };
      } },
    });
    expect(result.estado).toBe("CONCLUIDA");
    expect(audit.every((event) => !JSON.stringify(event).includes("synthetic query"))).toBe(true);
  });

  it("nega sessão ausente ou destino fora da allowlist antes de chamar transporte", async () => {
    let calls = 0;
    const options = { agora: now, sessao: null, context, provenance, dicionarioPaciente: dicionario, auditar: () => {},
      transportes: { PUBMED: async () => { calls++; return null; } } };
    expect((await executarLeitura(request, options)).estado).toBe("NEGADA");
    expect((await executarLeitura({ ...request, destination: "PRODUCTION" }, { ...options, sessao })).estado).toBe("NEGADA");
    expect(calls).toBe(0);
  });

  it("não aceita sessão, contexto ou proveniência forjados no corpo", async () => {
    let calls = 0;
    const options = { agora: now, sessao, context, provenance, dicionarioPaciente: dicionario, auditar: () => {},
      transportes: { PUBMED: async () => { calls++; return null; } } };
    const forged = { ...request, context: { territory: "WORK" }, provenance: { sourceId: "forged", version: "1" }, session: sessao };
    expect((await executarLeitura(forged, options)).estado).toBe("NEGADA");
    expect(calls).toBe(0);
  });

  it("nega e audita sem payload quando a validação local de PHI falha", async () => {
    let calls = 0;
    expect(await executarLeitura({ ...request, payload: { query: "Paciente Sintetico Conhecido" } }, {
      agora: now, sessao, context, provenance, dicionarioPaciente: dicionario, auditar: () => {},
      transportes: { PUBMED: async () => { calls++; return "must not leave process"; } },
    })).toMatchObject({ estado: "NEGADA", motivoCodigo: "READ_PHI_NAO_VALIDADA" });
    expect(calls).toBe(0);
  });

  it("cancela e aplica timeout em transporte lento sem retry nem efeito de escrita", async () => {
    const cancelled = new AbortController(); cancelled.abort();
    const cancelResult = await executarLeitura(request, {
      agora: now, sessao, context, provenance, dicionarioPaciente: dicionario, auditar: () => {},
      signal: cancelled.signal, transportes: { PUBMED: async () => "unreachable" },
    });
    expect(cancelResult.estado).toBe("CANCELADA");
    const timeoutResult = await executarLeitura({ ...request, timeoutMs: 5 }, {
      agora: now, sessao, context, provenance, dicionarioPaciente: dicionario, auditar: () => {},
      transportes: { PUBMED: (_input) => new Promise(() => { /* offline fixture intentionally never resolves */ }) },
    });
    expect(timeoutResult).toMatchObject({ estado: "FALHOU", motivoCodigo: "READ_TIMEOUT" });
  });
});
