import { COPY_PT_BR } from "../copy/pt-BR.js";

const C = COPY_PT_BR.flashRetorno;

export type TarefaRetornoId = "retorno" | "laboratorio" | "imagem";

export type MarcacaoTarefasRetorno = Readonly<Record<TarefaRetornoId, boolean>>;

/** Cartão "Tarefas do retorno". Controlado: não executa nada, só mostra e alterna marcações. */
export function TarefasRetorno({
  prazoDias,
  marcadas,
  modeloPadraoSalvo,
  onAlternar,
}: {
  prazoDias: number | null;
  marcadas: MarcacaoTarefasRetorno;
  modeloPadraoSalvo: boolean;
  onAlternar: (id: TarefaRetornoId) => void;
}) {
  const rotuloRetorno = prazoDias === null ? C.retorno : `${C.retorno} (${prazoDias} dias)`;
  const linhas: readonly { id: TarefaRetornoId; rotulo: string }[] = [
    { id: "retorno", rotulo: rotuloRetorno },
    { id: "laboratorio", rotulo: C.laboratorio },
    { id: "imagem", rotulo: C.imagem },
  ];
  return (
    <fieldset aria-label={C.tituloTarefas}>
      <legend>{C.tituloTarefas}</legend>
      {modeloPadraoSalvo ? null : <p role="note">{C.semModeloPadrao}</p>}
      <ul>
        {linhas.map((l) => (
          <li key={l.id}>
            <label>
              <input type="checkbox" checked={marcadas[l.id]} onChange={() => onAlternar(l.id)} />
              {l.rotulo}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
