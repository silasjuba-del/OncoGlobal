type SaidaInterna = Omit<RecistResult, "inputs_used" | "inputs_missing">;
type Achado = import("./tipos-w3.js").Achado;
type LesaoRecist = import("./tipos-w3.js").LesaoRecist;
type RecistInput = import("./tipos-w3.js").RecistInput;
type RecistResult = import("./tipos-w3.js").RecistResult;
type RecistRuleset = import("./tipos-w3.js").RecistRuleset;

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

// Decimal representado pelo numero de entrada, sem arredondar antes de decidir.
function decimal(v: number): { n: bigint; escala: number } {
  const [mantissa = "0", expoente = "0"] = String(v).toLowerCase().split("e");
  const casas = mantissa.split(".")[1]?.length ?? 0;
  const escala = casas - Number(expoente);
  const n = BigInt(mantissa.replace(".", ""));
  return escala < 0 ? { n: n * 10n ** BigInt(-escala), escala: 0 } : { n, escala };
}

function percentual(atual: number, referencia: number): number | null {
  if (referencia === 0) return null;
  return Number((((atual - referencia) / referencia) * 100).toFixed(6));
}

function todasConfirmadas(lesoes: readonly LesaoRecist[]): boolean {
  return lesoes.every((l) => l.confirmadaPorMedico);
}

function pendente(input: RecistInput, rs: RecistRuleset | null | undefined, motivo: string, missing: string[]): SaidaInterna {
  return {
    rulesetVersao: rs?.versao ?? "MISSING",
    candidate_response: null,
    somaAtualMm: null,
    somaBaselineMm: null,
    somaNadirMm: null,
    percentualBaseline: null,
    percentualNadir: null,
    achado: achado("RECIST", "PENDENTE", motivo, rs?.regraId ?? "recist", rs?.versao ?? "MISSING", [], missing),
  };
}

/** FN-18: resposta RECIST candidata; nao promove fato nem substitui confirmacao medica. */
function calcularrecist(input: RecistInput, rs: RecistRuleset | null | undefined): SaidaInterna {
  if (!rs || !rs.ativo) return pendente(input, rs, RULESET_INATIVO, ["ruleset"]);
  if (
    rs.thresholds.prPercent === undefined ||
    rs.thresholds.pdPercent === undefined ||
    rs.thresholds.pdAbsoluteMm === undefined
  ) {
    return pendente(input, rs, "limiares RECIST ausentes [VERIFICAR]", [
      "thresholds.prPercent",
      "thresholds.pdPercent",
      "thresholds.pdAbsoluteMm",
    ]);
  }
  const limiares = [rs.thresholds.prPercent, rs.thresholds.pdPercent, rs.thresholds.pdAbsoluteMm];
  if (limiares.some((v) => !Number.isFinite(v)) || rs.thresholds.prPercent > 0 || rs.thresholds.prPercent < -100 || rs.thresholds.pdPercent < 0 || rs.thresholds.pdAbsoluteMm < 0) {
    return pendente(input, rs, "limiares RECIST invalidos [VERIFICAR]", ["thresholds"]);
  }
  const series = [input.lesoesAtuais, input.baseline, input.nadir];
  if (series.some((s) => !s.length || s.some((l) => !l.codigo.trim() || !Number.isFinite(l.diametroMm) || l.diametroMm < 0) || new Set(s.map((l) => l.codigo)).size !== s.length)) {
    return pendente(input, rs, "lesoes ausentes, invalidas ou duplicadas [VERIFICAR]", ["lesoes"]);
  }
  const codigos = new Set(input.baseline.map((l) => l.codigo));
  if (series.some((s) => s.length !== codigos.size || s.some((l) => !codigos.has(l.codigo)))) {
    return pendente(input, rs, "conjunto de lesoes-alvo divergente [VERIFICAR]", ["lesoes.codigos"]);
  }

  if (!todasConfirmadas(input.lesoesAtuais) || !todasConfirmadas(input.baseline) || !todasConfirmadas(input.nadir)) {
    return pendente(input, rs, "lesao-alvo sem confirmacao medica", ["lesoes.confirmadaPorMedico"]);
  }

  const escala = Math.max(...series.flatMap((s) => s.map((l) => decimal(l.diametroMm).escala)), ...limiares.map((v) => decimal(v).escala));
  const fator = 10n ** BigInt(escala);
  const inteiro = (v: number) => { const d = decimal(v); return d.n * 10n ** BigInt(escala - d.escala); };
  const somar = (s: readonly LesaoRecist[]) => s.reduce((acc, l) => acc + inteiro(l.diametroMm), 0n);
  const atual = somar(input.lesoesAtuais), base = somar(input.baseline), nadir = somar(input.nadir);
  const somaAtualMm = Number(`${atual}e-${escala}`);
  const somaBaselineMm = Number(`${base}e-${escala}`);
  const somaNadirMm = Number(`${nadir}e-${escala}`);
  if (![somaAtualMm, somaBaselineMm, somaNadirMm].every(Number.isFinite) || nadir > base) {
    return pendente(input, rs, "somas ou nadir inconsistentes [VERIFICAR]", ["baseline", "nadir"]);
  }
  const percentualBaseline = percentual(somaAtualMm, somaBaselineMm);
  const percentualNadir = percentual(somaAtualMm, somaNadirMm);

  if (percentualBaseline === null || percentualNadir === null) {
    return pendente(input, rs, "baseline ou nadir igual a zero [VERIFICAR]", ["baseline", "nadir"]);
  }

  const pr = (atual - base) * 100n * fator <= base * inteiro(rs.thresholds.prPercent);
  const pd = (atual - nadir) * 100n * fator >= nadir * inteiro(rs.thresholds.pdPercent) && atual - nadir >= inteiro(rs.thresholds.pdAbsoluteMm);
  if (atual !== 0n && pr && pd) return pendente(input, rs, "criterios PR e PD concomitantes; precedencia nao parametrizada [VERIFICAR]", ["ruleset.precedencia"]);
  let candidate_response: RecistResult["candidate_response"] = "SD";
  if (atual === 0n) {
    candidate_response = "CR";
  } else if (pr) {
    candidate_response = "PR";
  } else if (
    pd
  ) {
    candidate_response = "PD";
  }

  return {
    rulesetVersao: rs.versao,
    candidate_response,
    somaAtualMm,
    somaBaselineMm,
    somaNadirMm,
    percentualBaseline,
    percentualNadir,
    achado: achado(
      "RECIST",
      "PENDENTE",
      "resposta RECIST candidata para revisao medica",
      rs.regraId,
      rs.versao,
      ["lesoesAtuais", "baseline", "nadir"],
    ),
  };
}

export function avaliarRecist(...args: Parameters<typeof calcularrecist>): RecistResult {
  const r = calcularrecist(...args);
  const achados = [r.achado];
  return { ...r, inputs_used: [...new Set(achados.flatMap((a) => a.inputs_used))], inputs_missing: [...new Set(achados.flatMap((a) => a.inputs_missing))] };
}

// RT-06c (tech lead W10)
export { validarUnidadeMedida } from "./medidas.js";
export type { EntradaUnidade, SaidaUnidade } from "./medidas.js";
