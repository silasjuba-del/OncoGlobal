// D-W9-13 · CNS e-SUS/LEDI "Validar CNS". Portaria GM/MS 940/2011.
// O módulo não importa src/apac. DV válido não prova que o número é do paciente.

export type TipoCns = "DEFINITIVO" | "PROVISORIO";
export type ResultadoCns =
  | { valido: true; tipo: TipoCns; aviso: "DV_VALIDO_NAO_PROVA_IDENTIDADE" }
  | { valido: false; motivo: "FORMATO" | "PREFIXO" | "DV" };

export function normalizarCns(entrada: string): string {
  return entrada.replace(/[\s.-]/g, "");
}

/** Dígito verificador do CNS definitivo (início 1/2) a partir dos 11 primeiros dígitos. */
export function calcularCnsDefinitivo(pis11: string): string {
  let soma = 0;
  for (let i = 0; i < 11; i++) soma += Number(pis11[i]) * (15 - i);
  let dv = 11 - (soma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) {
    soma += 2;
    dv = 11 - (soma % 11);
    return `${pis11}001${dv}`;
  }
  return `${pis11}000${dv}`;
}

export function validarCns(entrada: string): ResultadoCns {
  const cns = normalizarCns(entrada);
  if (!/^\d{15}$/.test(cns)) return { valido: false, motivo: "FORMATO" };
  const inicio = cns[0];
  if (inicio === "1" || inicio === "2") {
    return calcularCnsDefinitivo(cns.slice(0, 11)) === cns
      ? { valido: true, tipo: "DEFINITIVO", aviso: "DV_VALIDO_NAO_PROVA_IDENTIDADE" }
      : { valido: false, motivo: "DV" };
  }
  if (inicio === "7" || inicio === "8" || inicio === "9") {
    let soma = 0;
    for (let i = 0; i < 15; i++) soma += Number(cns[i]) * (15 - i);
    return soma % 11 === 0
      ? { valido: true, tipo: "PROVISORIO", aviso: "DV_VALIDO_NAO_PROVA_IDENTIDADE" }
      : { valido: false, motivo: "DV" };
  }
  return { valido: false, motivo: "PREFIXO" };
}
