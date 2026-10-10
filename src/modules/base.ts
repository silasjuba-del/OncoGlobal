// Tipos mínimos da linha src/modules. Sem I/O, sem relógio, sem dado clínico embutido.


export type Semaforo = "VERDE" | "VERMELHO" | "PENDENTE";

export type RevisaoConfirmada = "CONFIRMADO" | "ASSINADO";

export type DeltaKind = "NOVO" | "MUDOU" | "PERSISTE" | "RESOLVEU";

export interface Secao<T> {
  estado: Semaforo;
  motivo: string;
  itens: T[];
}

export function secaoVazia<T>(motivo: string): Secao<T> {
  return { estado: "PENDENTE", motivo, itens: [] };
}

export function secaoDe<T>(estado: Semaforo, motivo: string, itens: readonly T[]): Secao<T> {
  return { estado, motivo, itens: [...itens] };
}

/** Dias civis (ate − de). Data inválida → null. Não lê relógio. */
export function diferencaDiasCivis(de: string, ate: string): number | null {
  const a = diasDesdeEpoch(de);
  const b = diasDesdeEpoch(ate);
  if (a === null || b === null) return null;
  return b - a;
}

export function fonteInformada(fonte: string | null | undefined): boolean {
  return typeof fonte === "string" && fonte.trim().length > 0;
}


function diasNoMes(ano: number, mes: number): number {
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const tabela = [0, 31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return tabela[mes] ?? 0;
}

/** Algoritmo de Howard Hinnant: dias civis desde 1970-01-01, sem Date. */
function diasDesdeEpoch(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const anoTxt = match[1];
  const mesTxt = match[2];
  const diaTxt = match[3];
  if (anoTxt === undefined || mesTxt === undefined || diaTxt === undefined) return null;
  const ano = Number(anoTxt);
  const mes = Number(mesTxt);
  const dia = Number(diaTxt);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return null;
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = anoAjustado >= 0 ? Math.floor(anoAjustado / 400) : Math.floor((anoAjustado - 399) / 400);
  const anoNaEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaNaEra = anoNaEra * 365 + Math.floor(anoNaEra / 4) - Math.floor(anoNaEra / 100) + diaDoAno;
  return era * 146097 + diaNaEra - 719468;
}
