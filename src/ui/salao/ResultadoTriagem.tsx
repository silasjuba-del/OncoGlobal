import type { ResultadoTriagem as Resultado } from "../../contracts/clinico.js";

function Lista({ titulo, itens }: { titulo: string; itens: readonly { codigo: string; texto: string }[] }) {
  return (
    <section aria-label={titulo}>
      <h3>{titulo}</h3>
      {itens.length === 0 ? (
        <p>nenhum</p>
      ) : (
        <ul>
          {itens.map((m) => (
            <li key={m.codigo}>{m.texto}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Mostra a saída de avaliarTriagem. Não recalcula destino nem corte. */
export function ResultadoTriagem({ resultado }: { resultado: Resultado }) {
  return (
    <section aria-label="Resultado da triagem" className="cartao pilha">
      <p>Destino: {resultado.destino}</p>
      <Lista titulo="Cortes" itens={resultado.cortes} />
      <Lista titulo="Não cortes" itens={resultado.naoCortes} />
      <Lista titulo="Pendências" itens={resultado.pendentes} />
      <p>Emergência: {resultado.emergencia ? "sim" : "não"}</p>
    </section>
  );
}
