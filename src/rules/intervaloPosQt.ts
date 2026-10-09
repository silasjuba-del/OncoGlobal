// Q56, A4 · intervalo da última administração de QT até cirurgia ou RT sequencial.
// PROVISORIO-W12: a FN-07 em prazos.ts continua dona do contrato SaidaIntervalo. Este módulo lê intervalos.v1.json.
// Datas civis já resolvidas. O fuso −03:00 é aplicado no barrel, com dataCivilNoOffset. Sem relógio.

import { diferencaDiasCivis } from "./datas.js";

export interface LimitesIntervalo {
  dias: number;
  alvos: readonly string[];
  naoSeAplicaA: readonly string[];
  fuso: string;
  rulesetId: string;
  rulesetVersao: string;
}

export interface EntradaIntervaloCivil {
  ultimaQt: string | null;
  dataAlvo: string | null;
  alvo: string;
}

export interface ResultadoIntervaloPosQt {
  estado: "PASSA" | "AVISO" | "PENDENTE" | "NAO_APLICA";
  dias: number | null;
  motivo: string;
  bloqueiaSalvar: false;
  trava: false;
  rulesetVersao: string;
  fuso: string;
}

type Bruto = Record<string, unknown>;

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function inteiro(valor: unknown, caminho: string): number {
  if (typeof valor !== "number" || !Number.isInteger(valor)) throw new Error(`${caminho} inválido`);
  return valor;
}

function lista(valor: unknown, caminho: string): string[] {
  if (!Array.isArray(valor) || valor.length === 0) throw new Error(`${caminho} ausente`);
  return valor.map((item, i) => texto(item, `${caminho}[${i}]`));
}

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;

export function lerIntervalos(json: unknown): LimitesIntervalo {
  const raiz = objeto(json, "intervalos");
  const header = objeto(raiz.header, "header");
  if (raiz.igualAoLimitePassa !== true) throw new Error("igualAoLimitePassa inválido");
  if (raiz.efeito !== "AVISO") throw new Error("efeito inválido");
  if (raiz.bloqueiaSalvar !== false) throw new Error("bloqueiaSalvar inválido");
  return {
    dias: inteiro(raiz.intervaloPosQtDias, "intervaloPosQtDias"),
    alvos: lista(raiz.alvos, "alvos"),
    naoSeAplicaA: lista(raiz.naoSeAplicaA, "naoSeAplicaA"),
    fuso: texto(raiz.fuso, "fuso"),
    rulesetId: texto(header.id, "header.id"),
    rulesetVersao: texto(header.versao, "header.versao"),
  };
}

function saida(
  estado: ResultadoIntervaloPosQt["estado"],
  dias: number | null,
  motivo: string,
  limites: LimitesIntervalo,
): ResultadoIntervaloPosQt {
  return {
    estado,
    dias,
    motivo,
    bloqueiaSalvar: false,
    trava: false,
    rulesetVersao: limites.rulesetVersao,
    fuso: limites.fuso,
  };
}

/** Menos de N dias avisa. N exato passa. Concomitante planejada não entra na conta. Data ausente fica pendente. */
export function avaliarIntervaloPosQt(entrada: EntradaIntervaloCivil, limites: LimitesIntervalo): ResultadoIntervaloPosQt {
  if (limites.naoSeAplicaA.includes(entrada.alvo)) {
    return saida("NAO_APLICA", null, "intervalo não se aplica a QT+RT concomitante planejada", limites);
  }
  if (!limites.alvos.includes(entrada.alvo)) {
    return saida("PENDENTE", null, "alvo do intervalo ausente ou não reconhecido", limites);
  }
  if (entrada.ultimaQt === null || entrada.dataAlvo === null) {
    return saida("PENDENTE", null, "data da última quimioterapia ou do alvo ausente", limites);
  }
  if (!CIVIL.test(entrada.ultimaQt) || !CIVIL.test(entrada.dataAlvo)) {
    return saida("PENDENTE", null, "data civil ausente; instante sem fuso não entra na conta", limites);
  }
  const dias = diferencaDiasCivis(entrada.ultimaQt, entrada.dataAlvo);
  if (dias >= limites.dias) return saida("PASSA", dias, `intervalo de ${limites.dias} dias respeitado`, limites);
  return saida("AVISO", dias, `intervalo menor que ${limites.dias} dias (aviso)`, limites);
}
