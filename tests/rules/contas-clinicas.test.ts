import { expect, it } from "vitest";
import { analitosSemCortePorDroga, cockcroftGault, type EntradaCockcroftGault, type MedidaClinica } from "../../src/rules/f0c/clinica.js";
import { preRequisitosC1 } from "../../src/rules/preRequisitosC1.js";

const medida = (valor: number, unidade: string): MedidaClinica => ({ valor, unidade, fonte: "caso-sintetico" });
it.each(['doxorubicina','epirubicina','daunorubicina','idarubicina','gemcitabina','irinotecan'])('variante %s conserva pendências hepáticas',droga=>{
 expect(analitosSemCortePorDroga([droga],new Set()).map(a=>a.codigo)).toEqual(['BILI','AST','ALT']);
});
it('variante cetuximab conserva pendências de eletrólitos',()=>{
 expect(analitosSemCortePorDroga(['cetuximab'],new Set()).map(a=>a.codigo)).toEqual(['MG','K','CA']);
});
const renal = (extra: Partial<EntradaCockcroftGault> = {}): EntradaCockcroftGault => ({
  idadeAnos: 68, sexoFormula: "MASCULINO", peso: medida(120, "kg"), creatinina: medida(1, "mg/dL"), ...extra,
});

it("IMC ≥ 30 mostra o ClCr ajustado ao lado e creatinina < 0,7 só avisa", () => {
  const obeso = cockcroftGault(renal({ alturaCm: 200 }));
  expect(obeso.clcrMlMin).toBe(120);
  expect(obeso.clcrPesoAjustadoMlMin).not.toBeNull();
  expect(obeso.clcrPesoAjustadoMlMin!).toBeLessThan(120);
  expect(obeso.aviso).toContain("peso ajustado");
  const baixa = cockcroftGault(renal({ creatinina: medida(0.6, "mg/dL") }));
  expect(baixa.estado).toBe("CALCULADO");
  expect(baixa.aviso).toContain("0,7");
});

it("bilirrubina e eletrólito sem corte curado não ficam verdes", () => {
  const hepaticos = analitosSemCortePorDroga(["paclitaxel"], new Set(["BILI"]));
  expect(hepaticos.every((a) => a.estado === "PENDENTE")).toBe(true);
  expect(hepaticos.map((a) => a.codigo)).toEqual(["BILI", "AST", "ALT"]);
  expect(analitosSemCortePorDroga(["cisplatina"], new Set())).toEqual([
    { codigo: "MG", estado: "PENDENTE", motivo: "MG ausente para a droga em curso; corte ainda não curado" },
    { codigo: "K", estado: "PENDENTE", motivo: "K ausente para a droga em curso; corte ainda não curado" },
    { codigo: "CA", estado: "PENDENTE", motivo: "CA ausente para a droga em curso; corte ainda não curado" },
  ]);
  expect(analitosSemCortePorDroga(["irinotecan"], new Set()).map((a) => a.codigo)).toEqual(["BILI", "AST", "ALT"]);
  expect(analitosSemCortePorDroga(["cetuximab"], new Set()).map((a) => a.codigo)).toEqual(["MG", "K", "CA"]);
});

it("C1 de cisplatina gera a tarefa de audiometria sem bloquear", () => {
  expect(preRequisitosC1(["cisplatina"], 1)).toEqual([
    { id: "AUDIOMETRIA_BASAL", texto: "C1 com platina: registrar a audiometria basal antes de seguir", bloqueiaSalvar: false },
  ]);
  expect(preRequisitosC1(["cisplatina"], 2)).toEqual([]);
});
