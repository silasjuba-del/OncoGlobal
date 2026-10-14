/** Decisões D-F0C-01..06 do Dr. Silas, 2026-10-10. Regras puras, sem conduta automática. */
export interface MedidaClinica {
  valor: number | null;
  unidade: string | null;
  fonte: string | null;
}
export interface EntradaCockcroftGault {
  idadeAnos: number | null;
  sexoFormula: "MASCULINO" | "FEMININO" | null;
  peso: MedidaClinica;
  creatinina: MedidaClinica;
}
export interface ResultadoCockcroftGault {
  estado: "CALCULADO" | "PENDENTE";
  clcrMlMin: number | null;
  metodo: "COCKCROFT_GAULT_PESO_REAL";
  valoresUsados: EntradaCockcroftGault;
  fatorSexo: number | null;
  motivo: string | null;
  consultaSegue: true;
}
const positivo = (n: number | null): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const temFonte = (m: MedidaClinica): boolean => typeof m.fonte === "string" && m.fonte.trim().length > 0;

/** Peso da balança inclusive em obesos; resultado sem teto (o teto pertence ao Calvert). */
export function cockcroftGault(e: EntradaCockcroftGault): ResultadoCockcroftGault {
  const fator = e.sexoFormula === "FEMININO" ? 0.85 : e.sexoFormula === "MASCULINO" ? 1 : null;
  let motivo: string | null = null;
  if (!positivo(e.idadeAnos) || e.idadeAnos >= 140 || fator === null) motivo = "IDADE_OU_SEXO_FORMULA_INVALIDO";
  else if (!positivo(e.peso.valor) || e.peso.unidade !== "kg" || !temFonte(e.peso)) motivo = "PESO_REAL_INVALIDO_OU_SEM_FONTE";
  else if (!positivo(e.creatinina.valor) || e.creatinina.unidade !== "mg/dL" || !temFonte(e.creatinina)) motivo = "CREATININA_INVALIDA_OU_SEM_FONTE";
  const valor = motivo === null ? ((140 - e.idadeAnos!) * e.peso.valor! * fator!) / (72 * e.creatinina.valor!) : null;
  if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) motivo = "RESULTADO_INVALIDO";
  return { estado: motivo === null ? "CALCULADO" : "PENDENTE", clcrMlMin: motivo === null ? valor : null,
    metodo: "COCKCROFT_GAULT_PESO_REAL", valoresUsados: { ...e, peso: { ...e.peso }, creatinina: { ...e.creatinina } },
    fatorSexo: fator, motivo, consultaSegue: true };
}

export type AnalitoCritico = "NA" | "K" | "CA_TOTAL";
export interface ResultadoCritico {
  analito: AnalitoCritico;
  estado: "AVISO" | "SEM_AVISO" | "PENDENTE";
  motivo: string | null;
  medida: MedidaClinica | null;
  consultaSegue: true;
}
const cortes = {
  NA: { minimo: 125, maximo: 145, unidade: "mmol/L" },
  K: { minimo: 3, maximo: 6, unidade: "mmol/L" },
  CA_TOTAL: { minimo: 8, maximo: 12, unidade: "mg/dL" },
} as const;

/** Somente os três analitos aprovados; unidade desconhecida nunca vira normal. */
export function avaliarCriticos(medidas: Partial<Record<AnalitoCritico, MedidaClinica | null>>): ResultadoCritico[] {
  return (Object.keys(cortes) as AnalitoCritico[]).map((analito) => {
    const medida = medidas[analito] ?? null;
    const corte = cortes[analito];
    if (!medida || !positivo(medida.valor) || medida.unidade !== corte.unidade || !temFonte(medida)) {
      return { analito, estado: "PENDENTE", motivo: "VALOR_UNIDADE_OU_FONTE_AUSENTE_INVALIDO", medida, consultaSegue: true };
    }
    const aviso = medida.valor < corte.minimo || medida.valor > corte.maximo;
    return { analito, estado: aviso ? "AVISO" : "SEM_AVISO", motivo: aviso ? "FORA_DO_CORTE_APROVADO" : null,
      medida: { ...medida }, consultaSegue: true };
  });
}

export type GrupoExame = "HEMOGRAMA" | "BIOQUIMICA";
export interface ResultadoValidade {
  estado: "VALIDO" | "VENCIDO" | "PENDENTE";
  validadeHoras: number;
  idadeHoras: number | null;
  motivo: string | null;
  consultaSegue: true;
}
interface IntervaloData { minimo: number; maximo: number; exato: boolean }
const HORA = 3_600_000;
function intervaloData(texto: string | null): IntervaloData | null {
  if (!texto) return null;
  const civil = /^\d{4}-\d{2}-\d{2}$/.test(texto);
  if (!civil && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(texto)) return null;
  const data = texto.slice(0, 10);
  const meiaNoite = Date.parse(`${data}T00:00:00Z`);
  if (!Number.isFinite(meiaNoite) || new Date(meiaNoite).toISOString().slice(0, 10) !== data) return null;
  if (civil) {
    // Sem hora/fuso não se inventa coleta à meia-noite: cobre todo o dia e fusos ±14h.
    return { minimo: meiaNoite - 14 * HORA, maximo: meiaNoite + 38 * HORA, exato: false };
  }
  const hora = Number(texto.slice(11, 13));
  const minuto = Number(texto.slice(14, 16));
  const segundo = Number(texto.slice(17, 19));
  const instante = Date.parse(texto);
  if (hora > 23 || minuto > 59 || segundo > 59 || !Number.isFinite(instante)) return null;
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(texto);
  if (offset && (Number(offset[2]) > 14 || Number(offset[3]) > 59 || (Number(offset[2]) === 14 && Number(offset[3]) !== 0))) return null;
  return { minimo: instante, maximo: instante, exato: true };
}

/** Prazo específico da ficha, quando fornecido, prevalece sobre o padrão aprovado. */
export function avaliarValidadeExame(grupo: GrupoExame, coletadoEm: string | null, agora: string | null,
  validadeEspecificaHoras?: number): ResultadoValidade {
  const validadeHoras = validadeEspecificaHoras ?? (grupo === "HEMOGRAMA" ? 72 : 168);
  const coleta = intervaloData(coletadoEm);
  const atual = intervaloData(agora);
  const resultado = (estado: ResultadoValidade["estado"], motivo: string | null, idadeHoras: number | null = null): ResultadoValidade =>
    ({ estado, validadeHoras, idadeHoras, motivo, consultaSegue: true });
  if (!positivo(validadeHoras) || !coleta || !atual) return resultado("PENDENTE", "DATA_OU_VALIDADE_AUSENTE_INVALIDA");
  if (coleta.minimo > atual.maximo) return resultado("PENDENTE", "COLETA_FUTURA");
  if (!coleta.exato || !atual.exato) {
    if ((atual.minimo - coleta.maximo) / HORA > validadeHoras) return resultado("VENCIDO", "VENCIMENTO_CONFIRMADO_MESMO_SEM_HORARIO");
    return resultado("PENDENTE", "HORARIO_OU_FUSO_INSUFICIENTE");
  }
  const idade = (atual.minimo - coleta.minimo) / HORA;
  return idade > validadeHoras ? resultado("VENCIDO", "PRAZO_EXCEDIDO", idade) : resultado("VALIDO", null, idade);
}

export interface ToxicidadeAtual { sintoma: string; grau: number | null; persistente: boolean | null }
export function avaliarToxicidadeG2(toxicidades: readonly ToxicidadeAtual[]) {
  const sintomas = toxicidades.filter((t) => t.grau === 2 && t.persistente === true && t.sintoma.trim()).map((t) => t.sintoma.trim());
  return { estado: sintomas.length ? "AVISO" as const : "SEM_AVISO" as const,
    sintomas: [...new Set(sintomas)], condutaAutomatica: false as const, consultaSegue: true as const };
}

export type SorologiaHbv = "HBsAg" | "anti-HBc" | "anti-HBs";
export interface RegistroHbv { resultado: string | null; fonte: string | null }
/** Presença documental não significa sorologia negativa nem interpreta o resultado. */
export function lembrarHbvC1D1(ciclo: number | null, dia: number | null, registros: Partial<Record<SorologiaHbv, RegistroHbv | null>>) {
  // Início ainda sem dia definido (inclusive C1 adiado) mantém lembrete basal, sem inventar administração.
  const aplicavel = ciclo === 1 && (dia === 1 || dia === null);
  const faltantes = aplicavel ? (["HBsAg", "anti-HBc", "anti-HBs"] as const).filter((nome) => {
    const r = registros[nome];
    return !r?.resultado?.trim() || !r.fonte?.trim();
  }) : [];
  return { estado: ciclo === null || (dia === null && ciclo !== 1) ? "PENDENTE" as const : faltantes.length ? "LEMBRETE" as const : "SEM_LEMBRETE" as const,
    aplicavel, faltantes, consultaSegue: true as const };
}
