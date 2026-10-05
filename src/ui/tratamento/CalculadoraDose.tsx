import { useState } from "react";
import type { DoseRuleset, EntradaDose, ReducaoPct } from "../../contracts/regras.js";
import { calcularDose } from "../../rules/index.js";
import { classeSemaforo } from "../tema/temas.js";

const REDUCOES = [20, 30, 40] as const satisfies readonly ReducaoPct[];

function rotuloOrigem(origem: EntradaDose["origemPeso"]): string {
  if (origem === "MEDIDO") return "MEDIDO";
  if (origem === "ANTERIOR") return "ANTERIOR";
  if (origem === "INFORMADO_PACIENTE") return "INFORMADO PELO PACIENTE";
  return "PENDENTE";
}

/** Exibe calcularDose. Não arredonda, não reduz e não inventa base. */
export function CalculadoraDose({
  base,
  ruleset,
}: {
  base: Omit<EntradaDose, "reducaoPct">;
  ruleset: DoseRuleset;
}) {
  const [reducaoPct, setReducaoPct] = useState<ReducaoPct>(0);
  const saida = calcularDose({ ...base, reducaoPct }, ruleset);
  const doseAnterior = base.doseAdministradaAnteriorMg === null
    ? "PENDENTE"
    : `${base.doseAdministradaAnteriorMg} mg`;
  const dose = saida.doseMg === null ? "PENDENTE" : `${saida.doseMg} mg`;

  return (
    <section aria-label="Calculadora de dose" className="cartao pilha">
      <p>Dose do ciclo anterior: {doseAnterior}</p>
      <p>Origem do peso: {rotuloOrigem(base.origemPeso)}</p>
      <p>Ciclos sem peso: {saida.ciclosSemPesoConsecutivos}</p>
      {base.origemPeso === "INFORMADO_PACIENTE" ? <p>diferença incerta — confirme</p> : null}
      <div>
        {REDUCOES.map((r) => (
          <button key={r} type="button" onClick={() => setReducaoPct(r)}>
            −{r}
          </button>
        ))}
      </div>
      <p className={classeSemaforo(saida.estado)}>{saida.estado}</p>
      <p>Dose: {dose}</p>
      <p>{saida.motivo}</p>
    </section>
  );
}
