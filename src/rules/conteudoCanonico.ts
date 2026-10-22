import { createHash } from "node:crypto";
/** Canon v1 persistido: chaves ordenadas, UTF-8; strings (inclusive datas) preservadas literalmente.
 * undefined explícito é null e difere de chave ausente; 1 e 1.0 são o mesmo número JS.
 * Não normalizar o texto assinado nem mudar hashes JSON históricos. Dates usam ISO UTC.
 */
export function hashCanonico(valor: unknown): string {
  return createHash("sha256").update(canon(valor), "utf8").digest("hex");
}

function canon(valor: unknown): string {
  if (valor === null || valor === undefined) return "null";
  if (typeof valor === "string") return JSON.stringify(valor);
  if (typeof valor === "number") return Number.isFinite(valor) ? JSON.stringify(valor) : "null";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (typeof valor === "bigint") return JSON.stringify(valor.toString());
  if (Array.isArray(valor)) return `[${valor.map((item) => canon(item)).join(",")}]`;
  if (valor instanceof Date) {
    if (!Number.isFinite(valor.getTime())) throw new Error("DATA_CANONICA_INVALIDA");
    return JSON.stringify(valor.toISOString());
  }
  if (typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    const chaves = Object.keys(obj).sort();
    return `{${chaves.map((chave) => `${JSON.stringify(chave)}:${canon(obj[chave])}`).join(",")}}`;
  }
  return "null";
}
