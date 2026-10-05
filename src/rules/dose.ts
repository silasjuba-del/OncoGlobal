import type { DoseRuleset, EntradaDose, SaidaDose } from "../contracts/regras.js";

/** Meio para cima em inteiros: floor((base × (100 − r) + 50) / 100). */
function arredondaMg(base: number, reducaoPct: number): number {
  return Math.floor((base * (100 - reducaoPct) + 50) / 100);
}

/** FN-04 · base = dose efetivamente administrada no ciclo anterior (K-06). Nunca inventa mg. */
export function calcularDose(e: EntradaDose, rs: DoseRuleset): SaidaDose {
  const versao = rs.header.versao;
  const ciclosSemPesoConsecutivos = e.pesoKg === null ? e.ciclosSemPesoAnteriores + 1 : 0;

  if (!rs.reducoesPct.includes(e.reducaoPct)) {
    return {
      doseMg: null,
      estado: "VERMELHO",
      motivo: "redução não prevista no ruleset",
      ciclosSemPesoConsecutivos,
      rulesetVersao: versao,
    };
  }

  if (e.doseAdministradaAnteriorMg === null) {
    return {
      doseMg: null,
      estado: "PENDENTE",
      motivo: "dose anterior ausente",
      ciclosSemPesoConsecutivos,
      rulesetVersao: versao,
    };
  }

  const doseMg = arredondaMg(e.doseAdministradaAnteriorMg, e.reducaoPct);

  if (e.pesoKg === null) {
    const estado = ciclosSemPesoConsecutivos >= rs.semPesoConsecutivosVermelho ? "VERMELHO" : "PENDENTE";
    return {
      doseMg,
      estado,
      motivo: "dose anterior mantida sem peso",
      ciclosSemPesoConsecutivos,
      rulesetVersao: versao,
    };
  }

  const motivo = e.origemPeso === "INFORMADO_PACIENTE"
    ? "dose calculada com peso informado pelo paciente"
    : "dose calculada";

  return {
    doseMg,
    estado: "VERDE",
    motivo,
    ciclosSemPesoConsecutivos: 0,
    rulesetVersao: versao,
  };
}
