type SaidaInterna = Omit<CumulativoResult, "inputs_used" | "inputs_missing">;
type Achado = import("./tipos-w3.js").Achado;
type AdministracaoCumulativo = import("./tipos-w3.js").AdministracaoCumulativo;
type CumulativoInput = import("./tipos-w3.js").CumulativoInput;
type CumulativoResult = import("./tipos-w3.js").CumulativoResult;
type LimiteCumulativo = import("./tipos-w3.js").LimiteCumulativo;

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

function efetiva(a: AdministracaoCumulativo): boolean {
  return a.status === "COMPLETA" || a.status === "PARCIAL" || a.status === "INTERROMPIDA";
}

function pendente(input: CumulativoInput, rs: LimiteCumulativo | null | undefined, motivo: string, missing: string[]): SaidaInterna {
  return {
    rulesetVersao: rs?.versao ?? "MISSING",
    patientId: input.patientId,
    episodioId: input.episodioId,
    droga: input.droga,
    total: null,
    unidade: null,
    achado: achado(`CUMULATIVO_${input.droga}`, "PENDENTE", motivo, rs?.regraId ?? "cumulativo", rs?.versao ?? "MISSING", [], missing),
  };
}

/** FN-26: cumulativo por paciente x episodio, usando apenas administracoes efetivas. */
function calcularcumulativoAlerta(input: CumulativoInput, rs: LimiteCumulativo | null | undefined): SaidaInterna {
  if (!rs || !rs.ativo) return pendente(input, rs, RULESET_INATIVO, ["ruleset"]);
  if (rs.maximo === null || !Number.isSafeInteger(rs.maximo) || rs.maximo < 0) return pendente(input, rs, "limite cumulativo ausente ou invalido [VERIFICAR]", ["limite.maximo"]);
  if (rs.droga !== input.droga) return pendente(input, rs, "limite de outra droga [VERIFICAR]", ["limite.droga"]);
  if (!input.patientId.trim() || !input.episodioId.trim()) return pendente(input, rs, "escopo ausente [VERIFICAR]", ["patientId", "episodioId"]);
  if (rs.unidade !== "mg") return pendente(input, rs, "unidade do limite incompatível [VERIFICAR]", ["limite.unidade.mg"]);

  const noEscopo = input.administracoes.filter(
    (a) =>
      a.patientId === input.patientId &&
      a.episodioId === input.episodioId &&
      a.droga === input.droga,
  );
  if (!noEscopo.length) return pendente(input, rs, "historico de administracoes ausente [VERIFICAR]", ["administracoes"]);
  const unicas = new Map<string, AdministracaoCumulativo>();
  for (const a of noEscopo) {
    if (!a.adminId.trim() || !Number.isSafeInteger(a.quantidadeEfetivaMg) || a.quantidadeEfetivaMg < 0 ||
        (!efetiva(a) && a.status !== "OMITIDA") || (a.status === "OMITIDA" && a.quantidadeEfetivaMg !== 0)) {
      return pendente(input, rs, "administracao invalida [VERIFICAR]", [`admin.${a.adminId}`]);
    }
    const anterior = unicas.get(a.adminId);
    const assinatura = (v: AdministracaoCumulativo) => JSON.stringify([v.status, v.quantidadeEfetivaMg, v.unidadeEfetiva ?? "mg", v.inicio, v.fim, v.cicloId, v.item, v.prescricaoRef]);
    if (anterior && assinatura(anterior) !== assinatura(a)) {
      const r = pendente(input, rs, "conflito entre registros da mesma administracao", []);
      r.achado.estado = "VERMELHO";
      r.achado.inputs_used = [`admin.${a.adminId}`];
      return r;
    }
    unicas.set(a.adminId, a);
  }
  const administracoes = [...unicas.values()].filter(efetiva);

  const unidadeIncompativel = administracoes.find((a) => (a.unidadeEfetiva ?? "mg") !== "mg");
  if (unidadeIncompativel) {
    return pendente(input, rs, "unidade da administracao incompatível [VERIFICAR]", [`admin.${unidadeIncompativel.adminId}.unidadeEfetiva.mg`]);
  }

  const total = administracoes.reduce((soma, a) => soma + a.quantidadeEfetivaMg, 0);
  if (!Number.isSafeInteger(total)) return pendente(input, rs, "soma fora da faixa inteira exata [VERIFICAR]", ["total"]);
  const estado = total > rs.maximo ? "VERMELHO" : "VERDE";
  const motivo = total > rs.maximo ? "cumulativo acima do limite ativo" : "cumulativo dentro do limite ativo";

  return {
    rulesetVersao: rs.versao,
    patientId: input.patientId,
    episodioId: input.episodioId,
    droga: input.droga,
    total,
    unidade: "mg",
    achado: achado(
      `CUMULATIVO_${input.droga}`,
      estado,
      motivo,
      rs.regraId,
      rs.versao,
      administracoes.map((a) => `admin.${a.adminId}.quantidadeEfetivaMg`),
    ),
  };
}

export function avaliarCumulativoAlerta(...args: Parameters<typeof calcularcumulativoAlerta>): CumulativoResult {
  const r = calcularcumulativoAlerta(...args);
  const achados = [r.achado];
  return { ...r, inputs_used: [...new Set(achados.flatMap((a) => a.inputs_used))], inputs_missing: [...new Set(achados.flatMap((a) => a.inputs_missing))] };
}
