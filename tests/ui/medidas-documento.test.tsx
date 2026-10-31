// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MedidasDocumento } from "../../src/ui/consulta/MedidasDocumento.js";
afterEach(cleanup);
it("usa a régua fornecida, recusa outra direção sem prova e invalida o resultado quando a entrada muda", () => {
  render(<MedidasDocumento fonte="Laudo sintético · página 1" />);
  fireEvent.click(screen.getByText("Calcular medida calibrada"));
  for (const [rotulo, valor] of [["Régua em mm", "10"], ["Régua em pixels", "100"], ["Medida em pixels", "50"]])
    fireEvent.change(screen.getByLabelText(rotulo!), { target: { value: valor } });
  fireEvent.change(screen.getByLabelText("Direção da régua"), { target: { value: "HORIZONTAL" } });
  fireEvent.change(screen.getByLabelText("Direção da medida"), { target: { value: "HORIZONTAL" } });
  fireEvent.click(screen.getByRole("button", { name: "Calcular a partir das medidas" }));
  expect(screen.getByRole("status").textContent).toContain("5 mm");
  fireEvent.change(screen.getByLabelText("Direção da medida"), { target: { value: "VERTICAL" } });
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Calcular a partir das medidas" }));
  expect(screen.getByRole("status").textContent).toContain("não calibra");
});
