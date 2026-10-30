import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { alertarFeve, lerAlertaFeve } from "../../src/rules/alertaFeve.js";

const rs = lerAlertaFeve(JSON.parse(readFileSync("corpus/rulesets/salao-feve.v1.json", "utf8")));
const programados = [{ nome: "doxorrubicina", classe: null }];

it("queda de 16 pontos a partir do basal alerta, e o C1 sem eco basal fica pendente", () => {
  const queda = alertarFeve({
    feve: { percentual: 52, metodo: "Simpson", data: "2026-06-01" },
    feveBasal: { percentual: 68, metodo: "Simpson", data: "2026-01-01" },
    programados,
  }, rs);
  expect(queda.estado).toBe("ALERTA");
  expect(queda.bloqueiaSalvar).toBe(false);
  expect(queda.motivos.some((m) => m.texto.includes("16"))).toBe(true);
  const c1 = alertarFeve({
    feve: { percentual: 60, metodo: "Simpson", data: "2026-06-01" },
    numeroCiclo: 1,
    programados,
  }, rs);
  expect(c1.estado).toBe("PENDENTE");
  expect(c1.pendentes.some((m) => m.codigo === "pendente.feve.basal")).toBe(true);
});
