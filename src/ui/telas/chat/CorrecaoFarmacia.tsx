import { useState } from "react";
import type { EstadoFarmacia } from "../../../modules/farmacia/estados.js";

/** A farmácia devolve proposta. Aceitar abre a prescrição; não assina. */
export function CorrecaoFarmacia({
  estado,
  proposta,
  onAceitar,
  onResponder,
}: {
  estado: EstadoFarmacia;
  proposta: string | null;
  onAceitar: () => void;
  onResponder: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  if (estado !== "CORRECAO_PEDIDA" || proposta === null) return null;
  return (
    <section aria-label="Correção da farmácia" className="pilha">
      <p>Proposta: {proposta}</p>
      <p>Estado: {estado}</p>
      <button type="button" onClick={onAceitar}>aceitar</button>
      <label>
        Resposta
        <input aria-label="Resposta à farmácia" value={texto} onChange={(evento) => setTexto(evento.target.value)} />
      </label>
      <button type="button" onClick={() => onResponder(texto)}>responder</button>
    </section>
  );
}
