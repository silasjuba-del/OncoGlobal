export interface DocumentoBundleVisao {
  documentId: string;
  documentVersion: number;
  titulo: string;
  preMarcado: boolean;
  visivel: boolean;
}

/** Lista pré-marcada pelo pack. O médico desmarca. Documento invisível não entra na tela. */
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
