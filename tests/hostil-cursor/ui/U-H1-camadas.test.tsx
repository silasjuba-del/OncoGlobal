// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlayFlash } from "../../../src/ui/consulta/OverlayFlash.js";
import { Configuracoes } from "../../../src/ui/oncochart/Configuracoes.js";
import { ImageViewerOncoAssist } from "../../../src/ui/oncochart/ImageViewerOncoAssist.js";
import type { ConsultaFlashProps } from "../../../src/ui/consulta/ConsultaFlash.js";

import { OverlayAtivo } from "../../../src/ui/oncochart/Overlays.js";
import { Jornada3D } from "../../../src/ui/oncochart/Jornada3D.js";
import { timelineSintetica } from "../../../src/ui/oncochart/timeline-visao.js";

afterEach(cleanup);

const apacBase = {
  cid: "C50",
  sigtap: "0304050067",
  finalidade: "ADJUVANTE",
  competencia: "2026-10",
  estado: "VALIDA" as const,
  pendencias: [],
};

const flashFixture: ConsultaFlashProps = {
  hoje: "2026-10-05",
  pacienteNome: "Paciente SINTETICO U-H1",
  cabecalho: {
    diagnostico: "Carcinoma mamário sintético",
    tnm: "cT2N0M0",
    estadio: "IIA",
    tratamentoAtual: "AC-T",
    cicloDia: "C1D1",
    ultimoAdministrado: "2026-09-14",
    alergia: "Nenhuma",
  },
  exames: [],
  acoesHoje: [],
  receitas: [],
  apac: apacBase,
  retorno: { dias: 21, examesAntesDoRetorno: [] },
  iaFala: [],
  planoInicial: {
    acoesMarcadas: [],
    receitasMarcadas: [],
    apac: { ...apacBase, emitir: false },
    retorno: { dias: 21, examesAntesDoRetorno: [] },
    tarefasRetorno: { retorno: true, laboratorio: false, imagem: false },
    solicitacoes: { laboratorio: [], imagem: [] },
    decisaoQt: { solicitarCiclo: false, data: "2026-10-05" },
    documentosManuais: [
      { id: "doc-sint-1", tipo: "LAUDO", titulo: "Laudo sintético", destino: null, texto: "Texto SINTETICO" },
    ],
  },
  aoSalvarRascunho: () => {},
  aoFinalizar: () => {},
};

function viewer(onFechar: () => void) {
  return <ImageViewerOncoAssist exameTitulo="TC Tórax SINTETICA" laudo="Nódulo sintético estável."
    achados={[{ id: "a1", texto: "Nódulo 8 mm", trechoFonte: "p. 1" }]} alertasRads={[]}
    onFechar={onFechar} onTrecho={() => {}} />;
}

// U-H1 (auditoria): diálogos empilhados — só a camada do topo (último diálogo do documento) reage a Esc e Tab.
// Em TelaConsulta o visualizador (z 50) fica antes dos overlays (z 55) no DOM; Configurações (z 70) vem depois.
describe("U-H1 · diálogos empilhados", () => {
  it("Esc com Consulta Flash sobre o visualizador fecha só a Consulta Flash", () => {
    const fecharViewer = vi.fn(), fecharFlash = vi.fn();
    render(<>{viewer(fecharViewer)}<OverlayFlash flash={flashFixture} onFechar={fecharFlash} /></>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(fecharFlash).toHaveBeenCalledTimes(1);
    expect(fecharViewer).not.toHaveBeenCalled();
  });

  it("Tab no fim da Consulta Flash volta ao início dela, sem o visualizador puxar o foco", () => {
    render(<>{viewer(() => {})}<OverlayFlash flash={flashFixture} onFechar={() => {}} /></>);
    const flash = screen.getByRole("dialog", { name: "Consulta Flash" });
    const focaveis = [...flash.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")]
      .filter((el) => !el.closest(".oc-ov-backdrop") && el.tabIndex !== -1);
    focaveis.at(-1)!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(focaveis[0]);
  });

  it("Esc com Configurações sobre a Consulta Flash fecha só Configurações", () => {
    const fecharFlash = vi.fn(), fecharCfg = vi.fn();
    render(<><OverlayFlash flash={flashFixture} onFechar={fecharFlash} /><Configuracoes tema="dia" onTema={() => {}} onFechar={fecharCfg} /></>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(fecharCfg).toHaveBeenCalledTimes(1);
    expect(fecharFlash).not.toHaveBeenCalled();
  });
});

for (const inferior of ["overlay", "jornada"] as const) {
  it(`Configurações cobre ${inferior}: Escape só fecha a camada superior`, () => {
    const fecharInferior = vi.fn(), fecharCfg = vi.fn();
    render(<>{inferior === "overlay"
      ? <OverlayAtivo id="interacoes" onFechar={fecharInferior} onAbrirPaleta={() => {}} />
      : <Jornada3D visao={timelineSintetica("SINTETICO", "2026-10-05")} onFechar={fecharInferior} />}
      <Configuracoes tema="dia" onTema={() => {}} onFechar={fecharCfg} /></>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(fecharCfg).toHaveBeenCalledTimes(1);
    expect(fecharInferior).not.toHaveBeenCalled();
  });
}

it("Jornada acima da Flash recebe Escape mesmo aparecendo antes no DOM", () => {
  const fecharJornada = vi.fn(), fecharFlash = vi.fn();
  render(<><Jornada3D visao={timelineSintetica("SINTETICO", "2026-10-05")} onFechar={fecharJornada} />
    <OverlayFlash flash={flashFixture} onFechar={fecharFlash} /></>);
  screen.getByRole("dialog", { name: "Jornada oncológica 3D" }).style.zIndex = "60";
  screen.getByRole("dialog", { name: "Consulta Flash" }).style.zIndex = "55";
  fireEvent.keyDown(document, { key: "Escape" });
  expect(fecharJornada).toHaveBeenCalledTimes(1);
  expect(fecharFlash).not.toHaveBeenCalled();
});

it("Jornada mantém navegação por setas com foco em botão", () => {
  render(<Jornada3D visao={timelineSintetica("SINTETICO", "2026-10-05")} onFechar={() => {}} />);
  const parada = () => document.querySelector('[aria-current="true"]')?.textContent;
  const anterior = parada();
  const botao = screen.getByRole("button", { name: "Fechar jornada" });
  botao.focus();
  fireEvent.keyDown(botao, { key: "ArrowLeft" });
  expect(parada()).not.toBe(anterior);
});
