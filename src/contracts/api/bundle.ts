
export interface DocumentoBundleVisao {
  draftId?: string;
  conteudo?: unknown;
  conteudoHash?: string;
  documentId: string;
  documentVersion: number;
  titulo: string;
  preMarcado: boolean;
  visivel: boolean;
  /**
   * Decisão Dr. Silas (2026-10-08): só pré-marca o que vem do MODELO SALVO pelo médico para o protocolo/ciclo.
   * Qualquer outra origem (sugestão do sistema, pack sem modelo) nasce desmarcada, mesmo com preMarcado=true.
   */
  origem?: "MODELO_MEDICO" | "SUGESTAO";
}
