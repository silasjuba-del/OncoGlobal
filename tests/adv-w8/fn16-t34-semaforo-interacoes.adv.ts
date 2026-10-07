// KIMI-13/14/15 · FN-16 + T-34 · semaforoInteracoes (PLANO R-12 linha 384, R-14 T-34; MATRIZ).
// Regra (FN-16): meds + InteractionKB → findings; lista incompleta ⇒ PENDENTE, NUNCA VERDE.
// Nota da fatia KIMI-13: corpus/rulesets/interacoes.v1.json está INATIVO ⇒ nenhuma interação
// pode virar VERMELHO sem fonte; ausência de checagem ⇒ PENDENTE, nunca "sem interação".
// ESTADO 2026-10-07: semaforoInteracoes existe e está reexportada em src/rules/index.ts.
// Ruleset inativo ou lista incompleta continua PENDENTE, nunca VERDE; par ativo com fonte
// continua VERMELHO (achado, não bloqueio). Título SEM_IMPLEMENTACAO é histórico.
import { describe, expect, it } from "vitest";

interface ResultadoLike { estado?: string; motivo?: string; rulesetVersao?: string }

async function fn16(): Promise<((input: unknown, rs: unknown) => ResultadoLike) | null> {
  const regras = (await import("../../src/rules/index.js")) as Record<string, unknown>;
  const fn = regras["semaforoInteracoes"];
  return typeof fn === "function" ? (fn as (input: unknown, rs: unknown) => ResultadoLike) : null;
}

describe("FN-16 / T-34 · semáforo de interações medicamentosas", () => {
  it("FN-16 · SEM_IMPLEMENTACAO: semaforoInteracoes existe em src/rules", async () => {
    expect(await fn16(),
      "FN-16 não implementado: interacoes.v1.json tem só sementes INATIVAS e não existe motor; " +
      "sem função, nenhum consumidor pode distinguir 'sem interação' de 'interação não checada'").not.toBeNull();
  });

  it("FN-16 · regra da fatia: ruleset 100% inativo ⇒ NENHUMA interação vira VERMELHO sem fonte", async () => {
    const semaforo = await fn16();
    if (!semaforo) return;
    const rsInativo = { interacoes: [{ drogaA: "capecitabina", drogaBouClasse: "varfarina", ativo: false }] };
    const r = semaforo({ medicamentos: ["capecitabina", "varfarina"] }, rsInativo);
    expect(r.estado).not.toBe("VERMELHO"); // sem fonte ativa não há base para vermelho
    expect(r.estado).toBe("PENDENTE");     // checagem ausente/incompleta ⇒ PENDENTE
  });

  it("FN-16 · positivo: lista de medicamentos incompleta ⇒ PENDENTE, nunca VERDE", async () => {
    const semaforo = await fn16();
    if (!semaforo) return;
    expect(semaforo({ medicamentos: null }, { interacoes: [] }).estado).toBe("PENDENTE");
  });

  it("FN-16 · positivo: par coberto por interação ATIVA com fonte ⇒ VERMELHO (achado, não bloqueio)", async () => {
    const semaforo = await fn16();
    if (!semaforo) return;
    const rsAtivo = { interacoes: [{ drogaA: "capecitabina", drogaBouClasse: "varfarina",
      ativo: true, fonte: { tipo: "LITERATURA", trecho: "trecho que sustenta (K-27)" } }] };
    expect(semaforo({ medicamentos: ["capecitabina", "varfarina"] }, rsAtivo).estado).toBe("VERMELHO");
  });

  it("T-34 · negativo: 'sem interação encontrada' só é válida com checagem completa + ruleset ativo", async () => {
    const semaforo = await fn16();
    if (!semaforo) return;
    // Sem checagem completa, ausência de achado nunca pode ser conclusão VERDE.
    const r = semaforo({ medicamentos: ["paracetamol"] }, { interacoes: [] });
    expect(r.estado).not.toBe("VERDE");
  });
});
