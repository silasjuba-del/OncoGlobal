type SaidaInterna = Omit<ScoreResult, "inputs_used" | "inputs_missing">;
type Achado = import("./tipos-w3.js").Achado;
type ScoreInput = import("./tipos-w3.js").ScoreInput;
type ScoreResult = import("./tipos-w3.js").ScoreResult;
type ScoreRuleset = import("./tipos-w3.js").ScoreRuleset;

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

function pendente(input: ScoreInput, rs: ScoreRuleset | null | undefined, motivo: string, missing: string[]): SaidaInterna {
  return {
    rulesetVersao: rs?.versao ?? "MISSING",
    scoreId: input.scoreId,
    valor: null,
    interpretacao: null,
    achado: achado(`SCORE_${input.scoreId}`, "PENDENTE", motivo, rs?.scoreId ?? input.scoreId, rs?.versao ?? "MISSING", [], missing),
  };
}

function interpretar(valor: number, rs: ScoreRuleset): string | null {
  return rs.interpretacao.find((faixa) => valor >= faixa.min && valor <= faixa.max)?.rotulo ?? null;
}

/** Motor generico de escore declarativo: SOMA/PESOS, sem eval e sem escore clinico embutido. */
function calcularescores(input: ScoreInput, rs: ScoreRuleset | null | undefined): SaidaInterna {
  if (!rs || !rs.ativo) return pendente(input, rs, RULESET_INATIVO, ["ruleset"]);
  if (input.scoreId !== rs.scoreId) return pendente(input, rs, "scoreId divergente [VERIFICAR]", ["scoreId"]);
  if (!rs.aplicabilidade.trim()) return pendente(input, rs, "aplicabilidade ausente [VERIFICAR]", ["aplicabilidade"]);
  if (rs.formula.tipo !== "SOMA" && rs.formula.tipo !== "PESOS") return pendente(input, rs, "formula desconhecida [VERIFICAR]", ["formula"]);
  const campos = rs.formula.tipo === "SOMA" ? rs.formula.campos : Object.keys(rs.formula.pesos);
  if (!campos.length || campos.some((c) => !c.trim()) || new Set(campos).size !== campos.length ||
      (rs.formula.tipo === "PESOS" && Object.values(rs.formula.pesos).some((p) => !Number.isFinite(p)))) {
    return pendente(input, rs, "formula vazia, duplicada ou invalida [VERIFICAR]", ["formula"]);
  }

  const missing = rs.entradasObrigatorias.filter((campo) => input.entradas[campo] === null || input.entradas[campo] === undefined);
  if (missing.length > 0) return pendente(input, rs, "entrada obrigatoria ausente", missing.map((m) => `entradas.${m}`));
  const invalidas = [...new Set([...campos, ...rs.entradasObrigatorias])].filter((c) => !Object.hasOwn(input.entradas, c) || !Number.isFinite(input.entradas[c]));
  if (invalidas.length) return pendente(input, rs, "entrada ausente ou nao finita [VERIFICAR]", invalidas.map((c) => `entradas.${c}`));
  if (rs.interpretacao.some((f) => !Number.isFinite(f.min) || !Number.isFinite(f.max) || f.min > f.max || !f.rotulo.trim())) return pendente(input, rs, "faixa de interpretacao invalida [VERIFICAR]", ["interpretacao"]);

  let valor = 0;
  const used: string[] = [];
  if (rs.formula.tipo === "SOMA") {
    for (const campo of rs.formula.campos) {
      const entrada = input.entradas[campo];
      if (entrada === null || entrada === undefined) return pendente(input, rs, "entrada da formula ausente", [`entradas.${campo}`]);
      valor += entrada;
      used.push(`entradas.${campo}`);
    }
  } else {
    for (const [campo, peso] of Object.entries(rs.formula.pesos)) {
      const entrada = input.entradas[campo];
      if (entrada === null || entrada === undefined) return pendente(input, rs, "entrada da formula ausente", [`entradas.${campo}`]);
      valor += entrada * peso;
      used.push(`entradas.${campo}`, `formula.pesos.${campo}`);
    }
  }

  if (!Number.isFinite(valor)) return pendente(input, rs, "resultado nao finito [VERIFICAR]", ["valor"]);
  if (rs.interpretacao.filter((f) => valor >= f.min && valor <= f.max).length !== 1) return pendente(input, rs, "interpretacao ausente ou ambigua [VERIFICAR]", ["interpretacao"]);
  return {
    rulesetVersao: rs.versao,
    scoreId: rs.scoreId,
    valor,
    interpretacao: interpretar(valor, rs),
    achado: achado(`SCORE_${rs.scoreId}`, "VERDE", "escore calculado por formula declarativa", rs.scoreId, rs.versao, used),
  };
}

export function avaliarEscore(...args: Parameters<typeof calcularescores>): ScoreResult {
  const r = calcularescores(...args);
  const achados = [r.achado];
  return { ...r, inputs_used: [...new Set(achados.flatMap((a) => a.inputs_used))], inputs_missing: [...new Set(achados.flatMap((a) => a.inputs_missing))] };
}
