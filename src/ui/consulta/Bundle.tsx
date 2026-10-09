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

/** Marcação inicial: pré-marca apenas documento do modelo salvo pelo médico. */
export function marcadoInicialmente(d: DocumentoBundleVisao): boolean {
  return d.preMarcado && d.origem === "MODELO_MEDICO";
}

/** Lista pré-marcada pelo modelo do médico. O médico desmarca. Documento invisível não entra na tela. */
export function Bundle({
  documentos,
  marcados,
  onAlternar,
}: {
  documentos: readonly DocumentoBundleVisao[];
  marcados: Readonly<Record<string, boolean>>;
  onAlternar: (documentId: string) => void;
}) {
  const visiveis = documentos.filter((d) => d.visivel);
  return (
    <fieldset>
      <legend>Documentos do bundle</legend>
      {visiveis.length === 0 ? (
        <p>nenhum documento exibido</p>
      ) : (
        <ul>
          {visiveis.map((d) => (
            <li key={d.documentId}>
              <label>
                <input
                  type="checkbox"
                  checked={marcados[d.documentId] === true}
                  onChange={() => onAlternar(d.documentId)}
                />
                {d.titulo} v{d.documentVersion}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
