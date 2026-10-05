type Achado = import("./tipos-w3.js").Achado;
type LabAlertResult = import("./tipos-w3.js").LabAlertResult;
type LabAnalitoRegra = import("./tipos-w3.js").LabAnalitoRegra;
type LabRuleset = import("./tipos-w3.js").LabRuleset;
type LabValor = import("./tipos-w3.js").LabValor;
type LabValorNormalizado = import("./tipos-w3.js").LabValorNormalizado;

const RULESET_INATIVO = "regra não ativa [VERIFICAR]";

function achado(
  codigo: string,
  estado: Achado["estado"],
  motivo: string,
  regraId: string,
  rulesetVersao: string,
  inputs_used: string[],
  inputs_missing: string[] = [],
): Achado {
  return { codigo, estado, motivo, regraId, rulesetVersao, inputs_used, inputs_missing };
}

function resultPendente(rs: LabRuleset | null | undefined, inputs_missing: string[]): LabAlertResult {
  return {
    rulesetVersao: rs?.versao ?? "MISSING",
    achados: [
      achado("LAB_RULESET", "PENDENTE", RULESET_INATIVO, rs?.id ?? "lab-alerts", rs?.versao ?? "MISSING", [], inputs_missing),
    ],
    valores_normalizados: [],
  };
}

function regraDoAnalito(rs: LabRuleset, codigo: string): LabAnalitoRegra | undefined {
  const alvo = codigo.toLowerCase();
  return rs.analitos.find((r) => r.codigo.toLowerCase() === alvo || (r.aliases ?? []).some((a) => a.toLowerCase() === alvo));
}

function normalizar(v: LabValor, regra: LabAnalitoRegra): { valor: LabValorNormalizado | null; achado?: Achado } {
  if (v.unidade === regra.threshold.unidade) {
    return {
      valor: {
        ...v,
        valorOriginal: v.valor,
        unidadeOriginal: v.unidade,
        convertidoPorRegraId: null,
      },
    };
  }

  const conversao = regra.conversoes.find((c) => c.de === v.unidade && c.para === regra.threshold.unidade);
  if (!conversao || !Number.isFinite(conversao.fator) || conversao.fator <= 0 || !conversao.fonte.trim() || !conversao.regraId.trim()) {
    return {
      valor: null,
      achado: achado(
        `LAB_${regra.codigo}`,
        "PENDENTE",
        "unidade desconhecida",
        regra.threshold.regraId,
        "",
        [`${v.codigo}.valor`, `${v.codigo}.unidade`],
        [`conversao.${v.unidade}->${regra.threshold.unidade}`],
      ),
    };
  }

  return {
    valor: {
      ...v,
      codigo: regra.codigo,
      valor: v.valor * conversao.fator,
      unidade: conversao.para,
      valorOriginal: v.valor,
      unidadeOriginal: v.unidade,
      convertidoPorRegraId: conversao.regraId,
    },
  };
}

function valoresConflitam(valores: readonly LabValorNormalizado[]): boolean {
  if (valores.length < 2) return false;
  const primeiro = valores[0];
  if (!primeiro) return false;
  return valores.some((v) => v.unidade !== primeiro.unidade || v.valor !== primeiro.valor);
}

/** FN-19: alertas laboratoriais com conversao apenas por tabela explicita e rastreavel. */
export function avaliarLabAlerts(entradas: readonly LabValor[], rs: LabRuleset | null | undefined): LabAlertResult {
  if (!rs || !rs.ativo) return resultPendente(rs, ["ruleset"]);
  if (rs.analitos.length === 0) return resultPendente(rs, ["ruleset.analitos"]);
  if (entradas.length === 0) return resultPendente(rs, ["entradas"]);

  const achados: Achado[] = [];
  const valores_normalizados: LabValorNormalizado[] = [];
  const porAnalito = new Map<string, LabValorNormalizado[]>();

  for (const entrada of entradas) {
    if (!Number.isFinite(entrada.valor)) {
      achados.push(achado(`LAB_${entrada.codigo}`, "PENDENTE", "valor numerico invalido [VERIFICAR]", rs.id, rs.versao, [], [`${entrada.codigo}.valor`]));
      continue;
    }
    const regra = regraDoAnalito(rs, entrada.codigo);
    if (!regra) {
      achados.push(
        achado(
          `LAB_${entrada.codigo}`,
          "PENDENTE",
          "analito sem regra ativa [VERIFICAR]",
          rs.id,
          rs.versao,
          [`${entrada.codigo}.valor`, `${entrada.codigo}.unidade`],
          [`ruleset.analitos.${entrada.codigo}`],
        ),
      );
      continue;
    }

    const normalizado = normalizar(entrada, regra);
    if (normalizado.achado) {
      achados.push({ ...normalizado.achado, rulesetVersao: rs.versao });
      continue;
    }
    if (!normalizado.valor) continue;
    if (!Number.isFinite(normalizado.valor.valor)) {
      achados.push(achado(`LAB_${entrada.codigo}`, "PENDENTE", "conversao fora da faixa numerica [VERIFICAR]", rs.id, rs.versao, [], ["conversao"]));
      continue;
    }

    valores_normalizados.push(normalizado.valor);
    const lista = porAnalito.get(regra.codigo) ?? [];
    lista.push(normalizado.valor);
    porAnalito.set(regra.codigo, lista);
  }

  for (const [codigo, valores] of porAnalito) {
    const regra = regraDoAnalito(rs, codigo);
    if (!regra) continue;

    if (valoresConflitam(valores)) {
      achados.push(
        achado(
          `LAB_${codigo}`,
          "VERMELHO",
          "conflito entre valores do mesmo analito",
          regra.threshold.regraId,
          rs.versao,
          valores.flatMap((v, i) => [`${codigo}[${i}].valor=${v.valor}`, `${codigo}[${i}].unidade=${v.unidade}`]),
        ),
      );
      continue;
    }

    if (!regra.threshold.ativo) {
      achados.push(
        achado(
          `LAB_${codigo}`,
          "PENDENTE",
          "regra não ativa [VERIFICAR]; threshold inativo: sem cor clinica",
          regra.threshold.regraId,
          rs.versao,
          [`${codigo}.valor`, `${codigo}.unidade`],
        ),
      );
      continue;
    }

    const valor = valores[0];
    if (!valor) continue;
    const { min, max } = regra.threshold;
    if ((min === undefined && max === undefined) ||
        (min !== undefined && !Number.isFinite(min)) ||
        (max !== undefined && !Number.isFinite(max)) ||
        (min !== undefined && max !== undefined && min > max)) {
      achados.push(achado(`LAB_${codigo}`, "PENDENTE", "limiar ausente ou invalido [VERIFICAR]", regra.threshold.regraId, rs.versao, [], ["threshold"]));
      continue;
    }
    if (regra.threshold.min !== undefined && valor.valor < regra.threshold.min) {
      achados.push(
        achado(
          `LAB_${codigo}`,
          "VERMELHO",
          "valor abaixo do limiar ativo",
          regra.threshold.regraId,
          rs.versao,
          [`${codigo}.valor`, `${codigo}.unidade`],
        ),
      );
    } else if (regra.threshold.max !== undefined && valor.valor > regra.threshold.max) {
      achados.push(
        achado(
          `LAB_${codigo}`,
          "VERMELHO",
          "valor acima do limiar ativo",
          regra.threshold.regraId,
          rs.versao,
          [`${codigo}.valor`, `${codigo}.unidade`],
        ),
      );
    } else {
      achados.push(
        achado(
          `LAB_${codigo}`,
          "VERDE",
          "valor dentro do limiar ativo",
          regra.threshold.regraId,
          rs.versao,
          [`${codigo}.valor`, `${codigo}.unidade`],
        ),
      );
    }
  }

  return { rulesetVersao: rs.versao, achados, valores_normalizados };
}
