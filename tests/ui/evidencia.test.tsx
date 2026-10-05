// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Fonte } from "../../src/contracts/base.js";
import { CardEvidencia, type AfirmacaoVisao } from "../../src/ui/evidencia/CardEvidencia.js";

const captura = "2026-10-05T11:00:00-03:00";

const fonteExame: Fonte = {
  sourceId: "src-lab",
  classe: "LAB_FEED",
  localizador: "página 2",
  dataClinica: "2024-03-02",
  dataCaptura: captura,
  versao: "1",
  contentHash: "h-lab",
};

const fonteB: Fonte = {
  ...fonteExame,
  sourceId: "src-lab-b",
  localizador: "página 4",
  dataClinica: "2024-03-03",
  dataCaptura: "2026-10-05T12:00:00-03:00",
  contentHash: "h-b",
};

afterEach(() => {
  cleanup();
});

const base: AfirmacaoVisao = {
  rotulo: "hemoglobina",
  valorTexto: "8,1 g/dL",
  estado: "VERDE",
  campo: "PRESENTE",
  motivo: "laudo",
  revisao: "CONFIRMADO",
  fontes: [fonteExame],
  evidenceLayer: "DOCUMENT_TEXT",
};

describe("card de evidência", () => {
  it("separa data clínica da data de captura", () => {
    const { container } = render(<CardEvidencia afirmacao={base} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver fonte" }));
    const clinica = container.querySelector("[data-campo='data-clinica']");
    const cap = container.querySelector("[data-campo='data-captura']");
    expect(clinica?.textContent).toContain("2024-03-02");
    expect(clinica?.textContent).not.toContain(captura);
    expect(cap?.textContent).toContain(captura);
    expect(screen.getByText("Classe: LAB_FEED")).toBeTruthy();
    expect(screen.getByText("Localizador: página 2")).toBeTruthy();
    expect(screen.getByText("Camada: texto do laudo")).toBeTruthy();
    expect(screen.getByText("Revisão: CONFIRMADO")).toBeTruthy();
  });

  it("NAO_SE_APLICA mostra o motivo", () => {
    render(
      <CardEvidencia
        afirmacao={{
          ...base,
          valorTexto: null,
          estado: "PENDENTE",
          campo: "NAO_SE_APLICA",
          motivo: "biópsia incisional",
          evidenceLayer: "DOCUMENT_TEXT",
        }}
      />,
    );
    expect(screen.getByText("Motivo: biópsia incisional")).toBeTruthy();
    expect(screen.getByText("Valor: não se aplica")).toBeTruthy();
  });

  it("CONFLITO mostra candidatos lado a lado sem eleger valor", () => {
    render(
      <CardEvidencia
        afirmacao={{
          ...base,
          valorTexto: null,
          estado: "VERMELHO",
          campo: "CONFLITO",
          motivo: "laudos divergem",
          revisao: "REVISAR",
          fontes: [],
          candidatos: [
            { valorTexto: "8,0", fontes: [fonteExame] },
            { valorTexto: "11,2", fontes: [fonteB] },
          ],
        }}
      />,
    );
    expect(screen.getByText("sem valor eleito")).toBeTruthy();
    expect(screen.getByText("8,0")).toBeTruthy();
    expect(screen.getByText("11,2")).toBeTruthy();
    expect(screen.queryByText("Valor: 8,0")).toBeNull();
    expect(screen.getByText("VERMELHO").className).toContain("semaforo-vermelho");
  });

  it("inferência fica rotulada", () => {
    render(
      <CardEvidencia
        afirmacao={{ ...base, evidenceLayer: "INFERENCE", revisao: "INFERIDO", estado: "PENDENTE" }}
      />,
    );
    expect(screen.getByText("Camada: inferência")).toBeTruthy();
  });
});
