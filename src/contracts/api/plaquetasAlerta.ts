
export interface LimiarAlertaPlaquetas {
  ativo: boolean;
  rulesetId: string;
  rulesetVersao: string;
  decisao: string;
  limiarExclusivo: number;
  plausivelMin: number;
  plausivelMax: number;
}

export interface EntradaPlaquetas {
  valor: number | null;
  data: string | null;
}

export interface AlertaPlaquetas {
  tipo: "ALERTA_PLAQUETAS";
  estado: "ALERTA" | "SEM_ALERTA" | "PENDENTE";
  valor: number | null;
  data: string | null;
  limiarExclusivo: number;
  motivo: string;
  regraId: string;
  rulesetVersao: string;
  bloqueiaSalvar: false;
}

export interface GrauCandidatoPlaquetas {
  grau: number | null;
  estado: "PENDENTE";
  confirmadoPeloMedico: false;
  motivo: string;
}

export type ClassificadorPlaquetas = (valor: number | null) => GrauCandidatoPlaquetas;

export type PainelPlaquetas = readonly [AlertaPlaquetas, GrauCandidatoPlaquetas];
