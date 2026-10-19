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
  origemCanal = "WHATSAPP_SERVICO",
  exigirCheckboxConfirmacao = false,
}: {
  porta: PortaConsulta;
  chaves: ChavesIntencao;
  mensagemId: string;
  patientId: string | null;
  redFlag: boolean;
  destinatario?: string;
  encounterId?: string | null;
  origemCanal?: "WHATSAPP_SERVICO" | "WHATSAPP_PESSOAL" | "EMAIL" | "TELEFONE";
  exigirCheckboxConfirmacao?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [confirmadoMedicamente, setConfirmadoMedicamente] = useState(false);

  function enviar() {
    const corpo = texto.trim();
    if (corpo.length === 0) return;
    if (exigirCheckboxConfirmacao && !confirmadoMedicamente) return;
    const verbo = origemCanal === "EMAIL" ? "ENVIAR_EMAIL" : "ENVIAR_WHATSAPP";
    const intent: AcaoIntent = {
      verbo,
      objeto: { tipo: "MENSAGEM_CANAL", id: mensagemId, versao: 1 },
      escopo: { patientId, encounterId },
      destino: destinatario ?? corpo,
      idempotencyKey: chaves.novaChaveIntencao(`enviar:${mensagemId}:${corpo}`),
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
        <button type="button" onClick={() => { setTexto("retorno sintético"); setConfirmadoMedicamente(false); }}>usar modelo</button>
      )}
      <label>
        Resposta
        <textarea
          aria-label="Texto da resposta"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setConfirmadoMedicamente(false);
          }}
        />
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
