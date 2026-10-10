/** Identidade lexical explícita. Não infere classe, interação ou segurança clínica. */
export interface CatalogoInteracoes {
  aliases: Readonly<Record<string, readonly string[]>>;
  classes: Readonly<Record<string, readonly string[]>>;
}
export function normalizarIdentidade(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
export function identidadeFarmaco(nome: string, catalogo?: CatalogoInteracoes): string {
  const normal = normalizarIdentidade(nome);
  if (!normal) return "";
  const candidatos = Object.entries(catalogo?.aliases ?? {}).filter(([id, aliases]) =>
    [id, ...aliases].some((alias) => normalizarIdentidade(alias) === normal));
  if (candidatos.length > 1) return ""; // alias ambíguo não identifica uma droga
  return candidatos.length === 1 ? normalizarIdentidade(candidatos[0]![0]) : normal;
}
export function casaTermoFarmaco(termo: string, nome: string, catalogo?: CatalogoInteracoes): boolean {
  const identidade = identidadeFarmaco(nome, catalogo);
  if (!identidade) return false;
  const classe = Object.entries(catalogo?.classes ?? {}).find(([id]) => normalizarIdentidade(id) === normalizarIdentidade(termo));
  if (classe) return classe[1].some((membro) => identidadeFarmaco(membro, catalogo) === identidade);
  return identidadeFarmaco(termo, catalogo) === identidade;
}
export function referenciaComTrecho(fonte: unknown): boolean {
  if (typeof fonte !== "object" || fonte === null) return false;
  const campos = fonte as { referencia?: unknown; trecho?: unknown };
  return [campos.referencia, campos.trecho].every((valor) =>
    typeof valor === "string" && valor.trim().length > 0 && !valor.includes("[VERIFICAR]"));
}
