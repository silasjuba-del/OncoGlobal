import { useState } from "react";
import { classeSemaforo } from "../tema/temas.js";

export type AbaLateral = "cadastro" | "exame" | "board" | "fila";

export interface ItemFilaLateral {
  patientId: string;
  nome: string;
  horario: string;
  temE1: boolean;
  status: "agora" | "espera" | "feito";
}

export interface ItemBoard {
  id: string;
  texto: string;
  coluna: "fazer" | "discussao" | "concluido";
}

/** Miolo clínico do painel 396 px (CURSOR-06). Cadastro continua slot separado. */
export function PainelClinicoLateral({
  exameTitulo,
  resumo,
  laudo,
  board,
  fila,
  onChamarProximo,
}: {
  exameTitulo: string | null;
  resumo: string | null;
  laudo: string | null;
  board: readonly ItemBoard[];
  fila: readonly ItemFilaLateral[];
  onChamarProximo: () => void;
}) {
  const [aba, setAba] = useState<AbaLateral>("exame");
  const [exameTab, setExameTab] = useState<"resumo" | "laudo" | "imagens">("resumo");
  const [chamado, setChamado] = useState<string | null>(null);

  return (
    <section className="oc-painel-clinico" aria-label="Painel clínico lateral">
      <div className="oc-side-tabs" role="tablist" aria-label="Seções do painel">
        {(
          [
            ["exame", "Exame"],
            ["board", "OncoBoard"],
            ["fila", "Fila"],
            ["cadastro", "Cadastro"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "exame" ? (
        <div role="tabpanel" aria-label="Exame selecionado">
          <h3>{exameTitulo ?? "Exame PENDENTE"}</h3>
          <div className="oc-exame-tabs" role="tablist">
            {(["resumo", "laudo", "imagens"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={exameTab === t}
                onClick={() => setExameTab(t)}
              >
                {t === "resumo" ? "Resumo" : t === "laudo" ? "Laudo" : "Imagens"}
              </button>
            ))}
          </div>
          {exameTab === "resumo" ? (
            <p>{resumo ?? "PENDENTE"}</p>
          ) : null}
          {exameTab === "laudo" ? (
            <p className="oc-laudo-txt">{laudo ?? "PENDENTE"}</p>
          ) : null}
          {exameTab === "imagens" ? (
            <p className={classeSemaforo("PENDENTE")}>miniaturas PENDENTE</p>
          ) : null}
        </div>
      ) : null}

      {aba === "board" ? (
        <div role="tabpanel" aria-label="OncoBoard">
          {(["fazer", "discussao", "concluido"] as const).map((col) => (
            <div key={col} className="oc-board-col" data-coluna={col}>
              <h4>
                {col === "fazer" ? "A fazer" : col === "discussao" ? "Em discussão" : "Concluído"}
              </h4>
              <ul>
                {board
                  .filter((i) => i.coluna === col)
                  .map((i) => (
                    <li key={i.id}>{i.texto}</li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {aba === "fila" ? (
        <div role="tabpanel" aria-label="Fila do dia">
          <button
            type="button"
            className="oc-btn-primary"
            onClick={() => {
              const prox = fila.find((f) => f.status === "espera");
              setChamado(prox?.nome ?? null);
              onChamarProximo();
            }}
          >
            Chamar próximo
          </button>
          {chamado ? <p role="status">chamou: {chamado}</p> : null}
          <ol className="oc-fila" aria-label="Ordem da fila">
            {fila.map((f) => (
              <li key={f.patientId} data-patient={f.patientId} data-status={f.status}>
                <span>{f.horario}</span> {f.nome}
                {f.temE1 ? (
                  <span className={`oc-chip oc-chip-danger ${classeSemaforo("VERMELHO")}`} data-badge="E1">
                    E1
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {aba === "cadastro" ? (
        <div role="tabpanel" aria-label="Slot cadastro">
          <p className="oc-muted">Cartão Modelo 08 acima / ao lado deste painel.</p>
        </div>
      ) : null}
    </section>
  );
}
