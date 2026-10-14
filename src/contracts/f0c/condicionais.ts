export interface DadoCondicional<T> { valor: T | null; fonte: string | null }
export interface MedidaCondicional extends DadoCondicional<number> { unidade: string | null; coletadoEm?: string | null }
export interface ExameHepatico extends MedidaCondicional { limiteSuperiorNormal: number | null }
export type TipoCondicional = "DPYD" | "ALERGIA" | "GESTACAO" | "DOCETAXEL_HEPATICO" | "IRINOTECANO_HEPATICO"
  | "BEVACIZUMABE_PA" | "BEVACIZUMABE_PROTEINURIA" | "BEVACIZUMABE_CIRURGIA";
export interface RegraCondicional {
  id: string; versao: string; tipo: TipoCondicional; ativo: boolean;
  drogas: readonly string[];
  alergenos?: readonly string[];
  parametros?: Readonly<Record<string, number>>;
  fonte: { tipo: "LITERATURA"; referencia: string; trecho: string; conferidoEm: string };
}
export interface AlergiaCondicional { agente: string; presente: boolean | null; fonte: string | null }
export interface EntradaCondicionais {
  programados: readonly string[] | null;
  hoje: string;
  /** Relógio do servidor; nunca recebido do FATO clínico. */
  agora?: string;
  dpyd?: DadoCondicional<"SEM_DEFICIENCIA_IDENTIFICADA" | "DEFICIENCIA_PARCIAL" | "DEFICIENCIA_COMPLETA" | "DESCONHECIDO">;
  alergias?: { lista: readonly AlergiaCondicional[]; historicoConferido: boolean | null; fonte: string | null };
  gestacao?: { aplicavel: boolean | null; resultado: DadoCondicional<boolean> };
  hepaticos?: { bilirrubina: ExameHepatico; ast: ExameHepatico; alt: ExameHepatico; fosfataseAlcalina: ExameHepatico;
    metastaseHepatica: DadoCondicional<boolean> };
  hipertensaoGraveNaoControlada?: DadoCondicional<boolean>;
  proteinuria?: MedidaCondicional;
  sindromeNefrotica?: DadoCondicional<boolean>;
  cirurgia?: { historicoEAgendaConferidos: boolean | null; ultimaCirurgiaMaior: string | null;
    proximaCirurgiaEletiva: string | null; cicatrizacaoAdequada: boolean | null; fonte: string | null };
}
export interface ResultadoCondicional {
  regraId: string; tipo: TipoCondicional; estado: "AVISO" | "PENDENTE" | "SEM_AVISO" | "NAO_APLICAVEL";
  drogas: string[]; motivos: string[]; pendencias: string[]; fontesDados: string[];
  fonteRegra: string; regraVersao: string; acao: "REVISAO_MEDICA" | null;
  bloqueiaConsulta: false; autorizaCiclo: false; ajustaDose: false;
}
export type TermoToxicidadeComplementar = "MAO_PE" | "REACAO_INFUSIONAL";
export interface EvidenciaToxicidadeComplementar {
  termo: TermoToxicidadeComplementar; presente: boolean | null; evidencia: string | null; fonte: string | null;
  ctcaeVersao: string | null;
  grauDocumentado?: number | null;
}
export interface RegraTermoComplementar {
  id: TermoToxicidadeComplementar; ativo: boolean; ctcaeVersao: string; nomeCtcae: string;
  grausDisponiveis: readonly number[];
  fonte: { tipo: "LITERATURA"; referencia: string; trecho: string; conferidoEm: string };
}
