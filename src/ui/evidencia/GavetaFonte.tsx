import type { Fonte } from "../../contracts/base.js";

/** Data clínica e data de captura ficam em campos separados. Captura nunca ocupa o lugar do exame. */
export function GavetaFonte({ fontes }: { fontes: readonly Fonte[] }) {
  if (fontes.length === 0) {
    return (
      <aside aria-label="Fonte" className="gaveta">
        <p>Fonte: PENDENTE</p>
      </aside>
    );
  }
  return (
    <aside aria-label="Fonte" className="gaveta pilha">
      {fontes.map((f) => (
        <article key={f.sourceId}>
          <p>Classe: {f.classe}</p>
          <p data-campo="data-clinica">Data clínica: {f.dataClinica ?? "PENDENTE"}</p>
          <p data-campo="data-captura">Data de captura: {f.dataCaptura}</p>
          <p>Localizador: {f.localizador ?? "PENDENTE"}</p>
        </article>
      ))}
    </aside>
  );
}
