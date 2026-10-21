import { parseData } from "../../rules/datas.js";
export { parseData, diferencaDiasCivis as diasEntre } from "../../rules/datas.js";

export function idadeEmMeses(nascimento: string, ref: string): number | null {
  const a = parseData(nascimento);
  const b = parseData(ref);
  if (!a || !b) return null;
  return (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
}
