/** Preferência só de aparência. Dado clínico não entra aqui. */
const CHAVE = "onco.theme.v2";

export type TemaOnco = "noite" | "dia";

export function lerTemaOnco(): TemaOnco {
  try {
    const valor = localStorage.getItem(CHAVE);
    if (valor === "dia" || valor === "noite") return valor;
  } catch {
    /* preferência de UI indisponível */
  }
  return "noite";
}

export function gravarTemaOnco(tema: TemaOnco): void {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    /* preferência de UI indisponível */
  }
}

export function temaOposto(tema: TemaOnco): TemaOnco {
  return tema === "noite" ? "dia" : "noite";
}
