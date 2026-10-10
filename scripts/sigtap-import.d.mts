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
export interface ProcedimentoOficialImportado {
  codigo: string; nome: string; sexo: 'M' | 'F' | 'AMBOS' | null;
  idadeMinMeses: null; idadeMaxMeses: null; idadeMinimaOriginal: string; idadeMaximaOriginal: string;
  cidsCompativeis: string[]; finalidadeDoGrupo: null; modalidade: 'QT';
  financiamentoCodigo: string; financiamentoNome: string; valorSaCentavos: number; instrumentosRegistro: string[];
}
export function parseSigtapOficial(arquivos: Record<string,string>, competencia: string): {competencia:string;procedimentos:ProcedimentoOficialImportado[]};
