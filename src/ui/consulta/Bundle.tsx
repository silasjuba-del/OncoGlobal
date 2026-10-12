import type { DocumentoBundleVisao } from '../../contracts/api/bundle.js';
export type { DocumentoBundleVisao } from '../../contracts/api/bundle.js';


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
