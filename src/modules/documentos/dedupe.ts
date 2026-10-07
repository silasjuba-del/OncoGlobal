// Caso 07 · D1–D3. Chave = laboratório + nº do exame + data de entrada.
// A data impressa no topo e a data de extração não entram. src/rules/w8/dedupeExame.ts não foi editado.

import rulesetDedupe from "../../../corpus/rulesets/dedupe-exame.v1.json" with { type: "json" };

export interface ResultadoDedupe {
  unicos: number;
  duplicatas: { paginas: string[] }[];
}

interface ChaveRuleset {
  id?: unknown;
  campos?: unknown;
  nuncaUsar?: unknown;
}

function camposDoRuleset(): readonly string[] {
  const json = rulesetDedupe as { chaves?: unknown };
  if (!Array.isArray(json.chaves)) throw new Error("chaves de dedupe ausentes");
  const patologia = json.chaves.find((item) => {
    const chave = item as ChaveRuleset;
    return chave.id === "patologia-ihq";
  }) as ChaveRuleset | undefined;
  const campos = patologia?.campos;
  if (!Array.isArray(campos) || campos.length === 0 || campos.some((c) => typeof c !== "string" || c.trim() === "")) {
    throw new Error("campos da chave patologia-ihq ausentes");
  }
  return campos as string[];
}

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toLowerCase();
  return limpo.length === 0 ? null : limpo;
}

function chaveDe(item: Record<string, unknown>, campos: readonly string[], indice: number): string {
  const partes: string[] = [];
  for (const campo of campos) {
    const valor = texto(item[campo]);
    if (valor === null) return `pendente:${indice}`;
    partes.push(valor);
  }
  return partes.join("\u001f");
}

export function deduplicarExames(
  paginas: readonly unknown[],
  campos: readonly string[] = camposDoRuleset(),
): ResultadoDedupe {
  if (!Array.isArray(paginas)) throw new Error("páginas ausentes");
  if (campos.length === 0) throw new Error("campos da chave ausentes");
  const grupos = new Map<string, string[]>();
  paginas.forEach((item, indice) => {
    const bruto = typeof item === "object" && item !== null && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const id = texto(bruto.arquivo) ?? texto(bruto.id) ?? String(indice);
    const chave = chaveDe(bruto, campos, indice);
    const lista = grupos.get(chave) ?? [];
    lista.push(id);
    grupos.set(chave, lista);
  });
  const duplicatas: { paginas: string[] }[] = [];
  for (const paginasDoExame of grupos.values()) {
    if (paginasDoExame.length > 1) duplicatas.push({ paginas: paginasDoExame });
  }
  return { unicos: grupos.size, duplicatas };
}
