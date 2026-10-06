/** Uma chave por intenção do médico. O segundo clique no mesmo botão reusa a chave. */
export interface ChavesIntencao {
  novaChaveIntencao(intencaoId: string): string;
}

export function criarChaves(): ChavesIntencao {
  const porIntencao = new Map<string, string>();
  return {
    novaChaveIntencao(intencaoId: string): string {
      const existente = porIntencao.get(intencaoId);
      if (existente) return existente;
      const chave = crypto.randomUUID();
      porIntencao.set(intencaoId, chave);
      return chave;
    },
  };
}
