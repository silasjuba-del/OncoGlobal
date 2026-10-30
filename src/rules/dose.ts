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

  if (typeof e.referenciaMgM2 === "number" && e.referenciaMgM2 > 0 && e.pesoKg !== null && typeof e.alturaCm === "number" && e.alturaCm > 0) {
    const produto = e.alturaCm * e.pesoKg;
    const bsa = Number.isFinite(produto) ? Math.round(Math.sqrt(produto / 3600) * 100) / 100 : null;
    if (bsa === null || bsa <= 0) return {
      doseMg: null, estado: "PENDENTE", motivo: "SC atual não calculável",
      ciclosSemPesoConsecutivos, rulesetVersao: versao,
    };
    let pct: number = e.reducaoPct;
    if (e.nivelDose === 0) pct = 0;
    if (e.nivelDose === -1 || e.nivelDose === -2) {
      if (typeof e.percentualDoNivel !== "number" || !rs.reducoesPct.includes(e.percentualDoNivel)) {
        return { doseMg: null, estado: "PENDENTE", motivo: "nível de dose sem percentual do protocolo",
          ciclosSemPesoConsecutivos, rulesetVersao: versao };
      }
      pct = e.percentualDoNivel;
    }
    const pelaReferencia = arredondaMg(e.referenciaMgM2 * bsa, pct);
    if (!Number.isSafeInteger(pelaReferencia) || pelaReferencia <= 0) return {
      doseMg: null, estado: "PENDENTE", motivo: "resultado da referência do protocolo fora de mg inteiro",
      ciclosSemPesoConsecutivos, rulesetVersao: versao,
    };
    const anterior = e.doseAdministradaAnteriorMg === null ? "dose anterior ausente" : `dose anterior ${e.doseAdministradaAnteriorMg} mg ao lado`;
    const nivel = e.nivelDose === undefined || e.nivelDose === null ? "" : `; nível ${e.nivelDose}`;
    let motivo = `referência do protocolo × SC atual ${bsa} m²; ${anterior}${nivel}`;
    if (typeof e.scAnteriorM2 === "number" && e.scAnteriorM2 > 0 && Math.abs(bsa - e.scAnteriorM2) / e.scAnteriorM2 >= 0.1 - 1e-9) {
      motivo += " — alerta: SC variou ≥ 10%";
    }
    return { doseMg: pelaReferencia, estado: "VERDE", motivo, ciclosSemPesoConsecutivos: 0, rulesetVersao: versao };
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

  const base = e.reducaoPct === 0 ? "dose anterior mantida" : "percentual aplicado à dose anterior";
  const motivo = (e.origemPeso === "INFORMADO_PACIENTE"
    ? `${base} com peso informado pelo paciente`
    : base) + " — SC não recalculada";

  return {
    doseMg,
    estado: "VERDE",
    motivo,
    ciclosSemPesoConsecutivos: 0,
    rulesetVersao: versao,
  };
}
