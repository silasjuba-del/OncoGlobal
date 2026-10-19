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
  destinatario,
  encounterId = null,
}: {
  porta: PortaConsulta;
  chaves: ChavesIntencao;
  mensagemId: string;
  patientId: string | null;
  redFlag: boolean;
  destinatario?: string;
  encounterId?: string | null;
}) {
  const [texto, setTexto] = useState("");
  const [confirmadoMedicamente, setConfirmadoMedicamente] = useState(true);

  function enviar() {
    const corpo = texto.trim();
    if (corpo.length === 0 || !confirmadoMedicamente) return;
    const intent: AcaoIntent = {
      verbo: "ENVIAR_WHATSAPP",
      objeto: { tipo: "MENSAGEM_CANAL", id: mensagemId, versao: 1 },
      escopo: { patientId, encounterId },
      destino: corpo,
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
      {destinatario || patientId ? (
        <small data-contexto-resposta={mensagemId}>
          Destinatário: {destinatario ?? "contato"} · Paciente: {patientId ?? "não vinculado"}
          {encounterId ? ` · Encontro: ${encounterId}` : ""}
        </small>
      ) : null}
      {redFlag ? <p>sem modelo aprovado</p> : (
        <button type="button" onClick={() => setTexto("retorno sintético")}>usar modelo</button>
      )}
      <label>
        Resposta
        <textarea aria-label="Texto da resposta" value={texto} onChange={(evento) => setTexto(evento.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          aria-label="Confirmo destinatário, conteúdo e contexto da resposta"
          checked={confirmadoMedicamente}
          onChange={(e) => setConfirmadoMedicamente(e.target.checked)}
        />
        Confirmo destinatário, conteúdo e contexto
      </label>
      <button type="submit">enviar</button>
    </form>
  );
}
