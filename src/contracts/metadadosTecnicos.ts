/** Chaves reservadas explícitas. Substrings como "indice" e "hash" também aparecem em dados clínicos. */
export function ehMetadadoTecnico(campo: string): boolean {
  return ["auditoria","reconciliacao","indice_itens_legados","hash","hashsha256"].includes(campo.trim().toLowerCase());
}
