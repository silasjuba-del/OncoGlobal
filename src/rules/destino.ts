import type { Destino } from "../contracts/estados.js";
import type { SalaoRuleset } from "../contracts/regras.js";

/** FN-02 · FRENTE exige zero cortes e zero pendências (K-11). Emergência não entra aqui. */
export function decidirDestino(
  input: {
    temCorte: boolean;
    temPendencia: boolean;
    recurso: "AMBULATORIAL" | "CADEIRA" | "CAMA";
    idadeAnos: number;
  },
  rs: SalaoRuleset,
): Destino {
  if (input.temCorte || input.temPendencia) return "FILA_MEDICO";
  if (rs.frente.recursos.includes(input.recurso) || input.idadeAnos > rs.frente.idadeAcimaDe) {
    return "FRENTE";
  }
  return "SALAO";
}
