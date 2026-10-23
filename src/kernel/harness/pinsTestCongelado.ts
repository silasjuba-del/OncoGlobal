/**
 * Hashes congelados revisados no código, fora do pedido de avaliação.
 * Só a suíte sintética de demonstração está admitida. Novas versões exigem
 * inclusão explícita neste registro; o hash recebido do avaliador não é autoridade.
 */
const pinsPorSuite: Readonly<Record<string, string>> = Object.freeze({
  "suite-sintetica@1.0.0|ctrl@1.0.0": "add365d68822df73dd06cb21af5805dbe8f857066bc8d37a32e2726813896301",
});

export function hashTestCongeladoPinado(versaoSuite: string, versaoControles: string): string | null {
  return pinsPorSuite[`${versaoSuite}|${versaoControles}`] ?? null;
}
