import type { ResultadoTriagem } from "../contracts/clinico.js";
import type { DoseRuleset } from "../contracts/regras.js";

function tokenAC(esquemaId: string): boolean {
  return esquemaId.split(/[^A-Za-z0-9]+/).some((t) => t.toUpperCase() === "AC");
}

/** FN-09 · AC: ciclos do ruleset sempre vão; os demais AC só se houver corte ou pendência. */
export function cicloVaiAoMedico(
  esquemaId: string,
  numeroCiclo: number,
  r: ResultadoTriagem,
  rs: DoseRuleset,
): boolean {
  if (tokenAC(esquemaId)) {
    if (rs.AC.ciclosComMedico.includes(numeroCiclo)) return true;
    return r.cortes.length > 0 || r.pendentes.length > 0;
  }
  return !r.qtPodeIniciarSemMedico;
}
