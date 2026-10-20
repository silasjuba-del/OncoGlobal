// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Fonte } from "../../src/contracts/base.js";
import type { VisaoTimelineMulticamadas } from "../../src/contracts/api/timelineMulticamadas.js";
import { TimelineMulticamadas } from "../../src/ui/consulta/TimelineMulticamadas.js";

afterEach(cleanup);

const fonte = Fonte.parse({ sourceId: "fonte-sintetica", classe: "DOCUMENT", localizador: "pagina:2",
  dataClinica: "2026-10-10", dataCaptura: "2026-10-11T10:00:00-03:00", versao: "sintetica-v1", contentHash: "hash-fonte" });
function evento(overrides: Partial<VisaoTimelineMulticamadas["eventos"][number]> = {}): VisaoTimelineMulticamadas["eventos"][number] {
  return { id: "ev-stage", eventId: "event-stage", patientId: "patient-synthetic", encounterId: "encounter-old",
    tumorLotId: "lot-synthetic", tipoEvento: "FATO", categoria: "ESTADIAMENTO", trilha: "DEFINIDORES",
    titulo: "Estadiamento", resumo: "cT2N1M0", dataClinica: "2026-10-10", dataPlanejada: null,
    dataRegistro: "2026-10-12T10:00:00-03:00", revisao: "CONFIRMADO", supersedido: false,
    trecho: "Trecho sintético de estadiamento.", fontes: [fonte], detalhes: [{ rotulo: "TNM", valor: "cT2N1M0" }], tratamento: null,
    ...overrides };
}
function visao(): VisaoTimelineMulticamadas {
  return { contexto: { patientId: "patient-synthetic", encounterId: "encounter-current", tumorLotId: "lot-synthetic" },
    revisao: "a".repeat(64), eventos: [
      evento(),
      evento({ id: "ev-lab", eventId: "event-lab", categoria: "LABORATORIO", trilha: "FISIOLOGIA", titulo: "Hemoglobina",
        resumo: "8,2 g/dL", dataClinica: "2026-10-20", dataRegistro: "2026-10-21T10:00:00-03:00", trecho: null,
        detalhes: [{ rotulo: "Valor", valor: "8,2 g/dL" }] }),
      evento({ id: "ev-unknown", eventId: "event-unknown", categoria: "DOCUMENTO", trilha: "DOCUMENTOS",
        titulo: "Documento sem data", resumo: "Data clínica não consta", dataClinica: null, dataRegistro: "2026-11-01T10:00:00-03:00",
        trecho: "Fonte sintética sem data clínica.", tratamento: null }),
    ] };
}

describe("TimelineMulticamadas", () => {
  it("exibe as cinco trilhas e seleciona evento para detalhes, proveniência e trecho", () => {
    render(<TimelineMulticamadas dados={visao()} />);
    for (const label of ["Definidores", "Tratamento e resposta", "Fisiologia", "Sintomas", "Documentos"])
      expect(screen.getByRole("region", { name: label })).toBeTruthy();
    const botao = screen.getByRole("button", { name: /Estadiamento.*cT2N1M0/ });
    fireEvent.click(botao);
    expect(screen.getByRole("region", { name: "Detalhes do evento" }).textContent).toContain("Trecho sintético de estadiamento.");
    expect(screen.getByRole("region", { name: "Detalhes do evento" }).textContent).toContain("fonte-sintetica");
    expect(screen.getByRole("region", { name: "Detalhes do evento" }).textContent).toContain("2026-10-10");
    expect(screen.getByRole("region", { name: "Detalhes do evento" }).textContent).toContain("2026-10-12T10:00:00-03:00");
  });

  it("filtra intervalo clínico e mantém datas desconhecidas em trilha separada", () => {
    render(<TimelineMulticamadas dados={visao()} />);
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-31" } });
    expect(screen.queryByRole("button", { name: /cT2N1M0/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Hemoglobina.*8,2 g\/dL/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Eventos sem data clínica" }).textContent).toContain("Documento sem data");
    expect(screen.getByRole("region", { name: "Eventos sem data clínica" }).textContent).not.toContain("2026-11-01T10:00:00-03:00");
  });

  it("permite selecionar por teclado e ajustar zoom sem perder o foco", () => {
    render(<TimelineMulticamadas dados={visao()} />);
    const botao = screen.getByRole("button", { name: /Estadiamento.*cT2N1M0/ });
    botao.focus(); fireEvent.keyDown(botao, { key: "Enter" });
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByLabelText("Zoom da timeline"), { target: { value: "2" } });
    expect(screen.getByText("2×")).toBeTruthy();
  });
});
