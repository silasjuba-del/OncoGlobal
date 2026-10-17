import type { DoseRuleset, EntradaDose, SaidaDose } from "../contracts/regras.js";

/** Meio para cima em inteiros: floor((base × (100 − r) + 50) / 100). */
function arredondaMg(base: number, reducaoPct: number): number {
  return Math.floor((base * (100 - reducaoPct) + 50) / 100);
}

/** FN-04 · cálculo aritmético do percentual informado, nunca recomendação clínica de ajuste. */
export function calcularDose(e: EntradaDose, rs: DoseRuleset): SaidaDose {
  const versao = rs.header.versao;
  const ciclosSemPesoConsecutivos = e.pesoKg === null ? e.ciclosSemPesoAnteriores + 1 : 0;

  if (!Number.isSafeInteger(e.ciclosSemPesoAnteriores) || e.ciclosSemPesoAnteriores < 0
    || !Number.isSafeInteger(ciclosSemPesoConsecutivos)
    || (e.doseAdministradaAnteriorMg !== null && (!Number.isFinite(e.doseAdministradaAnteriorMg) || e.doseAdministradaAnteriorMg < 0))
    || (e.pesoKg !== null && (!Number.isFinite(e.pesoKg) || e.pesoKg <= 0))) {
    return { doseMg: null, estado: "PENDENTE", motivo: "dado numérico inválido; conferir dose, peso e histórico",
      ciclosSemPesoConsecutivos: 0, rulesetVersao: versao };
  }

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
  if (!Number.isSafeInteger(doseMg) || doseMg < 0) return {
    doseMg: null, estado: "PENDENTE", motivo: "resultado fora da precisão de mg inteiro; conferir base",
    ciclosSemPesoConsecutivos, rulesetVersao: versao,
  };
  if (doseMg === 0) return { doseMg, estado: "PENDENTE", motivo: "resultado zero; conferir administração anterior e percentual informado",
    ciclosSemPesoConsecutivos, rulesetVersao: versao };

  if (e.pesoKg === null) {
    const estado = ciclosSemPesoConsecutivos >= rs.semPesoConsecutivosVermelho ? "VERMELHO" : "PENDENTE";
    return {
      doseMg,
      estado,
      motivo: e.reducaoPct === 0 ? "dose anterior mantida sem peso" : "percentual informado aplicado à dose anterior; peso ausente",
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
