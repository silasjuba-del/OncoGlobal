import { DataCivil } from "../../contracts/base.js";
import { dataCivilDoServico } from "../../rules/tempoServico.js";

export function diaDaObservacao(valor: unknown): string | null {
  if (DataCivil.safeParse(valor).success) return valor as string;
  if (typeof valor !== "string") return null;
  const civil = dataCivilDoServico(valor);
  return civil.estado === "OK" ? civil.dataCivil : null;
}

/** A civil day has no invented time. Exact instants must also precede the horizon. */
export function observacaoNoHorizonte(valor: unknown, limiteCivil: string, horizonte: number): boolean {
  const dia = diaDaObservacao(valor);
  return dia !== null && dia <= limiteCivil
    && (DataCivil.safeParse(valor).success || Date.parse(String(valor)) <= horizonte);
}

/** Unknown times overlap the whole service day; equal instants preserve all candidates. */
export function observacoesMaisRecentes<T>(candidatos: readonly T[], obterData: (c: T) => string | null): {
  atuais: T[]; data: string | null;
} {
  const observacoes = candidatos.map(c => {
    const tempo = obterData(c);
    return { c, tempo, civil: DataCivil.safeParse(tempo).success, dia: diaDaObservacao(tempo) };
  });
  if (!observacoes.length || observacoes.some(o => o.dia === null)) return { atuais: [...candidatos], data: null };
  const ultimoDia = observacoes.reduce((dia, o) => o.dia! > dia ? o.dia! : dia, "");
  const doDia = observacoes.filter(o => o.dia === ultimoDia);
  const ultimoInstante = Math.max(...doDia.filter(o => !o.civil).map(o => Date.parse(o.tempo!)));
  const atuais = doDia.filter(o => o.civil || Date.parse(o.tempo!) === ultimoInstante);
  return { atuais: atuais.map(o => o.c), data: atuais.some(o => o.civil) ? ultimoDia : atuais[0]!.tempo };
}
