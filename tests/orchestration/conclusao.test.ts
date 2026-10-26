import { describe, expect, it, vi } from "vitest";
import { executarOrk } from "../../src/orchestration/ork.js";
import { maestro } from "../../src/orchestration/maestro.js";
import type { Plano } from "../../src/orchestration/tipos.js";
import type { VisaoIntegrada } from "../../src/contracts/f1/visaoIntegrada.js";

const passo = (id: string, dependsOn: string[] = []) => ({ id, dependsOn, timeoutMs: 100 });
const setores = ["LABORATORIO", "IMAGEM"] as const;
const visao = (): VisaoIntegrada => ({
  schema: "VisaoIntegrada@1",
  correlacao: { patientId: "SINTETICO", encounterId: "en-sintetico", tumorLotId: null,
    operationId: "op-sintetica", revisaoFatos: "1", regras: [], biblioteca: { id: "bib", versao: "1", hash: "sintetico" }, proposta: null },
  achados: [], lacunas: [], cobertura: { setoresEsperados: [...setores], setoresAvaliados: [...setores], avaliados: 0, semRegraAprovada: 0 },
});
const ordens = [
  ["LABORATORIO", "IMAGEM", "RECONCILIADOR"], ["LABORATORIO", "RECONCILIADOR", "IMAGEM"],
  ["IMAGEM", "LABORATORIO", "RECONCILIADOR"], ["IMAGEM", "RECONCILIADOR", "LABORATORIO"],
  ["RECONCILIADOR", "LABORATORIO", "IMAGEM"], ["RECONCILIADOR", "IMAGEM", "LABORATORIO"],
];

describe("conclusão técnica explícita e independente da ordem", () => {
  it.each(ordens)("valida reconciliador em qualquer ordem: %j", async (...ordem) => {
    const plano: Plano = { evento: "SINTETICO", passos: ordem.map(id => passo(id, id === "RECONCILIADOR" ? [...setores] : [])) };
    for (const modo of ["valida", "ausente", "falha", "invalida", "incompleta"] as const) {
      const agentes = { LABORATORIO: async () => ({}), IMAGEM: async () => ({}),
        ...(modo === "ausente" ? {} : { RECONCILIADOR: async () => {
          if (modo === "falha") throw Error("SINTETICO");
          if (modo === "invalida") return { state: "PRONTO" };
          const v = visao();
          if (modo === "incompleta") v.cobertura.setoresAvaliados = [];
          return v;
        } }),
      };
      const run = await executarOrk(plano, agentes);
      expect(run.estado, modo).toBe(modo === "valida" ? "PRONTO" : "FALHOU");
      expect(run.diagnosticoConclusao?.criterioAtendido).toBe(modo === "valida");
      expect(run.diagnosticoConclusao?.politica).toEqual({ tipo: "RECONCILIADOR", passoId: "RECONCILIADOR" });
      expect(JSON.stringify(run.diagnosticoConclusao)).not.toContain("patientId");
    }
  });

  it("identifica reconciliador customizado e entrega falha como lacuna", async () => {
    const reconciliar = vi.fn(async () => {
      const v = visao(); v.cobertura.setoresAvaliados = ["IMAGEM"];
      v.lacunas.push({ codigo: "EXECUCAO_ERROR", setor: "LABORATORIO", texto: "Falha SINTETICA", fatos: [] });
      return v;
    });
    const run = await executarOrk({ evento: "SINTETICO", conclusao: { tipo: "RECONCILIADOR", passoId: "JOIN_FINAL" },
      passos: [passo("JOIN_FINAL", [...setores]), ...setores.map(s => passo(s))] },
    { LABORATORIO: async () => { throw Error(); }, IMAGEM: async () => ({}), JOIN_FINAL: reconciliar });
    expect(reconciliar).toHaveBeenCalledOnce();
    expect(run.estado).toBe("PRONTO");
    expect(run.diagnosticoConclusao).toMatchObject({ reconciliacao: "VALIDA", passosComSucesso: ["IMAGEM", "JOIN_FINAL"],
      falhas: [{ id: "LABORATORIO", resultado: "error", motivo: "AGENTE_ERRO" }] });
  });

  it("preserva ALGUM_TERMINAL e permite TODOS_TERMINAIS explicitamente sem esconder falhas", async () => {
    const plano: Plano = { evento: "SINTETICO", passos: [passo("OK"), passo("AUSENTE"), passo("DEPENDENTE", ["AUSENTE"])] };
    const parcial = await executarOrk(plano, { OK: async () => "SINTETICO" });
    expect(parcial.estado).toBe("PRONTO");
    expect(parcial.diagnosticoConclusao).toMatchObject({ politica: { tipo: "ALGUM_TERMINAL" },
      passosEsperados: ["AUSENTE", "DEPENDENTE", "OK"], passosComSucesso: ["OK"], terminais: ["DEPENDENTE", "OK"],
      falhas: [{ id: "AUSENTE", resultado: "missing", motivo: "AGENTE_INDISPONIVEL" },
        { id: "DEPENDENTE", resultado: "unattempted", motivo: "DEPENDENCIA_INDISPONIVEL" }] });
    expect((await executarOrk({ ...plano, conclusao: { tipo: "TODOS_TERMINAIS" } }, { OK: async () => "SINTETICO" })).estado).toBe("FALHOU");
    expect((await executarOrk({ ...plano, conclusao: { tipo: "TODOS_TERMINAIS" } }, {
      OK: async () => ({}), AUSENTE: async () => ({}), DEPENDENTE: async () => ({}),
    })).estado).toBe("PRONTO");
  });

  it.each(["ALGUM_TERMINAL", "TODOS_TERMINAIS"] as const)("plano vazio não satisfaz %s", async tipo => {
    expect((await executarOrk({ evento: "SINTETICO", passos: [], conclusao: { tipo } }, {})).estado).toBe("FALHOU");
  });

  it("rejeita políticas inválidas antes de executar agentes", async () => {
    const agente = vi.fn(async () => ({}));
    const planos: unknown[] = [
      { evento: "SINTETICO", passos: [passo("A")], conclusao: { tipo: "RECONCILIADOR", passoId: "INEXISTENTE" } },
      { evento: "SINTETICO", passos: [passo("A"), passo("JOIN")], conclusao: { tipo: "RECONCILIADOR", passoId: "JOIN" } },
      { evento: "SINTETICO", passos: [passo("RECONCILIADOR")], conclusao: { tipo: "ALGUM_TERMINAL" } },
      { evento: "SINTETICO", passos: [passo("A")], conclusao: { tipo: "CLINICAMENTE_APROVADO" } },
      { evento: "SINTETICO", passos: [passo("A")], conclusao: { tipo: "TODOS_TERMINAIS", extra: true } },
    ];
    for (const plano of planos) await expect(executarOrk(plano as Plano, { A: agente, JOIN: agente, RECONCILIADOR: agente })).rejects.toThrow("PLANO_INVALIDO");
    expect(agente).not.toHaveBeenCalled();
  });

  it("maestro explicita políticas e devolve cópias isoladas", () => {
    const clinico = maestro("FATO_CONFIRMADO")!;
    expect(clinico.conclusao).toEqual({ tipo: "RECONCILIADOR", passoId: "RECONCILIADOR" });
    if (clinico.conclusao?.tipo === "RECONCILIADOR") clinico.conclusao.passoId = "ADULTERADO";
    expect(maestro("FATO_CONFIRMADO")!.conclusao).toEqual({ tipo: "RECONCILIADOR", passoId: "RECONCILIADOR" });
    expect(maestro("PRE_CONSULTA")!.conclusao).toEqual({ tipo: "ALGUM_TERMINAL" });
  });
});
