import { useState } from "react";
import { classeSemaforo } from "../tema/temas.js";
import type { AgendaVisao, ItemAgendaVisao } from "../api/porta.js";
import { proximoPaciente } from "./comandos.js";

function Linha({ item, onAbrir }: { item: ItemAgendaVisao; onAbrir: (patientId: string) => void }) {
  return (
    <li data-patient={item.patientId}>
      <button type="button" onClick={() => onAbrir(item.patientId)}>
        abrir {item.nome} {item.prontuario}
      </button>
      <p>{item.horario}</p>
      <p className={classeSemaforo(item.semaforo)} data-semaforo={item.semaforo}>{item.semaforo}</p>
      <p>◐ {item.pendentes} pendentes</p>
      <p>pré-consulta pronta: {item.preConsultaPronta ? "sim" : "não"}</p>
      <p>contatos desde a última consulta: {item.contatosDesdeUltima}</p>
      {item.temE1 ? <p>E1</p> : null}
    </li>
  );
}

/** Mostra a agenda na ordem da porta. Não calcula prioridade. */
export function Agenda({
  visao,
  onAbrir,
}: {
  visao: AgendaVisao;
  onAbrir: (patientId: string) => void;
}) {
  const [atual, setAtual] = useState<string | null>(null);
  const ordem = visao.itens.map((item) => item.patientId);

  function abrir(patientId: string) {
    setAtual(patientId);
    onAbrir(patientId);
  }

  return (
    <section aria-label="Agenda do dia" className="pilha">
      <h1>Agenda do dia</h1>
      <button
        type="button"
        onClick={() => {
          const seguinte = proximoPaciente(ordem, atual);
          if (seguinte) abrir(seguinte);
        }}
      >
        próximo paciente
      </button>
      <ol>
        {visao.itens.map((item) => (
          <Linha key={item.patientId} item={item} onAbrir={abrir} />
        ))}
      </ol>
    </section>
  );
}
