/** Conversão de instante para data civil do serviço sem depender do fuso do processo. */
export type ResultadoDataCivilServico =
  | { estado: "OK"; dataCivil: string }
  | { estado: "PENDENTE"; codigo: "INSTANTE_AUSENTE" | "INSTANTE_INVALIDO" | "FUSO_INVALIDO" };

const OFFSET_VALIDO = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;
const INSTANTE_COM_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

function offsetMinutos(offset: string): number | null {
  if (offset.toUpperCase() === "Z") return 0;
  if (!OFFSET_VALIDO.test(offset)) return null;
  const horas = Number(offset.slice(1, 3)), minutos = Number(offset.slice(4, 6));
  if (horas === 14 && minutos !== 0) return null;
  const total = horas * 60 + minutos;
  return offset[0] === "+" ? total : -total;
}

/** F04: o chamador injeta o offset de serviço; ausente/inválido nunca usa data atual como fallback. */
export function dataCivilDoServico(instante: string | null | undefined, fuso = "-03:00"): ResultadoDataCivilServico {
  if (typeof instante !== "string" || !instante.trim()) return { estado: "PENDENTE", codigo: "INSTANTE_AUSENTE" };
  const offsetServico = offsetMinutos(fuso);
  if (offsetServico === null) return { estado: "PENDENTE", codigo: "FUSO_INVALIDO" };
  const match = INSTANTE_COM_OFFSET.exec(instante);
  if (!match) return { estado: "PENDENTE", codigo: "INSTANTE_INVALIDO" };
  const [, ano, mes, dia, hora, minuto, segundo, offsetOrigem] = match;
  const y = Number(ano), m = Number(mes), d = Number(dia), h = Number(hora), min = Number(minuto), sec = Number(segundo);
  const dataBase = new Date(0);
  dataBase.setUTCHours(0, 0, 0, 0);
  dataBase.setUTCFullYear(y, m - 1, d);
  if (dataBase.getUTCFullYear() !== y || dataBase.getUTCMonth() !== m - 1 || dataBase.getUTCDate() !== d
    || h > 23 || min > 59 || sec > 59 || offsetMinutos(offsetOrigem!) === null) {
    return { estado: "PENDENTE", codigo: "INSTANTE_INVALIDO" };
  }
  const instanteMs = Date.parse(instante);
  if (!Number.isFinite(instanteMs)) return { estado: "PENDENTE", codigo: "INSTANTE_INVALIDO" };
  const civilMs = instanteMs + offsetServico * 60_000;
  return { estado: "OK", dataCivil: new Date(civilMs).toISOString().slice(0, 10) };
}
