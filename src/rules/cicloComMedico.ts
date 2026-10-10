import type { ResultadoTriagem } from "../contracts/clinico.js";
import type { DoseRuleset } from "../contracts/regras.js";

/** FN-09 · AC: ciclos do ruleset sempre vão; os demais AC só se houver corte ou pendência. */
export function cicloVaiAoMedico(
  esquemaId: string,
  numeroCiclo: number,
  r: ResultadoTriagem,
  rs: DoseRuleset,
): boolean {
  const esquemas = rs.AC.esquemas;
  if (!Array.isArray(esquemas) || esquemas.length === 0 || !esquemas.every(e=>typeof e === "string" && e.trim())) return true;
  if (esquemas.some(e=>e.trim().toUpperCase() === esquemaId.trim().toUpperCase())) {
    if (rs.AC.ciclosComMedico.includes(numeroCiclo)) return true;
    return r.cortes.length > 0 || r.pendentes.length > 0 || !r.qtPodeIniciarSemMedico;
  }
  return !r.qtPodeIniciarSemMedico;
}
