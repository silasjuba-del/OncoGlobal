
export const ESTADOS_FARMACIA = ["ENVIADA", "CONFERIDA", "CORRECAO_PEDIDA", "ACEITA"] as const;

export type EstadoFarmacia = (typeof ESTADOS_FARMACIA)[number];

export type AcaoFarmacia = "CONFERIR" | "PEDIR_CORRECAO" | "EDITAR" | "ACEITAR" | "RECUSAR";

export type AtorFarmacia = "FARMACIA" | "MEDICO";

export interface EventoFarmacia {
  ator: AtorFarmacia;
  acao: AcaoFarmacia;
  estadoResultante: EstadoFarmacia;
  motivo: string | null;
}

export interface RegistroFarmacia {
  conteudoPrescricaoId: string;
  estado: EstadoFarmacia;
  historico: EventoFarmacia[];
}

export type PedidoFarmacia =
  | { ator: "FARMACIA"; acao: "CONFERIR" }
  | { ator: "FARMACIA"; acao: "PEDIR_CORRECAO"; motivo: string }
  | { ator: "FARMACIA"; acao: "EDITAR"; campo: string }
  | { ator: "MEDICO"; acao: "ACEITAR" }
  | { ator: "MEDICO"; acao: "RECUSAR" };

export interface ErroFarmacia {
  codigo: "TRANSICAO_INVALIDA" | "FARMACIA_NAO_EDITA";
  mensagem: string;
}

export interface ResultadoFarmacia {
  ok: boolean;
  registro: RegistroFarmacia;
  erro: ErroFarmacia | null;
  bloqueiaMedico: false;
}
