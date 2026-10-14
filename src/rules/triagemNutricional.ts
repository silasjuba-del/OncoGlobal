// D-F1-33 · Triagem nutricional como SUGESTÃO (nunca pedido nem trava), instrumento NRS-2002 (D-F1-48).
// Pura e offline. Gatilhos decididos: câncer de esôfago, câncer de estômago e IMC < 18.
// Dado ausente nunca vira "sem triagem": o resultado é PENDENTE.

export interface EntradaTriagemNutricional { tumor: string | null | undefined; imc: number | null | undefined }
export type EstadoTriagemNutricional = "SUGERIR" | "NAO_SUGERIR" | "PENDENTE";
export interface ResultadoTriagemNutricional {
  estado: EstadoTriagemNutricional;
  instrumento: "NRS-2002";
  motivos: readonly string[];
  /** Sempre falso: a regra só sugere. */
  bloqueia: false;
}

const IMC_CORTE = 18;
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const GATILHO_TUMOR: ReadonlyArray<readonly [RegExp, string]> = [
  [/\besofag/, "câncer de esôfago"],
  [/\b(estomag|gastric)/, "câncer de estômago"],
];

export function sugerirTriagemNutricional(entrada: EntradaTriagemNutricional): ResultadoTriagemNutricional {
  const motivos: string[] = [];
  const tumor = typeof entrada.tumor === "string" && entrada.tumor.trim() ? semAcento(entrada.tumor) : null;
  const gatilho = tumor === null ? null : GATILHO_TUMOR.find(([re]) => re.test(tumor))?.[1] ?? null;
  if (gatilho) motivos.push(gatilho);
  const imc = typeof entrada.imc === "number" && Number.isFinite(entrada.imc) && entrada.imc > 0 && entrada.imc < 100 ? entrada.imc : null;
  if (imc !== null && imc < IMC_CORTE) motivos.push(`IMC ${imc} < ${IMC_CORTE}`);
  if (motivos.length) return { estado: "SUGERIR", instrumento: "NRS-2002", motivos, bloqueia: false };
  if (tumor === null) return { estado: "PENDENTE", instrumento: "NRS-2002", motivos: ["tumor não informado"], bloqueia: false };
  if (imc === null) return { estado: "PENDENTE", instrumento: "NRS-2002", motivos: ["IMC ausente ou inválido"], bloqueia: false };
  return { estado: "NAO_SUGERIR", instrumento: "NRS-2002", motivos: [], bloqueia: false };
}
