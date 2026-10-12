/** D-W5-01: o relógio do serviço conserva o instante em offset civil explícito. */
export const FUSO_SERVICO = "-03:00";
export function instanteDoServico(data = new Date()): string {
  if (!Number.isFinite(data.getTime())) throw new Error("INSTANTE_INVALIDO");
  return new Date(data.getTime() - 3 * 60 * 60 * 1000).toISOString().replace(/Z$/, FUSO_SERVICO);
}
