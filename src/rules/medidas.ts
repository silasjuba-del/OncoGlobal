// Shared pure unit-validation authority for RECIST and morphometry.
export interface EntradaUnidade {
  valor: number | null;
  unidade: "mm" | "cm" | null;
  /** medida anterior da MESMA lesão, em mm: detecta troca cm×mm por fator ~10 */
  anteriorMm?: number | null;
  /** identificação do corte/série (ex.: "série 4, 3 mm") deste e do exame anterior */
  corte?: string | null;
  corteAnterior?: string | null;
}
export interface SaidaUnidade { estado: "OK" | "PENDENTE"; valorMm: number | null; convertido: boolean; motivos: string[] }

export function validarUnidadeMedida(e: EntradaUnidade): SaidaUnidade {
  const motivos: string[] = [];
  if (e.valor === null || !Number.isFinite(e.valor) || e.valor < 0) motivos.push("valor ausente ou inválido");
  if (e.unidade !== "cm" && e.unidade !== "mm") motivos.push("unidade não declarada (cm ou mm): nunca presumida");
  const valorMm = motivos.length === 0 ? Math.round(e.valor! * (e.unidade === "cm" ? 10 : 1) * 1e6) / 1e6 : null;
  if (valorMm !== null && e.anteriorMm !== undefined && e.anteriorMm !== null && e.anteriorMm > 0 && valorMm > 0) {
    const r = valorMm / e.anteriorMm;
    if (r >= 8 || r <= 1 / 8) motivos.push(`variação de ${Math.round(r * 100) / 100}× sobre a medida anterior (${e.anteriorMm} mm): possível troca cm×mm`);
  }
  const c0 = e.corte ?? null, c1 = e.corteAnterior ?? null;
  if (c0 === null || c1 === null) { if (c0 !== c1) motivos.push("corte/série identificado só em um dos exames"); }
  else if (c0.trim().toLowerCase() !== c1.trim().toLowerCase()) motivos.push(`cortes diferentes entre exames (${c1} × ${c0}): medidas não comparáveis`);
  return { estado: motivos.length === 0 ? "OK" : "PENDENTE", valorMm: motivos.length === 0 ? valorMm : null, convertido: e.unidade === "cm" && motivos.length === 0, motivos };
}
