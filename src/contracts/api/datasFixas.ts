
export type EstadoDataFixa = "PREENCHIDO" | "PENDENTE";

export type MotivoPendencia = "AUSENTE" | "CONFLITO";

export type TipoEstadiamento = "STAGING" | "RESTAGING";

export interface DataFixa {
  /** Data civil YYYY-MM-DD ou null quando PENDENTE. */
  readonly data: string | null;
  readonly estado: EstadoDataFixa;
  readonly motivo: MotivoPendencia | null;
  /** Id do evento-fato que sustenta a data (menor eventId entre os que a sustentam); null quando PENDENTE. */
  readonly fonte: string | null;
  /** Ids dos eventos em conflito; preenchido somente com motivo CONFLITO. */
  readonly fontesConflitantes: readonly string[];
}

export interface DataEstadiamento extends DataFixa {
  readonly tipo: TipoEstadiamento | null;
}

export interface DatasFixas {
  readonly dataReferencia: string;
  readonly biopsyDate: DataFixa;
  readonly c1d1Date: DataFixa;
  readonly lastStagingDate: DataEstadiamento;
  readonly lastRestagingDate: DataFixa;
  readonly lastTreatmentDate: DataFixa;
  /** Dias corridos entre cada data e dataReferencia (dataReferencia - data); null quando a data está PENDENTE. */
  readonly diasDesde: {
    readonly c1d1: number | null;
    readonly lastTreatment: number | null;
    readonly lastRestaging: number | null;
  };
}
