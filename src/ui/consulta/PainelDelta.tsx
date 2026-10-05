import type { DeltaDirecao, DeltaKind, Semaforo } from "../../contracts/estados.js";
import { classeSemaforo } from "../tema/temas.js";

/** Visão de um item do delta. `direcao` só existe quando a regra clínica a trouxe (K-17). */
export interface ItemDeltaVisao {
  id: string;
  rotulo: string;
  kind: DeltaKind;
  estado: Semaforo;
  direcao?: DeltaDirecao;
  candidatos?: readonly { rotulo: string; valorTexto: string }[];
}

function seta(direcao: DeltaDirecao): string {
  return direcao === "MELHOR" ? "↑ MELHOR" : "↓ PIOR";
}

export function PainelDelta({
  temSnapshotAnterior,
  itens,
}: {
  temSnapshotAnterior: boolean;
  itens: readonly ItemDeltaVisao[];
}) {
  return (
    <section aria-label="Desde a última consulta" className="cartao pilha">
      <h2>Desde a última consulta</h2>
      {temSnapshotAnterior ? (
        <ul>
          {itens.map((item) => (
            <li key={item.id} data-kind={item.kind}>
              <p>{item.rotulo}</p>
              <p>{item.kind}</p>
              <p className={classeSemaforo(item.estado)}>{item.estado}</p>
              {item.direcao ? <p>{seta(item.direcao)}</p> : null}
              {item.estado === "VERMELHO" && item.candidatos && item.candidatos.length > 0 ? (
                <ul aria-label={`candidatos de ${item.rotulo}`}>
                  {item.candidatos.map((c) => (
                    <li key={`${item.id}-${c.rotulo}`}>
                      {c.rotulo}: {c.valorTexto}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>linha de base em construção</p>
      )}
    </section>
  );
}
