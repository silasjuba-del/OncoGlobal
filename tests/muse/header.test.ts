import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { RulesetHeader } from "../../src/contracts/agentes.js";
import { RulesetHeader as runtime } from "../../src/contracts/rulesetHeader.mjs";
import { SalaoRuleset } from "../../src/contracts/regras.js";
it("CLI e contratos compartilham header; produção rejeita mês impossível, semver inválida e fonte ausente", () => {
  expect(RulesetHeader).toBe(runtime);
  const rs = JSON.parse(readFileSync(new URL("../../corpus/rulesets/salao-triagem.v1.json", import.meta.url), "utf8"));
  expect(SalaoRuleset.safeParse(rs).success).toBe(true);
  for (const header of [{ ...rs.header, aprovadoEm: "2026-13-01" }, { ...rs.header, versao: "teste" },
    { id: "salao-triagem", versao: "1.0.0" }, { ...rs.header, fonte: null },
    { ...rs.header, fonte: { ...rs.header.fonte, tipo: "DIRETRIZ", trecho: "[VERIFICAR]" } }]) {
    expect(SalaoRuleset.safeParse({ ...rs, header }).success).toBe(false);
  }
});
