import { useEffect, useState } from "react";
import type { PortaConsulta, SalaoVisao } from "../api/porta.js";
import { FormTriagem } from "../salao/FormTriagem.js";
import { QuadroSalao } from "../salao/QuadroSalao.js";

/** Triagem à esquerda, quadro à direita. A ordem continua sendo a de ordenarFila. */
export function TelaSalao({ porta }: { porta: PortaConsulta }) {
  const [visao, setVisao] = useState<SalaoVisao | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  useEffect(() => {
    let viva = true;
    porta.filaSalao().then((proxima) => {
      if (!viva) return;
      setVisao(proxima);
      setPatientId((atual) => atual ?? proxima.pacientes[0]?.patientId ?? null);
    });
    return () => {
      viva = false;
    };
  }, [porta]);

  if (!visao) return <p>carregando salão</p>;
  const escolhido = visao.pacientes.find((p) => p.patientId === patientId) ?? visao.pacientes[0];
  if (!escolhido) return <p>salão vazio</p>;

  return (
    <section aria-label="Salão" className="pilha">
      <label>
        Paciente em triagem
        <select
          aria-label="Paciente em triagem"
          value={escolhido.patientId}
          onChange={(evento) => setPatientId(evento.target.value)}
        >
          {visao.pacientes.map((paciente) => (
            <option key={paciente.patientId} value={paciente.patientId}>
              {paciente.nome} {paciente.patientId}
            </option>
          ))}
        </select>
      </label>
      <div className="colunas">
        <FormTriagem
          patientId={escolhido.patientId}
          encounterId={escolhido.encounterId}
          chegadaEm={escolhido.chegadaEm}
          ruleset={visao.ruleset}
          contexto={visao.contexto}
          fonte={visao.fonte}
          onSalvar={(triagem) => {
            void porta.salvarTriagem(triagem).then(setVisao);
          }}
        />
        <QuadroSalao
          cartoes={visao.cartoes}
          ruleset={visao.ruleset}
          onLiberarComCorte={(id, motivo) => {
            void porta.liberarComCorte(id, motivo).then(setVisao);
          }}
        />
      </div>
      <section aria-label="Decisões do médico">
        <h2>Decisões do médico</h2>
        {visao.decisoes.length === 0 ? (
          <p>nenhuma decisão registrada</p>
        ) : (
          <ul>
            {visao.decisoes.map((decisao) => (
              <li key={`${decisao.patientId}-${decisao.motivo}`}>{decisao.motivo}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
