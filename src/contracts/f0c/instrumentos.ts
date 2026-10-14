export type InstrumentoId = "KPS" | "CHILD_PUGH" | "ALBI" | "KHORANA" | "G8";
export interface RegraInstrumento {
  id: InstrumentoId;
  versao: string;
  ativo: boolean;
  fonte: { referencia: string; conferidoEm: string };
}
export interface ContextoInstrumento {
  /** Aplicabilidade confirmada pelo médico para a população/versão da fonte. */
  aplicavel: boolean | null;
  fonteDados: string | null;
}
export interface MedidaInstrumento { valor: number | null; unidade: string | null; fonte: string | null }
export interface ResultadoInstrumento {
  instrumento: InstrumentoId;
  estado: "CALCULADO" | "PENDENTE" | "NAO_APLICAVEL";
  escore: number | null;
  classificacao: string | null;
  parcelas: Readonly<Record<string, number>>;
  pendencias: string[];
  regraVersao: string | null;
  fonteRegra: string | null;
  fonteDados: string | null;
  condutaAutomatica: false;
  consultaSegue: true;
}
export interface EntradaKps extends ContextoInstrumento { kpsDocumentado: number | null }
export interface EntradaChildPugh extends ContextoInstrumento {
  bilirrubina: MedidaInstrumento;
  albumina: MedidaInstrumento;
  inr: MedidaInstrumento;
  ascite: "AUSENTE" | "RESPONSIVA_DIURETICO" | "REFRATARIA" | null;
  encefalopatia: "AUSENTE" | "GRAU_1_2" | "GRAU_3_4" | null;
}
export interface EntradaAlbi extends ContextoInstrumento { bilirrubina: MedidaInstrumento; albumina: MedidaInstrumento }
export type SitioKhorana = "ESTOMAGO" | "PANCREAS" | "PULMAO" | "LINFOMA" | "GINECOLOGICO" | "BEXIGA" | "TESTICULO" | "OUTRO";
export interface EntradaKhorana extends ContextoInstrumento {
  sitio: SitioKhorana | null;
  plaquetas: MedidaInstrumento;
  hemoglobina: MedidaInstrumento;
  leucocitos: MedidaInstrumento;
  imc: MedidaInstrumento;
  usaEstimulanteEritropoiese: boolean | null;
}
export interface EntradaG8 extends ContextoInstrumento {
  ingestao3Meses: "REDUCAO_GRAVE" | "REDUCAO_MODERADA" | "SEM_REDUCAO" | null;
  perdaPeso3Meses: "MAIS_3_KG" | "NAO_SABE" | "ENTRE_1_3_KG" | "SEM_PERDA" | null;
  mobilidade: "LEITO_CADEIRA" | "SAI_LEITO_NAO_CASA" | "SAI_CASA" | null;
  neuropsicologico: "DEMENCIA_OU_DEPRESSAO_GRAVE" | "LEVE" | "AUSENTE" | null;
  imc: MedidaInstrumento;
  medicamentosPorDia: number | null;
  autoavaliacaoSaude: "PIOR" | "NAO_SABE" | "IGUAL" | "MELHOR" | null;
  idadeAnos: number | null;
}
