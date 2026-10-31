import { expect, it } from "vitest";
import { equivalenteDoxorrubicina } from "../../src/rules/equivalenteDoxorrubicina.js";

it("soma o equivalente da ESC e não trata a soma parcial como dentro do limite", () => {
  const baixo = equivalenteDoxorrubicina([{ droga: "epirrubicina", mgM2: 200 }]);
  expect(baixo).toMatchObject({ estado: "SEM_AVISO", equivalenteMgM2: 160, bloqueiaSalvar: false });
  const alto = equivalenteDoxorrubicina([
    { droga: "epirrubicina", mgM2: 200 },
    { droga: "doxorrubicina", mgM2: 100 },
  ], true);
  expect(alto.estado).toBe("ALARANJADO");
  expect(alto.equivalenteMgM2).toBe(260);
  expect(alto.motivo).toContain("RT mediastinal");
  const incompleto = equivalenteDoxorrubicina([{ droga: "ciclofosfamida", mgM2: 600 }]);
  expect(incompleto.estado).toBe("PENDENTE");
  expect(incompleto.equivalenteMgM2).toBeNull();
});
