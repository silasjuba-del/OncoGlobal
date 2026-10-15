// Declarações do conversor ExportacaoConsultaCorpus@1 → PacoteBiblioteca@1 (adendo ao eixo N).
export interface ConversaoBibliotecaResultado {
  destino: string;
  itens: number;
  excluidos: number;
  http: boolean;
}
export interface ConversaoBibliotecaOpcoes {
  mapeamento?: string;
  idPacote?: string;
  versao?: string;
  agora?: string;
}
export declare function converterBiblioteca(
  diretorioSnapshot: string,
  destino: string,
  opcoes?: ConversaoBibliotecaOpcoes,
): Promise<ConversaoBibliotecaResultado>;
