import { useState } from "react";
import type { ChavesIntencao } from "../../api/chaves.js";
import type { AcaoIntent, PortaConsulta } from "../../api/porta.js";

/** O médico escreve ou escolhe modelo. Enviar só no clique. Red flag não tem modelo aprovado. */
export function RespostaCanal({
  porta,
  chaves,
  mensagemId,
  patientId,
  redFlag,
}: {
  porta: PortaConsulta;
  chaves: ChavesIntencao;
  mensagemId: string;
  patientId: string | null;
  redFlag: boolean;
}) {
  const [texto, setTexto] = useState("");

  function enviar() {
    const destino = texto.trim();
    if (destino.length === 0) return;
    const intent: AcaoIntent = {
      verbo: "ENVIAR_WHATSAPP",
      objeto: { tipo: "MENSAGEM_CANAL", id: mensagemId, versao: 1 },
      escopo: { patientId, encounterId: null },
      destino,
      idempotencyKey: chaves.novaChaveIntencao(`enviar:${mensagemId}`),
    };
    void porta.acao(intent);
  }

  return (
    <form
      aria-label={redFlag ? "Resposta sem modelo aprovado" : "Resposta do canal"}
      onSubmit={(evento) => {
        evento.preventDefault();
        enviar();
      }}
    >
      {redFlag ? <p>sem modelo aprovado</p> : (
        <button type="button" onClick={() => setTexto("retorno sintético")}>usar modelo</button>
      )}
      <label>
        Resposta
        <textarea aria-label="Texto da resposta" value={texto} onChange={(evento) => setTexto(evento.target.value)} />
      </label>
      <button type="submit">enviar</button>
    </form>
  );
}
