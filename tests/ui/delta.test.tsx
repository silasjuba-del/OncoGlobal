// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PainelDelta, type ItemDeltaVisao } from "../../src/ui/consulta/PainelDelta.js";

afterEach(() => {
  cleanup();
});

const mudou: ItemDeltaVisao = {
  id: "hb",
  rotulo: "hemoglobina",
  kind: "MUDOU",
  estado: "VERDE",
};

const conflito: ItemDeltaVisao = {
  id: "ldh",
  rotulo: "LDH",
  kind: "MUDOU",
  estado: "VERMELHO",
  candidatos: [
    { rotulo: "laudo A", valorTexto: "400" },
    { rotulo: "laudo B", valorTexto: "900" },
  ],
};

const ausente: ItemDeltaVisao = {
  id: "cea",
  rotulo: "CEA",
  kind: "PERSISTE",
  estado: "PENDENTE",
};

describe("desde a última consulta", () => {
  it("dia 1 não inventa delta", () => {
    render(
      <PainelDelta
        temSnapshotAnterior={false}
        itens={[{ ...mudou, direcao: "MELHOR" }, conflito]}
      />,
    );
    expect(screen.getByText("linha de base em construção")).toBeTruthy();
    expect(screen.queryByText("MUDOU")).toBeNull();
    expect(screen.queryByText("MELHOR")).toBeNull();
    expect(screen.queryByText(/melhorou|piorou/i)).toBeNull();
    expect(screen.queryByText("laudo A: 400")).toBeNull();
  });

  it("não diz melhorou nem piorou sem direcao", () => {
    render(<PainelDelta temSnapshotAnterior itens={[mudou, ausente]} />);
    expect(screen.getByText("MUDOU")).toBeTruthy();
    expect(screen.getByText("PENDENTE")).toBeTruthy();
    expect(screen.queryByText("MELHOR")).toBeNull();
    expect(screen.queryByText("PIOR")).toBeNull();
    expect(screen.queryByText(/melhorou|piorou/i)).toBeNull();
    const pendente = screen.getByText("PENDENTE");
    expect(pendente.className).not.toMatch(/verde/);
  });

  it("mostra MELHOR só com direcao e conflito em vermelho com candidatos", () => {
    render(
      <PainelDelta
        temSnapshotAnterior
        itens={[{ ...mudou, direcao: "PIOR" }, conflito]}
      />,
    );
    expect(screen.getByText("↓ PIOR")).toBeTruthy();
    expect(screen.queryByText(/melhorou|piorou/i)).toBeNull();
    expect(screen.getByText("VERMELHO")).toBeTruthy();
    expect(screen.getByText("laudo A: 400")).toBeTruthy();
    expect(screen.getByText("laudo B: 900")).toBeTruthy();
    const vermelho = screen.getByText("VERMELHO");
    expect(vermelho.className).toContain("semaforo-vermelho");
  });
});