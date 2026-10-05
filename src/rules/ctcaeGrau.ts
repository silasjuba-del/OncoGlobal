type Achado = import("./tipos-w3.js").Achado;
type CriterioDeclarativo = import("./tipos-w3.js").CriterioDeclarativo;
type CtcaeInput = import("./tipos-w3.js").CtcaeInput;
type CtcaeResult = import("./tipos-w3.js").CtcaeResult;
type CtcaeRuleset = import("./tipos-w3.js").CtcaeRuleset;

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

function comparar(valor: number | string | boolean, criterio: CriterioDeclarativo): boolean {
  switch (criterio.operador) {
    case ">":
      return Number(valor) > Number(criterio.valor);
    case ">=":
      return Number(valor) >= Number(criterio.valor);
    case "<":
      return Number(valor) < Number(criterio.valor);
    case "<=":
      return Number(valor) <= Number(criterio.valor);
    case "==":
      return valor === criterio.valor;
    case "!=":
      return valor !== criterio.valor;
  }
}

function pendente(rs: CtcaeRuleset | null | undefined, input: CtcaeInput, motivo: string, missing: string[]): CtcaeResult {
  return {
    rulesetVersao: rs?.versao ?? "MISSING",
    candidate_grade: null,
    achado: achado(`CTCAE_${input.termo}`, "PENDENTE", motivo, rs?.id ?? "ctcae", rs?.versao ?? "MISSING", [], missing),
  };
}

function criterioOk(input: CtcaeInput, criterio: CriterioDeclarativo): { ok: boolean; missing?: string } {
  const valor = input.medidas[criterio.campo];
  if (valor === null || valor === undefined) return { ok: false, missing: `medidas.${criterio.campo}` };
  if (typeof valor !== typeof criterio.valor || (typeof valor === "number" && !Number.isFinite(valor))) return { ok: false, missing: `medidas.${criterio.campo}.tipo_valido` };
  if (criterio.exigeBasal) {
    const basal = input.basal?.[criterio.campo];
    if (basal === null || basal === undefined) return { ok: false, missing: `basal.${criterio.campo}` };
    if (typeof basal !== typeof valor || (typeof basal === "number" && !Number.isFinite(basal))) return { ok: false, missing: `basal.${criterio.campo}.tipo_valido` };
  }
  return { ok: comparar(valor, criterio) };
}

/** FN-17: CTCAE candidato, nunca fato clinico. Tabela clinica entra somente pelo ruleset. */
export function avaliarCtcaeGrau(input: CtcaeInput, rs: CtcaeRuleset | null | undefined): CtcaeResult {
  if (!rs || !rs.ativo) return pendente(rs, input, RULESET_INATIVO, ["ruleset"]);
  if (!input.ctcae_version) return pendente(rs, input, "ctcae_version obrigatória", ["ctcae_version"]);
  if (input.ctcae_version !== rs.ctcae_version) return pendente(rs, input, "ctcae_version divergente [VERIFICAR]", ["ctcae_version"]);
  if (rs.termos.length === 0) return pendente(rs, input, "ruleset CTCAE vazio [VERIFICAR]", ["ruleset.termos"]);

  const termo = rs.termos.find((t) => t.termo === input.termo);
  if (!termo) return pendente(rs, input, "termo CTCAE ausente no ruleset [VERIFICAR]", [`ruleset.termos.${input.termo}`]);
  if (rs.termos.filter((t) => t.termo === input.termo).length !== 1) return pendente(rs, input, "termo duplicado no ruleset [VERIFICAR]", ["ruleset.termos.unico"]);
  const graus = Object.entries(termo.criteriosPorGrau);
  if (!graus.length || graus.some(([g, cs]) => !/^[0-5]$/.test(g) || !cs.length || cs.some((c) =>
    !c.campo.trim() || ![">", ">=", "<", "<=", "==", "!="].includes(c.operador) ||
    (typeof c.valor === "number" && !Number.isFinite(c.valor)) ||
    (!["==", "!="].includes(c.operador) && typeof c.valor !== "number")))) {
    return pendente(rs, input, "criterios de grau vazios ou invalidos [VERIFICAR]", ["criteriosPorGrau"]);
  }

  const missing = new Set<string>();
  let candidato: number | null = null;

  for (const [grauTexto, criterios] of Object.entries(termo.criteriosPorGrau)) {
    const grau = Number(grauTexto);
    if (!Number.isInteger(grau)) continue;
    const resultados = criterios.map((c) => criterioOk(input, c));
    for (const r of resultados) if (r.missing) missing.add(r.missing);
    if (resultados.every((r) => r.ok)) candidato = Math.max(candidato ?? grau, grau);
  }

  if (missing.size > 0) {
    return pendente(rs, input, "entrada ou basal ausente para graduacao candidata", [...missing]);
  }

  return {
    rulesetVersao: rs.versao,
    candidate_grade: candidato,
    achado: achado(
      `CTCAE_${input.termo}`,
      "PENDENTE",
      candidato === null ? "nenhum criterio declarativo atingido; grau nao definido [VERIFICAR]" : "candidate_grade calculado por ruleset; revisao medica obrigatoria",
      rs.id,
      rs.versao,
      [...new Set(["ctcae_version", ...graus.flatMap(([, cs]) => cs.flatMap((c) => c.exigeBasal ? [`medidas.${c.campo}`, `basal.${c.campo}`] : [`medidas.${c.campo}`]))])],
    ),
  };
}
