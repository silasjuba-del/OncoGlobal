import { SalaoRuleset } from "../../src/contracts/regras.js";
// FN-06 avaliarPeso — T-23 (Q24–Q25, A2). VERMELHO só com pesos MEDIDOS; informado ⇒ PENDENTE.
import { describe, expect, it } from "vitest";
import type { Pesagem } from "../../src/contracts/index.js";
import { avaliarPeso } from "../../src/rules/index.js";
import { salaoRuleset } from "../fixtures/rulesets.js";
import { HOJE } from "../fixtures/triagem.js";

const pesagem = (data: string, kg: number, origem: Pesagem["origem"] = "MEDIDO"): Pesagem => ({ data, kg, origem });

describe("FN-06 tendência de peso (alerta em ≥ 5% na janela de 90 dias)", () => {
  it("perda de 3,75% com dois MEDIDOS → VERDE", () => {
    const r = avaliarPeso([pesagem("2026-08-10", 80), pesagem("2026-10-01", 77)], HOJE, salaoRuleset);
    expect(r.estado).toBe("VERDE");
    expect(r.perdaKg).toBeCloseTo(3, 5);
    expect(r.rulesetVersao).toBe(salaoRuleset.header.versao);
  });
  it("45 kg perdendo 4,9 kg (quase 11%) → VERMELHO; 120 kg perdendo 5,1 kg (cerca de 4%) → VERDE", () => {
    const magro = avaliarPeso([pesagem("2026-08-10", 45), pesagem("2026-10-01", 40.1)], HOJE, salaoRuleset);
    expect(magro.estado).toBe("VERMELHO");
    expect(magro.acao).toEqual(["NUTRICAO", "QT_ADIADA", "CONSULTA_MEDICA"]);
    const obeso = avaliarPeso([pesagem("2026-08-10", 120), pesagem("2026-10-01", 114.9)], HOJE, salaoRuleset);
    expect(obeso.estado).toBe("VERDE");
  });
  it("IMC abaixo de 20 alerta a partir de 2%", () => {
    const r = avaliarPeso([
      { data: "2026-08-10", kg: 52, origem: "MEDIDO", alturaCm: 170 },
      { data: "2026-10-01", kg: 50, origem: "MEDIDO", alturaCm: 170 },
    ], HOJE, salaoRuleset);
    expect(r.estado).toBe("VERMELHO");
  });
  it("perda de 9 kg envolvendo INFORMADO_PACIENTE → PENDENTE (incerta, A2)", () => {
    const r = avaliarPeso(
      [pesagem("2026-08-10", 80, "INFORMADO_PACIENTE"), pesagem("2026-10-01", 71)],
      HOJE, salaoRuleset,
    );
    expect(r.estado).toBe("PENDENTE");
  });
  it("pesagem fora da janela de 90 dias é ignorada (sobra 1 na janela) → PENDENTE", () => {
    const r = avaliarPeso([pesagem("2026-07-01", 80), pesagem("2026-10-01", 74)], HOJE, salaoRuleset);
    expect(r.estado).toBe("PENDENTE");
    expect(r.estado).not.toBe("VERMELHO"); // a perda de 6 kg não pode ser calculada sem a pesagem antiga
  });
  it("1 pesagem → PENDENTE", () => {
    expect(avaliarPeso([pesagem("2026-10-01", 74)], HOJE, salaoRuleset).estado).toBe("PENDENTE");
  });
  it("sem pesagem → PENDENTE", () => {
    expect(avaliarPeso([], HOJE, salaoRuleset).estado).toBe("PENDENTE");
  });
  it("saída carrega a versão do ruleset do salão (1.1.0 desde D-W9-58)", () =>
    expect(avaliarPeso([pesagem("2026-08-10", 80), pesagem("2026-10-01", 75)], HOJE, salaoRuleset).rulesetVersao).toBe(salaoRuleset.header.versao));
});

it('valida parâmetros percentuais e informa o corte efetivamente configurado',()=>{
 for(const campo of ['perdaPctAcimaDe','perdaPctSeImcAbaixoDe','imcAbaixoDe'])for(const valor of ['5',-1,0,Infinity])expect(SalaoRuleset.safeParse({...salaoRuleset,pesoVermelho:{...salaoRuleset.pesoVermelho,[campo]:valor}}).success).toBe(false);
 const rs=SalaoRuleset.parse({...salaoRuleset,pesoVermelho:{...salaoRuleset.pesoVermelho,perdaPctAcimaDe:7}});
 expect(avaliarPeso([pesagem('2026-08-10',80),pesagem('2026-10-01',70)],HOJE,rs).motivo).toContain('corte de 7%');
});
