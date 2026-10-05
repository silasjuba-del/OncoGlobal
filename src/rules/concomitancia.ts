/** FN-08 · sobreposição inclusiva de períodos; fim null = em curso até `hoje`. */
export function ehConcomitante(
  qt: { inicio: string; fim: string | null },
  rt: { inicio: string; fim: string | null },
  hoje: string,
): boolean {
  const qFim = qt.fim ?? hoje;
  const rFim = rt.fim ?? hoje;
  return qt.inicio <= rFim && rt.inicio <= qFim;
}
