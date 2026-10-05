// FN-07 avisoIntervaloPosQt + FN-08 ehConcomitante — T-24, T-25 (Q56, A4). Aviso, nunca trava.
import { describe, expect, it } from "vitest";
import { avisoIntervaloPosQt, ehConcomitante } from "../../src/rules/index.js";
import { RULESET_VERSAO, prazosRuleset } from "../fixtures/rulesets.js";
import { HOJE } from "../fixtures/triagem.js";

describe("FN-07 intervalo pós-QT (30 dias, igual passa)", () => {
  it("última QT 2026-09-05 e cirurgia 2026-10-05 (30 d) → VERDE", () => {
    const r = avisoIntervaloPosQt("2026-09-05", "2026-10-05", "CIRURGIA", prazosRuleset);
    expect(r.estado).toBe("VERDE");
    expect(r.dias).toBe(30);
    expect(r.rulesetVersao).toBe(RULESET_VERSAO);
  });
  it("cirurgia 2026-10-04 (29 d) → VERMELHO (aviso)", () => {
    const r = avisoIntervaloPosQt("2026-09-05", "2026-10-04", "CIRURGIA", prazosRuleset);
    expect(r.estado).toBe("VERMELHO");
    expect(r.dias).toBe(29);
  });
  it("RT_SEQUENCIAL a 30 d → VERDE (mesmo intervalo da cirurgia)", () =>
    expect(avisoIntervaloPosQt("2026-09-05", "2026-10-05", "RT_SEQUENCIAL", prazosRuleset).estado).toBe("VERDE"));
  it("RT_CONCOMITANTE a 5 d → VERDE (nunca avisa)", () => {
    const r = avisoIntervaloPosQt("2026-09-30", "2026-10-05", "RT_CONCOMITANTE", prazosRuleset);
    expect(r.estado).toBe("VERDE");
  });
  it("última QT null → PENDENTE", () => {
    const r = avisoIntervaloPosQt(null, "2026-10-05", "CIRURGIA", prazosRuleset);
    expect(r.estado).toBe("PENDENTE");
    expect(r.dias).toBeNull();
  });
  it("saída carrega rulesetVersao 1.0.0", () =>
    expect(avisoIntervaloPosQt("2026-09-05", "2026-10-05", "CIRURGIA", prazosRuleset).rulesetVersao).toBe(RULESET_VERSAO));
});

describe("FN-08 concomitância QT × RT (sobreposição de períodos)", () => {
  it("períodos sobrepostos → true", () =>
    expect(ehConcomitante(
      { inicio: "2026-09-01", fim: "2026-09-30" },
      { inicio: "2026-09-15", fim: "2026-10-15" },
      HOJE,
    )).toBe(true));
  it("períodos disjuntos → false", () =>
    expect(ehConcomitante(
      { inicio: "2026-08-01", fim: "2026-08-30" },
      { inicio: "2026-09-15", fim: "2026-10-15" },
      HOJE,
    )).toBe(false));
  it("fim null = em curso até hoje → true quando sobrepõe", () =>
    expect(ehConcomitante(
      { inicio: "2026-09-01", fim: null },
      { inicio: "2026-09-20", fim: null },
      HOJE,
    )).toBe(true));
  it("fim null em curso, mas o outro período já terminou antes → false", () =>
    expect(ehConcomitante(
      { inicio: "2026-08-01", fim: "2026-08-30" },
      { inicio: "2026-09-15", fim: null },
      HOJE,
    )).toBe(false));
});
