import { createRoot } from "react-dom/client";
import { RevisaoClinica } from "../../../src/ui/consulta/RevisaoClinica.js";
import { MenuRapido21st } from "../../../src/ui/oncochart/PainelCombinacoes21st.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";
import type { RevisaoClinicaResposta } from "../../../src/contracts/fase2/revisaoClinica.js";
const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };
const dados: RevisaoClinicaResposta = {
  codigo: "REVISAO_CLINICA_CARREGADA", contexto, revisao: "SINTETICO", packs: [], pack: null,
  ficha: [{ id: "sintetico", rotulo: "Campo SINTETICO", valor: "Informação sintética para revisão", estado: "DOCUMENTADO", motivo: "Teste sintético", data: "2026-10-05", fatos: [], fontes: [] }],
  preQt: { estado: "PENDENTE", autorizaTratamento: false, pendencias: [] },
  respostaTumoral: { criterio: "RECIST_1_1", aplicabilidade: "CONFERIR_CRITERIO_DO_TUMOR", series: [], patologica: [], pendencias: [] },
  estadosDoenca: [], pendencias: [],
};
const porta = { ...criarPortaFalsa(), revisaoClinica: async () => dados };
createRoot(document.getElementById("root")!).render(
  <main className="oncoassist-local" data-combo-21st="violet-halo">
    <header className="consulta-appbar"><div><h1>Consulta SINTETICA</h1><p>Prova de layout dos componentes reais.</p></div>
      <div className="consulta-appbar-direita"><MenuRapido21st combinacao="violet-halo" aoMudarCombinacao={() => {}} /></div></header>
    <RevisaoClinica porta={porta} contexto={{ patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" }} versaoClinica={0} />
  </main>
);