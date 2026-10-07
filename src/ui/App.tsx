import { useEffect, useMemo, useState } from "react";
import { criarChaves } from "./api/chaves.js";
import { criarPortaFalsa } from "./api/fake.js";
import type { AgendaVisao } from "./api/porta.js";
import { CascaOncoChart, type TelaCasca } from "./oncochart/Casca.js";
import { Agenda } from "./telas/Agenda.js";
import { BarraComando } from "./telas/BarraComando.js";
import { TelaConsulta } from "./telas/TelaConsulta.js";
import { TelaApacLote } from "./telas/apac/TelaApacLote.js";
import { CaixaCanal } from "./telas/canal/CaixaCanal.js";
import { TelaSalao } from "./telas/TelaSalao.js";

function clicarBotao(nome: string) {
  const botao = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === nome);
  botao?.click();
}

/** Casca OncoChart em volta das telas já ligadas. A porta continua falsa até as rotas reais. */
export function App() {
  const porta = useMemo(() => criarPortaFalsa(), []);
  const chaves = useMemo(() => criarChaves(), []);
  const [tela, setTela] = useState<TelaCasca>("agenda");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaVisao | null>(null);
  const [sinalBusca, setSinalBusca] = useState(0);

  useEffect(() => {
    void porta.agendaDoDia().then(setAgenda);
  }, [porta]);

  function abrir(id: string) {
    setPatientId(id);
    setTela("consulta");
  }

  const pacienteNome = agenda?.itens.find((item) => item.patientId === patientId)?.nome ?? null;

  return (
    <CascaOncoChart
      tela={tela}
      onTela={setTela}
      pacienteNome={tela === "consulta" ? pacienteNome : null}
      onBuscar={() => setSinalBusca((valor) => valor + 1)}
      comandos={
        agenda ? (
          <BarraComando
            className="oc-comandos"
            ocultarGatilho
            sinalAbrir={sinalBusca}
            pacientes={agenda.itens.map((item) => ({
              patientId: item.patientId,
              nome: item.nome,
              prontuario: item.prontuario,
            }))}
            ordemIds={agenda.itens.map((item) => item.patientId)}
            pacienteAbertoId={patientId}
            onAbrir={abrir}
            onValidarTudo={() => clicarBotao("validar tudo")}
            onImprimir={() => clicarBotao("imprimir")}
            onNovaTriagem={() => setTela("salao")}
            onSalao={() => setTela("salao")}
            onApac={() => setTela("apac")}
            onCanal={() => setTela("canal")}
          />
        ) : null
      }
    >
      {!agenda ? <p>carregando agenda</p> : null}
      {tela === "agenda" && agenda ? <Agenda visao={agenda} onAbrir={abrir} /> : null}
      {tela === "consulta" && patientId ? (
        <TelaConsulta patientId={patientId} porta={porta} chaves={chaves} />
      ) : null}
      {tela === "consulta" && !patientId ? (
        <section aria-label="Consulta">
          <p>nenhum paciente aberto</p>
        </section>
      ) : null}
      {tela === "salao" ? <TelaSalao porta={porta} /> : null}
      {tela === "canal" ? <CaixaCanal porta={porta} chaves={chaves} /> : null}
      {tela === "apac" ? <TelaApacLote porta={porta} chaves={chaves} /> : null}
    </CascaOncoChart>
  );
}
