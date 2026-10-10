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

export interface AdministracaoExposicao {
  adminId: string;
  patientId: string;
  episodioId: string;
  droga: string;
  status: "COMPLETA" | "PARCIAL" | "INTERROMPIDA" | "OMITIDA";
  /** Dose efetivamente administrada, normalizada pela SC daquela administração. */
  quantidadeEfetivaMgM2: number | null;
  unidade: string;
  fonte: string | null;
  /** Instante efetivo. O adaptador as-of exige e valida este campo sem herdar criadoEm. */
  realizadaEm?: string | null;
}
export interface EntradaExposicaoCumulativa {
  patientId: string;
  droga: string;
  administracoes: readonly AdministracaoExposicao[];
  historicoCompleto: boolean | null;
  fonteCompletude: string | null;
}
export interface LimiteExposicaoCumulativa {
  ativo: boolean;
  regraId: string;
  versao: string;
  droga: string;
  unidade: string;
  maximo: number | null;
  comparador: "GT" | "GTE";
  fonte: string | null;
}
export interface ResultadoExposicaoCumulativa {
  patientId: string;
  droga: string;
  /** AVISO = chegou no teto. ALARANJADO = item parcial abaixo do teto, fora do semáforo geral. PENDENTE = dado ausente. */
  estado: "AVISO" | "ALARANJADO" | "SEM_AVISO" | "PENDENTE";
  totalConhecidoMgM2: number | null;
  /** Só preenchido quando a completude longitudinal está documentada. */
  totalMgM2: number | null;
  unidade: "mg/m2" | "U" | "U/m2";
  adminIds: string[];
  episodios: string[];
  fontes: string[];
  pendencias: string[];
  regraVersao: string | null;
  limiteFonte: string | null;
  consultaSegue: true;
}

function decimalExposicao(n: number): { inteiro: bigint; casas: number } {
  const [mantissa = "0", expoente = "0"] = n.toString().split("e");
  const [inteira = "0", fracao = ""] = mantissa.split(".");
  const casas = fracao.length - Number(expoente);
  return casas < 0 ? { inteiro: BigInt(inteira + fracao) * 10n ** BigInt(-casas), casas: 0 }
    : { inteiro: BigInt(inteira + fracao), casas };
}

const UNIDADES_EXPOSICAO = ["mg/m2", "U", "U/m2"] as const;

export function chaveDroga(nome: string): string {
  const base = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (base === "epirubicina") return "epirrubicina";
  if (base === "doxorubicina") return "doxorrubicina";
  return base;
}

/** F14: alcance paciente × droga entre episódios; não soma equivalência entre moléculas. */
export function avaliarExposicaoCumulativa(e: EntradaExposicaoCumulativa, limite: LimiteExposicaoCumulativa | null): ResultadoExposicaoCumulativa {
  const temFonte = (f: string | null): f is string => typeof f === "string" && f.trim().length > 0 && !f.includes("[VERIFICAR]");
  const r: ResultadoExposicaoCumulativa = { patientId: e.patientId, droga: e.droga, estado: "PENDENTE", totalConhecidoMgM2: null,
    totalMgM2: null, unidade: "mg/m2", adminIds: [], episodios: [], fontes: [], pendencias: [], regraVersao: limite?.versao ?? null,
    limiteFonte: limite?.fonte ?? null, consultaSegue: true };
  if (!e.patientId.trim() || !e.droga.trim()) return { ...r, pendencias: ["ESCOPO_AUSENTE"] };
  const unicas = new Map<string, AdministracaoExposicao>();
  const assinaturas = new Map<string, string>();
  for (const a of e.administracoes) {
    if (a.patientId !== e.patientId || chaveDroga(a.droga) !== chaveDroga(e.droga)) continue;
    if (limite && (UNIDADES_EXPOSICAO as readonly string[]).includes(a.unidade) && a.unidade !== limite.unidade) continue;
    if (!a.adminId.trim() || !a.episodioId.trim() || !temFonte(a.fonte) || !(UNIDADES_EXPOSICAO as readonly string[]).includes(a.unidade) ||
      typeof a.quantidadeEfetivaMgM2 !== "number" || !Number.isFinite(a.quantidadeEfetivaMgM2) || a.quantidadeEfetivaMgM2 < 0 ||
      !["COMPLETA", "PARCIAL", "INTERROMPIDA", "OMITIDA"].includes(a.status) || (a.status === "OMITIDA" && a.quantidadeEfetivaMgM2 !== 0)) {
      return { ...r, pendencias: [`ADMINISTRACAO_INVALIDA:${a.adminId}`] };
    }
    const assinatura = JSON.stringify([a.episodioId, a.status, a.quantidadeEfetivaMgM2, a.unidade, a.realizadaEm ?? null]);
    if (assinaturas.has(a.adminId) && assinaturas.get(a.adminId) !== assinatura) return { ...r, pendencias: [`CONFLITO_ADMINISTRACAO:${a.adminId}`] };
    assinaturas.set(a.adminId, assinatura);
    unicas.set(a.adminId, a);
    if (!r.fontes.includes(a.fonte)) r.fontes.push(a.fonte);
  }
  if (!unicas.size) return { ...r, pendencias: ["HISTORICO_AUSENTE"] };
  const efetivas = [...unicas.values()].filter((a) => a.status !== "OMITIDA");
  // Ordenação determinística para que replay e ordem de eventos não alterem a soma decimal.
  efetivas.sort((a, b) => a.adminId < b.adminId ? -1 : a.adminId > b.adminId ? 1 : 0);
  const decimais = efetivas.map((a) => decimalExposicao(a.quantidadeEfetivaMgM2!));
  const casas = Math.max(0, ...decimais.map((d) => d.casas));
  const somaInteira = decimais.reduce((soma, d) => soma + d.inteiro * 10n ** BigInt(casas - d.casas), 0n);
  const total = Number(`${somaInteira}e-${casas}`);
  if (!Number.isFinite(total)) return { ...r, pendencias: ["SOMA_INVALIDA"] };
  r.totalConhecidoMgM2 = total;
  r.adminIds = efetivas.map((a) => a.adminId);
  r.episodios = [...new Set(efetivas.map((a) => a.episodioId))];
  const completo = e.historicoCompleto === true && temFonte(e.fonteCompletude);
  if (!completo) r.pendencias.push("HISTORICO_LONGITUDINAL_INCOMPLETO");
  else { r.totalMgM2 = total; r.fontes.push(e.fonteCompletude!); }
  if (!limite || limite.ativo !== true || !limite.regraId.trim() || !limite.versao.trim() || chaveDroga(limite.droga) !== chaveDroga(e.droga) ||
    !(UNIDADES_EXPOSICAO as readonly string[]).includes(limite.unidade) || !temFonte(limite.fonte) || typeof limite.maximo !== "number" ||
    !Number.isFinite(limite.maximo) || limite.maximo <= 0 || !["GT", "GTE"].includes(limite.comparador)) {
    r.pendencias.push("LIMITE_CURADO_INCOMPATIVEL_OU_AUSENTE"); return r;
  }
  r.unidade = limite.unidade as ResultadoExposicaoCumulativa["unidade"];
  // Compara decimais exatos, evitando falso excesso por 0.1 + 0.2 > 0.3.
  const maximo = decimalExposicao(limite.maximo);
  const escala = Math.max(casas, maximo.casas);
  const totalComparavel = somaInteira * 10n ** BigInt(escala - casas);
  const maximoComparavel = maximo.inteiro * 10n ** BigInt(escala - maximo.casas);
  const excedido = limite.comparador === "GTE" ? totalComparavel >= maximoComparavel : totalComparavel > maximoComparavel;
  const itemParcial = efetivas.some((a) => a.status === "PARCIAL") || !completo;
  r.estado = excedido ? "AVISO" : itemParcial ? "ALARANJADO" : "SEM_AVISO";
  return r;
}

/** Vários tetos da mesma droga só são válidos em unidades diferentes. Qualquer um atingido acende o alarme. */
export function avaliarTetosExposicao(e: EntradaExposicaoCumulativa, limites: readonly LimiteExposicaoCumulativa[]): ResultadoExposicaoCumulativa {
  if (limites.length === 0) return avaliarExposicaoCumulativa(e, null);
  const unidades = limites.map((l) => l.unidade);
  if (new Set(unidades).size !== unidades.length) {
    const r = avaliarExposicaoCumulativa(e, null);
    return { ...r, pendencias: [...new Set([...r.pendencias, "LIMITE_AMBIGUO"])] };
  }
  const partes = limites.map((l) => avaliarExposicaoCumulativa(e, l));
  const estado = partes.some((p) => p.estado === "AVISO") ? "AVISO"
    : partes.some((p) => p.estado === "PENDENTE") ? "PENDENTE"
    : partes.some((p) => p.estado === "ALARANJADO") ? "ALARANJADO"
    : "SEM_AVISO";
  const base = partes.find((p) => p.estado === estado) ?? partes[0]!;
  return { ...base, estado, consultaSegue: true,
    pendencias: [...new Set(partes.flatMap((p) => p.pendencias))],
    fontes: [...new Set(partes.flatMap((p) => p.fontes))],
    adminIds: [...new Set(partes.flatMap((p) => p.adminIds))],
    episodios: [...new Set(partes.flatMap((p) => p.episodios))] };
}

export type ResultadoTotalExposicao = Omit<ResultadoExposicaoCumulativa, "estado" | "regraVersao" | "limiteFonte"> & {
  estado: "TOTAL_DOCUMENTADO" | "PENDENTE";
  comparacao: "NAO_REALIZADA";
};
/** Opt-in explícito: documenta a soma e sua completude, sem comparação ou conclusão de segurança. */
export function calcularTotalExposicao(e: EntradaExposicaoCumulativa): ResultadoTotalExposicao {
  const { estado: _estado, regraVersao: _versao, limiteFonte: _fonte, ...r } = avaliarExposicaoCumulativa(e, null);
  const pendencias = r.pendencias.filter((p) => p !== "LIMITE_CURADO_INCOMPATIVEL_OU_AUSENTE");
  return { ...r, pendencias, estado: pendencias.length ? "PENDENTE" : "TOTAL_DOCUMENTADO", comparacao: "NAO_REALIZADA" };
}
