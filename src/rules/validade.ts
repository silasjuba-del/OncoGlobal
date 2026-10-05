import type { Semaforo } from "../contracts/estados.js";
import type { SalaoRuleset } from "../contracts/regras.js";

function diferencaDiasCivis(de: string, ate: string): number {
  const a = Date.UTC(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, Number(de.slice(8, 10)));
  const b = Date.UTC(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)) - 1, Number(ate.slice(8, 10)));
  return Math.trunc((b - a) / 86_400_000);
}

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
  if (dias < 0) {
    return { estado: "PENDENTE", dias, motivo: "coleta futura" };
  }
  if (dias > rs.hemogramaValidadeDias) {
    return { estado: "PENDENTE", dias, motivo: "hemograma vencido" };
  }
  return { estado: "VERDE", dias, motivo: "hemograma válido" };
}
