// Dias civis entre datas "YYYY-MM-DD", âncora UTC (K-10). Sem relógio de parede.
const MS_POR_DIA = 86_400_000;

function utcCivil(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
}

/** `ate - de` em dias civis. Positivo se `ate` é depois de `de`. */
export function diferencaDiasCivis(de: string, ate: string): number {
  return Math.trunc((utcCivil(ate) - utcCivil(de)) / MS_POR_DIA);
}
