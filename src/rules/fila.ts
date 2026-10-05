import type { EntradaFila, SalaoRuleset } from "../contracts/regras.js";

function casaToken(token: string, e: EntradaFila, rs: SalaoRuleset): boolean {
  switch (token) {
    case "ECOG_4":
      return e.ecog === 4;
    case "ECOG_3":
      return e.ecog === 3;
    case "CAMA":
      return e.recurso === "CAMA";
    case "CADEIRA":
      return e.recurso === "CADEIRA";
    case "IDADE_80":
      return e.idadeAnos > rs.frente.idadeAcimaDe;
    default:
      return false;
  }
}

/** Menor índice em `filaOrdem` que casa; senão “demais”. */
function nivel(e: EntradaFila, rs: SalaoRuleset): number {
  const ordem = rs.filaOrdem;
  for (let i = 0; i < ordem.length; i++) {
    const token = ordem[i];
    if (token !== undefined && casaToken(token, e, rs)) return i;
  }
  return ordem.length;
}

/** FN-03 · estável; não muta a entrada. Empate: ECOG maior, depois chegada mais antiga. */
export function ordenarFila(entradas: readonly EntradaFila[], rs: SalaoRuleset): EntradaFila[] {
  return entradas
    .map((entrada, origem) => ({ entrada, origem }))
    .sort((a, b) => {
      const na = nivel(a.entrada, rs);
      const nb = nivel(b.entrada, rs);
      if (na !== nb) return na - nb;
      const ea = a.entrada.ecog ?? -1;
      const eb = b.entrada.ecog ?? -1;
      if (ea !== eb) return eb - ea;
      const ta = Date.parse(a.entrada.chegadaEm);
      const tb = Date.parse(b.entrada.chegadaEm);
      if (ta !== tb) return ta - tb;
      return a.origem - b.origem;
    })
    .map((x) => x.entrada);
}
