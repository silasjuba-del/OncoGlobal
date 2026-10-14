// D-F1-33 · Triagem nutricional como SUGESTÃO (nunca pedido nem trava), instrumento NRS-2002 (D-F1-48).
// Pura e offline. Gatilhos decididos: câncer de esôfago, câncer de estômago e IMC < 18.
// Dado ausente nunca vira "sem triagem": o resultado é PENDENTE.

export interface EntradaTriagemNutricional {
  tumor: string | null | undefined;
  imc: number | null | undefined;
  /** CID-10 do lote, quando confirmado: C15 = esôfago, C16 = estômago (classificação, não decisão clínica nova). */
  cid?: string | null | undefined;
}
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
const GATILHO_CID: ReadonlyArray<readonly [RegExp, string]> = [
  [/^C15/, "câncer de esôfago"],
  [/^C16/, "câncer de estômago"],
];

/** IMC = peso (kg) / altura (m)², SEM arredondar: o corte < 18 compara o valor real. Ausente ou inválido ⇒ null (nunca 0). */
export function imcDeMedidas(pesoKg: number | null | undefined, alturaCm: number | null | undefined): number | null {
  if (typeof pesoKg !== "number" || typeof alturaCm !== "number" || !Number.isFinite(pesoKg) || !Number.isFinite(alturaCm)
    || pesoKg <= 0 || alturaCm <= 0) return null;
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

/** Só para exibir: trunca em uma casa (17,96 → 17,9), para o texto nunca mostrar valor ≥ corte quando o real está abaixo. */
const imcExibido = (imc: number): number => Math.floor(imc * 10 + 1e-9) / 10;

export function sugerirTriagemNutricional(entrada: EntradaTriagemNutricional): ResultadoTriagemNutricional {
  const motivos: string[] = [];
  const tumor = typeof entrada.tumor === "string" && entrada.tumor.trim() ? semAcento(entrada.tumor) : null;
  const cid = typeof entrada.cid === "string" && entrada.cid.trim() ? entrada.cid.trim().toUpperCase() : null;
  const porTumor = tumor === null ? undefined : GATILHO_TUMOR.find(([re]) => re.test(tumor))?.[1];
  const porCid = cid === null ? undefined : GATILHO_CID.find(([re]) => re.test(cid))?.[1];
  const gatilho = porTumor ?? porCid ?? null;
  if (gatilho) motivos.push(gatilho);
  const imc = typeof entrada.imc === "number" && Number.isFinite(entrada.imc) && entrada.imc > 0 && entrada.imc < 100 ? entrada.imc : null;
  if (imc !== null && imc < IMC_CORTE) motivos.push(`IMC ${imcExibido(imc)} < ${IMC_CORTE}`);
  if (motivos.length) return { estado: "SUGERIR", instrumento: "NRS-2002", motivos, bloqueia: false };
  if (tumor === null && cid === null) return { estado: "PENDENTE", instrumento: "NRS-2002", motivos: ["tumor não informado"], bloqueia: false };
  if (imc === null) return { estado: "PENDENTE", instrumento: "NRS-2002", motivos: ["IMC ausente ou inválido"], bloqueia: false };
  return { estado: "NAO_SUGERIR", instrumento: "NRS-2002", motivos: [], bloqueia: false };
}

/** Texto da Flash: só SUGERIR vira linha; PENDENTE/NAO_SUGERIR não poluem a revisão rápida. Nunca é pedido. */
export function textoSugestaoNutricional(r: ResultadoTriagemNutricional): string | null {
  return r.estado === "SUGERIR" ? `Sugestão: triagem nutricional (${r.instrumento}) — ${r.motivos.join("; ")}` : null;
}
