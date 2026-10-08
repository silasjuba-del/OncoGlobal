// W11-H6 · Decisão clínica Dr. Silas (2026-10-08): plaquetas MENOR que o limiar exclusivo geram ALERTA,
// independente do CTCAE. Alerta é avaliado ANTES e SEPARADO da graduação; não depende nem é suprimido por ela.
// Alerta nunca bloqueia salvar nem altera destino. Limiar e plausibilidade entram pelo JSON (lab-thresholds.v1).
// O classificador CTCAE entra por parâmetro (corpus injetado): este módulo não importa outras regras.

type Bruto = Record<string, unknown>;

export interface LimiarAlertaPlaquetas {
  ativo: boolean;
  rulesetId: string;
  rulesetVersao: string;
  decisao: string;
  limiarExclusivo: number;
  plausivelMin: number;
  plausivelMax: number;
}

export interface EntradaPlaquetas {
  valor: number | null;
  data: string | null;
}

export interface AlertaPlaquetas {
  tipo: "ALERTA_PLAQUETAS";
  estado: "ALERTA" | "SEM_ALERTA" | "PENDENTE";
  valor: number | null;
  data: string | null;
  limiarExclusivo: number;
  motivo: string;
  regraId: string;
  rulesetVersao: string;
  bloqueiaSalvar: false;
}

/** Candidato de graduação CTCAE. Nunca confirmado pelo sistema; ausente nunca vira 0. */
export interface GrauCandidatoPlaquetas {
  grau: number | null;
  estado: "PENDENTE";
  confirmadoPeloMedico: false;
  motivo: string;
}

export type ClassificadorPlaquetas = (valor: number | null) => GrauCandidatoPlaquetas;

/** Posição 0: alerta clínico. Posição 1: graduação CTCAE (sempre depois). */
export type PainelPlaquetas = readonly [AlertaPlaquetas, GrauCandidatoPlaquetas];

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function numero(valor: unknown, caminho: string): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) throw new Error(`${caminho} inválido`);
  return valor;
}

/** Lê o bloco alertaClinico do analito PLQ do ruleset injetado. Número clínico fora do JSON não entra. */
export function lerLimiarAlertaPlaquetas(json: unknown): LimiarAlertaPlaquetas {
  const raiz = objeto(json, "lab-thresholds");
  const header = objeto(raiz.header, "header");
  if (!Array.isArray(raiz.analitos)) throw new Error("analitos ausente");
  const plq = raiz.analitos.map((a) => objeto(a, "analito")).find((a) => a.codigo === "PLQ");
  if (plq === undefined) throw new Error("PLQ ausente");
  const bloco = objeto(plq.alertaClinico, "PLQ.alertaClinico");
  if (bloco.tipo !== "ABAIXO_ESTRITO") throw new Error("PLQ.alertaClinico.tipo deve ser ABAIXO_ESTRITO");
  if (bloco.independenteDoCtcae !== true) throw new Error("PLQ.alertaClinico.independenteDoCtcae deve ser true");
  if (typeof bloco.ativo !== "boolean") throw new Error("PLQ.alertaClinico.ativo ausente");
  const plausivel = objeto(bloco.plausivel, "PLQ.alertaClinico.plausivel");
  const fonte = objeto(bloco.fonte, "PLQ.alertaClinico.fonte");
  return {
    ativo: bloco.ativo,
    rulesetId: texto(header.id, "header.id"),
    rulesetVersao: texto(header.versao, "header.versao"),
    decisao: texto(fonte.referencia, "PLQ.alertaClinico.fonte.referencia"),
    limiarExclusivo: numero(bloco.limiarExclusivo, "PLQ.alertaClinico.limiarExclusivo"),
    plausivelMin: numero(plausivel.min, "PLQ.alertaClinico.plausivel.min"),
    plausivelMax: numero(plausivel.max, "PLQ.alertaClinico.plausivel.max"),
  };
}

function plausivel(valor: number, limiar: LimiarAlertaPlaquetas): boolean {
  return Number.isInteger(valor) && valor >= limiar.plausivelMin && valor <= limiar.plausivelMax;
}

/**
 * Avalia o alerta de plaquetas e, em seguida, a graduação CTCAE (classificador injetado). Alerta primeiro, sempre.
 * Ausente, sem data, inativo ou implausível = PENDENTE (nunca alerta inventado, nunca silêncio).
 * Não lê destino e não bloqueia salvar.
 */
export function avaliarAlertaPlaquetas(entrada: EntradaPlaquetas, limiar: LimiarAlertaPlaquetas, classificar: ClassificadorPlaquetas): PainelPlaquetas {
  const base = {
    tipo: "ALERTA_PLAQUETAS" as const,
    valor: entrada.valor,
    data: entrada.data,
    limiarExclusivo: limiar.limiarExclusivo,
    regraId: limiar.rulesetId,
    rulesetVersao: limiar.rulesetVersao,
    bloqueiaSalvar: false as const,
  };
  const pendencia = (motivo: string): AlertaPlaquetas => ({ ...base, estado: "PENDENTE", motivo });

  let alerta: AlertaPlaquetas;
  let grau: GrauCandidatoPlaquetas;
  if (!limiar.ativo) {
    alerta = pendencia(`alerta de plaquetas não ativo [VERIFICAR]; ${limiar.decisao}`);
    grau = classificar(null);
  } else if (entrada.valor === null) {
    alerta = pendencia("plaquetas ausentes; alerta não inventado nem descartado");
    grau = classificar(null);
  } else if (!plausivel(entrada.valor, limiar)) {
    alerta = pendencia(`plaquetas ${entrada.valor} implausíveis [VERIFICAR]; alerta não avaliado`);
    grau = {
      grau: null,
      estado: "PENDENTE",
      confirmadoPeloMedico: false,
      motivo: `plaquetas ${entrada.valor} implausíveis; grau não vira 0`,
    };
  } else if (entrada.data === null) {
    alerta = pendencia("data da coleta de plaquetas ausente; alerta pendente de data");
    grau = classificar(entrada.valor);
  } else if (entrada.valor < limiar.limiarExclusivo) {
    alerta = {
      ...base,
      estado: "ALERTA",
      motivo: `plaquetas ${entrada.valor}/µL abaixo de ${limiar.limiarExclusivo}/µL; alerta independente do CTCAE (${limiar.decisao})`,
    };
    grau = classificar(entrada.valor);
  } else {
    alerta = {
      ...base,
      estado: "SEM_ALERTA",
      motivo: `plaquetas ${entrada.valor}/µL não abaixo de ${limiar.limiarExclusivo}/µL (${limiar.decisao})`,
    };
    grau = classificar(entrada.valor);
  }

  return [alerta, grau] as const;
}
