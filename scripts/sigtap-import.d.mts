// Tipos para scripts/sigtap-import.mjs (GLM-09) — permite import tipado nos testes TS.
export interface MapeamentoSigtap {
  separador?: string;
  primeiraLinhaCabecalho?: boolean;
  colunas: Record<string, number>;
}
export interface SigtapImportado {
  competencia: string;
  procedimentos: Array<Record<string, string>>;
}
export function parseSigtapCsv(texto: string, competencia: string, mapeamento: MapeamentoSigtap): SigtapImportado;
