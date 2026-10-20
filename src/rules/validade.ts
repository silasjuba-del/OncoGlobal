import { diferencaDiasCivis } from "./datas.js";
import type { Semaforo } from "../contracts/estados.js";
import type { SalaoRuleset } from "../contracts/regras.js";


/** FN-05 · > validade, ausente ou futura ⇒ PENDENTE; ≤ validade ⇒ VERDE (igual passa). */
export function validadeHemograma(
  coleta: string | null,
  hoje: string,
  rs: SalaoRuleset,
): { estado: Semaforo; dias: number | null; motivo: string } {
  if (coleta === null) {
    return { estado: "PENDENTE", dias: null, motivo: "hemograma ausente" };
  }
  const dias = diferencaDiasCivis(coleta, hoje);
  if (dias === null) return {estado:"PENDENTE",dias:null,motivo:"data civil invalida"};
  if (dias < 0) {
    return { estado: "PENDENTE", dias, motivo: "coleta futura" };
  }
  if (dias > rs.hemogramaValidadeDias) {
    return { estado: "PENDENTE", dias, motivo: "hemograma vencido" };
  }
  return { estado: "VERDE", dias, motivo: "hemograma válido" };
}
