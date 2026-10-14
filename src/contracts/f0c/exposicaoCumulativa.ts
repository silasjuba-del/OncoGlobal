
export interface LimiteExposicaoCumulativa {
  ativo: boolean;
  regraId: string;
  versao: string;
  droga: string;
  unidade: string;
  maximo: number | null;
  comparador: "GT" | "GTE";
  fonte: string | null;
}
