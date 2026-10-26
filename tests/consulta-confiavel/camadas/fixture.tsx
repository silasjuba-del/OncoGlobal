import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Configuracoes } from "../../../src/ui/oncochart/Configuracoes.js";
import { Jornada3D } from "../../../src/ui/oncochart/Jornada3D.js";
import { timelineSintetica } from "../../../src/ui/oncochart/timeline-visao.js";
import { OverlayFlash } from "../../../src/ui/consulta/OverlayFlash.js";
import type { ConsultaFlashProps } from "../../../src/ui/consulta/ConsultaFlash.js";

const flash: ConsultaFlashProps = {
  hoje: "2026-10-05", pacienteNome: "Paciente SINTETICO camadas",
  cabecalho: { diagnostico: "Diagnóstico SINTETICO", tnm: "Não informado", estadio: "Não informado",
    tratamentoAtual: "Não informado", cicloDia: "Não informado", ultimoAdministrado: "Não informado", alergia: "Não informado" },
  exames: [], acoesHoje: [], receitas: [], iaFala: [],
  apac: { cid: "C50", sigtap: "0304050067", finalidade: "ADJUVANTE", competencia: "2026-10", estado: "VALIDA", pendencias: [] },
  retorno: { dias: 21, examesAntesDoRetorno: [] }, aoSalvarRascunho: () => {}, aoFinalizar: () => {},
};

function Fixture() {
  const [camadas, setCamadas] = useState({ jornada: false, configuracoes: false, flash: false });
  const [ancestral, setAncestral] = useState(false);
  const fechar = (nome: keyof typeof camadas) => setCamadas(estado => ({ ...estado, [nome]: false }));
  const abrir = (alto: boolean) => { setAncestral(alto); setCamadas({ jornada: true, configuracoes: true, flash: true }); };
  return <div className="oc-viewport" data-tema-onco="dia" style={{ minHeight: "100vh" }}>
    <button onClick={() => abrir(false)}>Abrir camadas sintéticas</button>
    <button onClick={() => abrir(true)}>Abrir com ancestral alto</button>
    {camadas.jornada ? <div style={ancestral ? { position: "fixed", inset: 0, zIndex: 120 } : undefined}>
      <Jornada3D visao={timelineSintetica("SINTETICO", "2026-10-05")} onFechar={() => fechar("jornada")} />
    </div> : null}
    {camadas.flash ? <OverlayFlash flash={flash} onFechar={() => fechar("flash")} /> : null}
    {camadas.configuracoes ? <Configuracoes tema="dia" onTema={() => {}} onFechar={() => fechar("configuracoes")} /> : null}
  </div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
