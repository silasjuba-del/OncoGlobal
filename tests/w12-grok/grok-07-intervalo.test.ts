// W12-GROK-07 · Q56, A4. Menos de 30 dias avisa. 30 exato passa. Concomitante planejada não entra.
// Data ausente fica PENDENTE. Fuso −03:00 injetado. Aviso nunca trava. A FN-07 não muda.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarIntervaloDaUltimaQt, avisoIntervaloPosQt } from "../../src/rules/index.js";
import { avaliarIntervaloPosQt, lerIntervalos } from "../../src/rules/intervaloPosQt.js";
import { RULESET_VERSAO, prazosRuleset } from "../fixtures/rulesets.js";

const json = JSON.parse(readFileSync("corpus/rulesets/intervalos.v1.json", "utf8"));
const limites = lerIntervalos(json);
const PROIBIDO = /\b(liberado|aprovado|apto)\b/i;

function civil(over: Partial<{ ultimaQt: string | null; dataAlvo: string | null; alvo: string }> = {}) {
  return avaliarIntervaloPosQt({
    ultimaQt: "2026-09-05",
    dataAlvo: "2026-10-05",
    alvo: "CIRURGIA",
    ...over,
  }, limites);
}

describe("W12-GROK-07 intervalo de 30 dias", () => {
  it("30 dias exatos passam e não travam", () => {
    const r = civil();
    expect(limites.dias).toBe(30);
    expect(limites.fuso).toBe("-03:00");
    expect(r.estado).toBe("PASSA");
    expect(r.dias).toBe(30);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.trava).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("29 dias avisam; RT sequencial no dia 30 passa", () => {
    const aviso = civil({ dataAlvo: "2026-10-04" });
    expect(aviso.estado).toBe("AVISO");
    expect(aviso.dias).toBe(29);
    expect(aviso.trava).toBe(false);
    expect(aviso.bloqueiaSalvar).toBe(false);

    const rt = civil({ alvo: "RT_SEQUENCIAL" });
    expect(rt.estado).toBe("PASSA");
    expect(rt.dias).toBe(30);
  });

  it("QT+RT concomitante planejada não avisa, mesmo abaixo de 30 dias", () => {
    const r = civil({
      alvo: "QT_RT_CONCOMITANTE_PLANEJADA",
      ultimaQt: "2026-09-30",
      dataAlvo: "2026-10-05",
    });
    expect(r.estado).toBe("NAO_APLICA");
    expect(r.dias).toBeNull();
    expect(r.trava).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("data ausente fica PENDENTE e não vira zero", () => {
    const semQt = civil({ ultimaQt: null });
    const semAlvo = civil({ dataAlvo: null });
    expect(semQt.estado).toBe("PENDENTE");
    expect(semQt.dias).toBeNull();
    expect(semAlvo.estado).toBe("PENDENTE");
    expect(semAlvo.dias).toBeNull();
  });

  it("instante na virada do dia usa o fuso −03:00 injetado", () => {
    const r = avaliarIntervaloDaUltimaQt({
      ultimaQt: "2026-07-01T03:00:00.000Z",
      dataAlvo: "2026-07-31T02:30:00.000Z",
      alvo: "CIRURGIA",
      offset: "-03:00",
    }, json);
    expect(r.estado).toBe("AVISO");
    expect(r.dias).toBe(29);
    expect(r.fuso).toBe("-03:00");
    expect(r.trava).toBe(false);
  });

  it("a mesma entrada devolve a mesma saída e a FN-07 segue 1.0.0", () => {
    const entrada = { ultimaQt: "2026-09-05", dataAlvo: "2026-10-05", alvo: "CIRURGIA", offset: "-03:00" };
    const congelado = JSON.parse(JSON.stringify(entrada));
    const a = avaliarIntervaloDaUltimaQt(entrada, json);
    const b = avaliarIntervaloDaUltimaQt(entrada, json);
    expect(b).toEqual(a);
    expect(entrada).toEqual(congelado);

    const fn07 = avisoIntervaloPosQt("2026-09-05", "2026-10-05", "CIRURGIA", prazosRuleset);
    expect(fn07.estado).toBe("VERDE");
    expect(fn07.rulesetVersao).toBe(RULESET_VERSAO);
    expect(RULESET_VERSAO).toBe("1.0.0");
  });
});
