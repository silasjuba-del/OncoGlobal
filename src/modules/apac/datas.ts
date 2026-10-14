// Datas civis puras (YYYY-MM-DD). Sem fuso: o chamador injeta "hoje" já resolvido (-03:00).
export function parseData(d: string): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!mt) return null;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const dia = Number(mt[3]);
  const t = new Date(Date.UTC(y, m - 1, dia));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== dia) return null;
  return { y, m, d: dia };
}

export function diasEntre(de: string, ate: string): number | null {
  const a = parseData(de);
  const b = parseData(ate);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export function idadeEmMeses(nascimento: string, ref: string): number | null {
  const a = parseData(nascimento);
  const b = parseData(ref);
  if (!a || !b) return null;
  return (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
}
