
export type CorElegibilidade = "VERDE" | "VERMELHO" | "PENDENTE";

export type NivelMotivoElegibilidade = "atencao" | "importante" | "contraindicacao";

export type OrigemElegibilidade =
  | "portaCiclo"
  | "triagem"
  | "ctcae"
  | "interacoes"
  | "plaquetas"
  | "funcaoOrganica"
  | "intercorrencia" | "emergencia" | "feve" | "basal" | "condicionais" | "intervalo" | "cumulativo";

export interface MotivoEntradaElegibilidade {
  texto: string;
  /** Nível de interação/alerta. "atencao" corresponde à interação moderada. Qualquer nível torna a entrada VERMELHO. */
  nivel?: NivelMotivoElegibilidade;
}

export interface SinalElegibilidade {
  estado: CorElegibilidade;
  motivos: readonly MotivoEntradaElegibilidade[];
}

export interface EntradasElegibilidadeCiclo {
  portaCiclo: SinalElegibilidade | null;
  triagem: SinalElegibilidade | null;
  ctcae: SinalElegibilidade | null;
  interacoes: SinalElegibilidade | null;
  plaquetas: SinalElegibilidade | null;
  funcaoOrganica: SinalElegibilidade | null;
  /** Opcional: quando não informada, não entra no cruzamento. Quando informada, segue as mesmas regras. */
  intercorrencia?: SinalElegibilidade | null;
  emergencia?: SinalElegibilidade | null;
  feve?: SinalElegibilidade | null;
  basal?: SinalElegibilidade | null;
  condicionais?: SinalElegibilidade | null;
  intervalo?: SinalElegibilidade | null;
  /** Opcional. Só o teto atingido entra, na cor vermelha já existente. Item parcial não usa este farol. */
  cumulativo?: SinalElegibilidade | null;
}

export interface MotivoElegibilidadeCiclo {
  origem: OrigemElegibilidade;
  texto: string;
  nivel?: NivelMotivoElegibilidade;
}

export interface SaidaElegibilidadeCiclo {
  cor: CorElegibilidade;
  motivos: MotivoElegibilidadeCiclo[];
  rotulo: string;
  cobertura?: { avaliadas: number; pendentes: number; total: number };
}
