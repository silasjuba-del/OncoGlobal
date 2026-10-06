import { describe, expect, it } from "vitest";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";

const agora = "2026-10-05T12:00:00Z";
const sessao = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: "2026-10-05T11:00:00Z", expiraEm: "2026-10-05T13:00:00Z" };
const intent = (key: string, id = "doc-sintetico") => ({
  verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id, versao: 1 },
  escopo: { patientId: "Paciente Teste 01", encounterId: "encontro-teste" },
  destino: null, idempotencyKey: key,
});

describe("F1 · limite explícito da store isolada em memória (não é o caminho HTTP canônico)", () => {
  it("ADV-001 · LIMITE: nova memória não conhece impressão anterior", async () => {
    let impressoes = 0;
    const novoProcesso = () => criarGateway({ agora: () => agora, auditar: () => {},
      store: memoriaIdempotencia(), executores: { IMPRIMIR: {
        executar: async () => { impressoes++; return { ok: true as const, recibo: `recibo-${impressoes}` }; },
      } } });
    expect((await novoProcesso().executar(intent("replay-restart-01"), sessao)).decisao).toBe("EXECUTADA");
    const replay = await novoProcesso().executar(intent("replay-restart-01"), sessao);
    expect(replay.decisao).toBe("EXECUTADA");
    expect(impressoes).toBe(2);
  });

  it("ADV-001 · LIMITE: OUTCOME_UNKNOWN da memória anterior não persiste", async () => {
    let chamadas = 0;
    const first = criarGateway({ agora: () => agora, auditar: () => {},
      store: memoriaIdempotencia(), executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: false as const, incerto: true, erro: "resultado-incerto" }; },
      } } });
    expect((await first.executar(intent("replay-restart-02"), sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    const afterRestart = criarGateway({ agora: () => agora, auditar: () => {},
      store: memoriaIdempotencia(), executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "nao-deve-repetir" }; },
      } } });
    expect((await afterRestart.executar(intent("replay-restart-02"), sessao)).decisao).toBe("EXECUTADA");
    expect(chamadas).toBe(2);
  });

  it("ADV-001 · LIMITE: mesma chave/payload diferente não é lembrada por nova memória", async () => {
    let chamadas = 0;
    const novoProcesso = () => criarGateway({ agora: () => agora, auditar: () => {},
      store: memoriaIdempotencia(), executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "teste" }; },
      } } });
    await novoProcesso().executar(intent("replay-restart-03", "doc-A"), sessao);
    expect((await novoProcesso().executar(intent("replay-restart-03", "doc-B"), sessao)).decisao).toBe("EXECUTADA");
    expect(chamadas).toBe(2);
  });

  it("ADV-001 · RESISTIU: replay no mesmo processo não duplica efeito", async () => {
    let chamadas = 0;
    const gateway = criarGateway({ agora: () => agora, auditar: () => {},
      store: memoriaIdempotencia(), executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "teste" }; },
      } } });
    await gateway.executar(intent("replay-processo-01"), sessao);
    expect((await gateway.executar(intent("replay-processo-01"), sessao)).decisao).toBe("REPLAY");
    expect(chamadas).toBe(1);
  });
});
