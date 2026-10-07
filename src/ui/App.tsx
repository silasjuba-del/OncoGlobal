import { useCallback, useEffect, useMemo, useState } from "react";
import { criarChaves } from "./api/chaves.js";
import { criarPortaFalsa } from "./api/fake.js";
import type { AgendaVisao } from "./api/porta.js";
import { CartaoCadastro } from "./oncochart/CartaoCadastro.js";
import { CascaOncoChart, type TelaCasca } from "./oncochart/Casca.js";
import type { CabecalhoChart } from "./oncochart/chart-visao.js";
import { PainelClinicoLateral } from "./oncochart/PainelClinicoLateral.js";
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
  const [chart, setChart] = useState<CabecalhoChart | null>(null);
  const onChart = useCallback((proximo: CabecalhoChart | null) => setChart(proximo), []);

  useEffect(() => {
    void porta.agendaDoDia().then(setAgenda);
  }, [porta]);

  function abrir(id: string) {
    setPatientId(id);
    setTela("consulta");
  }

  const pacienteNome =
    chart?.pacienteNome ??
    agenda?.itens.find((item) => item.patientId === patientId)?.nome ??
    null;

  const filaLateral = (agenda?.itens ?? []).map((item, i) => ({
    patientId: item.patientId,
    nome: item.nome,
    horario: item.horario,
    temE1: item.temE1,
    status: (i === 0 ? "agora" : item.temE1 ? "espera" : "espera") as "agora" | "espera" | "feito",
  }));

  return (
    <CascaOncoChart
      tela={tela}
      onTela={setTela}
      pacienteNome={tela === "consulta" ? pacienteNome : null}
      onBuscar={() => setSinalBusca((valor) => valor + 1)}
      lateral={
        tela === "consulta" && chart ? (
          <>
            <CartaoCadastro chart={chart} />
            <PainelClinicoLateral
              exameTitulo="TC abdome sintético"
              resumo="Resumo sintético do exame selecionado"
              laudo="Laudo sintético — trechos na CURSOR-07"
              board={[
                { id: "b1", texto: "Revisar laudo", coluna: "fazer" },
                { id: "b2", texto: "Tumor board", coluna: "discussao" },
                { id: "b3", texto: "Consentimento", coluna: "concluido" },
              ]}
              fila={filaLateral}
              onChamarProximo={() => undefined}
            />
          </>
        ) : null
      }
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
        <TelaConsulta patientId={patientId} porta={porta} chaves={chaves} onChart={onChart} />
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
