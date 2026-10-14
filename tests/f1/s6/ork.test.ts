import { describe, expect, it, vi } from "vitest";
import { executarOrk } from "../../../src/orchestration/ork.js";
import { maestro } from "../../../src/orchestration/maestro.js";
import { SetorClinico } from "../../../src/contracts/f1/achadosSetor.js";
import { TipoEstimulo } from "../../../src/contracts/f1/estimuloTecnico.js";
import type { VisaoIntegrada } from "../../../src/contracts/f1/visaoIntegrada.js";
const visao = (): VisaoIntegrada => ({ schema: "VisaoIntegrada@1", correlacao: { patientId: "p", encounterId: "e", tumorLotId: null,
  operationId: "op", revisaoFatos: "r", regras: [], biblioteca: { id: "b", versao: "1", hash: "h" }, proposta: null },
  achados: [], lacunas: [], cobertura: { setoresEsperados: [...SetorClinico.options], setoresAvaliados: [...SetorClinico.options], avaliados: 0, semRegraAprovada: 0 } });
const agentes = () => Object.fromEntries(SetorClinico.options.map(s => [s, async () => ({})]));

describe("S6 ORK clínico sem mudança dos planos legados", () => {
  it.each(TipoEstimulo.options)("evento %s percorre todos setores e termina reconciliando", evento => {
    const p = maestro(evento)!;
    expect(p.passos.map(x => x.id)).toEqual([...SetorClinico.options, "RECONCILIADOR"]);
  });
  it("falha de laboratório chega ao reconciliador como lacuna e permite visão parcial pronta", async () => {
    const run = await executarOrk(maestro("FATO_CONFIRMADO")!, { ...agentes(), LABORATORIO: async () => { throw Error(); },
      RECONCILIADOR: async ({ resultados }) => {
        expect(resultados.find(r => r.id === "LABORATORIO")?.resultado).toBe("error");
        const v = visao(); v.cobertura.setoresAvaliados = v.cobertura.setoresAvaliados.filter(s => s !== "LABORATORIO");
        v.lacunas.push({ codigo: "EXECUCAO_ERROR", texto: "Falha de avaliação", setor: "LABORATORIO", fatos: [] }); return v;
      } });
    expect(run.estado).toBe("PRONTO");
  });
  it.each(["ausente", "falhou", "estado-falso", "cobertura-falsa"])("final %s não fica pronto", async modo => {
    const a = agentes();
    if (modo !== "ausente") a.RECONCILIADOR = async () => {
      if (modo === "falhou") throw Error();
      if (modo === "estado-falso") return { state: "PRONTO" };
      const v = visao(); v.cobertura.setoresEsperados = []; return v;
    };
    expect((await executarOrk(maestro("FATO_CONFIRMADO")!, a)).estado).toBe("FALHOU");
  });
  it("visão sem lacuna para setor não avaliado é incompleta", async () => {
    const run = await executarOrk(maestro("FATO_CONFIRMADO")!, { ...agentes(), RECONCILIADOR: async () => {
      const v = visao(); v.cobertura.setoresAvaliados = []; return v;
    } });
    expect(run.estado).toBe("FALHOU");
  });
  it("timeout aborta, descarta saída tardia e registra apenas id uma vez", async () => {
    let signal: AbortSignal | undefined;
    let liberar!: (x: unknown) => void;
    const tardio = new Promise(resolve => { liberar = resolve; });
    const timeout = vi.fn(); const descarte = vi.fn();
    const run = await executarOrk({ evento: "TESTE", passos: [{ id: "A", dependsOn: [], timeoutMs: 5 }] }, {
      A: async c => { signal = c.signal; return tardio; },
    }, { onTimeout: timeout, aoDescartarTardio: descarte });
    expect(signal?.aborted).toBe(true); expect(run.estado).toBe("FALHOU");
    liberar({ state: "PRONTO", texto: "não deve sair" });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(timeout.mock.calls).toEqual([["A"]]); expect(descarte.mock.calls).toEqual([["A"]]);
    expect(run.resultados).toEqual([{ id: "A", resultado: "unattempted", motivo: "TIMEOUT", tentativas: 1 }]);
  });
  it("callback de auditoria falhando não altera resultado", async () => {
    const run = await executarOrk({ evento: "T", passos: [{ id: "A", dependsOn: [], timeoutMs: 5 }] }, {
      A: async () => new Promise(() => {}),
    }, { onTimeout: () => { throw Error(); } });
    expect(run.estado).toBe("FALHOU");
  });
  it("preserva proibição de reentrada também no reconciliador", async () => {
    const p = { evento: "T", passos: [{ id: "RECONCILIADOR", dependsOn: [], timeoutMs: 100 }] };
    const run = await executarOrk(p, { RECONCILIADOR: async () => executarOrk(p, {}) });
    expect(run.estado).toBe("FALHOU"); expect(run.resultados[0]?.resultado).toBe("error");
  });
  it("agente tardio não altera evidência de predecessor através do contexto retido", async () => {
    let liberar!: () => void; const espera = new Promise<void>(resolve => { liberar = resolve; });
    const run = await executarOrk({ evento: "T", passos: [
      { id: "A", dependsOn: [], timeoutMs: 100 }, { id: "B", dependsOn: ["A"], timeoutMs: 5 },
    ] }, {
      A: async () => ({ fundo: { valor: "original" } }),
      B: async contexto => { await espera;
        const anterior = contexto.resultados[0];
        if (anterior?.resultado === "ok") (anterior.saida as { fundo: { valor: string } }).fundo.valor = "adulterado";
        return {}; },
    });
    const antes = JSON.stringify(run); liberar(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(JSON.stringify(run)).toBe(antes); expect(run.resultados[0]).toMatchObject({ saida: { fundo: { valor: "original" } } });
  });
  it("agente não pode alterar seu próprio resultado após publicação", async () => {
    const retido = { fundo: { valor: "original" } };
    const run = await executarOrk({ evento: "T", passos: [{ id: "A", dependsOn: [], timeoutMs: 100 }] }, { A: async () => retido });
    const antes = JSON.stringify(run); retido.fundo.valor = "adulterado";
    expect(JSON.stringify(run)).toBe(antes); expect(run.resultados[0]).toMatchObject({ saida: { fundo: { valor: "original" } } });
  });
  it("saída com função não provoca retry do agente nem guarda capacidade executável", async () => {
    const extra = vi.fn(); const agente = vi.fn(async () => ({ agentes: { EXTRA: extra }, valor: { n: 1 } }));
    const run = await executarOrk({ evento: "T", passos: [{ id: "A", dependsOn: [], timeoutMs: 100 }] }, { A: agente });
    expect(agente).toHaveBeenCalledOnce(); expect(extra).not.toHaveBeenCalled();
    expect(run.resultados[0]).toMatchObject({ resultado: "ok", tentativas: 1, saida: { agentes: { EXTRA: null }, valor: { n: 1 } } });
  });
});
