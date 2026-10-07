// RT-07 · Labs e cortes do salão (S1/S2) — FALHA real: valor de laboratório absurdo
// (unidade trocada: Hb 9 em vez de 90 décimos de g/dL) corta o paciente sem nenhum
// sinal de plausibilidade/unidade. A especificação RT-07 pede "unidade trocada" tratada.
// Dono provável: src/rules/triagem.ts (Grok) + extrator (Fugu) para sinal de unidade.
import { describe, expect, it } from "vitest";
import { avaliarPortoesW10 } from "../../src/rules/index.js";
import { presente, triagemBase } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

describe("RT-07 · unidade trocada em laboratório", () => {
  it("PROVA DE FALHA (S2): Hb '9' (g/dL digitado onde se espera décimos) corta sem questionar unidade", () => {
    const par = avaliarPortoesW10(triagemBase({ hbDgDl: presente(9) }), { pad: 80, crCentesimos: 100 }, salaoRuleset);
    // O corte por si só é correto (9 < 80); o que falta é o SINAL de plausibilidade:
    const sinaliza = [...par.corteSalao.motivos, ...par.corteSalao.pendentes]
      .some((m) => /unidade|plaus/iu.test(m.texto));
    expect(sinaliza,
      "Hb 9 (=0,9 g/dL em décimos, ou 9 g/dL digitado onde se espera 90) vira corte 'Hb baixa' " +
      "sem nenhum alerta de unidade/plausibilidade. O corte manda o paciente para a fila do médico " +
      "com um dado que provavelmente é erro de unidade. RT-07: unidade trocada = PENDENTE + confirmação.")
      .toBe(true);
  });

  it("PROVA DE FALHA (S2): Hb '12000' (g/L trocado por décimos) não corta e não sinaliza plausibilidade", () => {
    const par = avaliarPortoesW10(triagemBase({ hbDgDl: presente(12000) }), { pad: 80, crCentesimos: 100 }, salaoRuleset);
    const sinaliza = [...par.corteSalao.motivos, ...par.corteSalao.pendentes]
      .some((m) => /unidade|plaus/iu.test(m.texto));
    expect(sinaliza,
      "Hb 12000 (g/L colado como décimos) passa o portão VERDE sem corte e sem sinal: valor " +
      "fisiologicamente impossível entra como válido. Ausência de checagem de faixa plausível.")
      .toBe(true);
  });
});
