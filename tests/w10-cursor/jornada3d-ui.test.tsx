// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };

describe("CURSOR-08 Jornada3D UI", () => {
  it("abre modal, troca Chart3D, teclado e mantém ≤200 caixas na cena", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    const tl = await screen.findByRole("region", { name: "Linha do tempo oncológica" }, lento);
    fireEvent.click(within(tl).getByRole("button", { name: "Ver em 3D" }));
    const j3 = await screen.findByRole("dialog", { name: "Jornada oncológica 3D" }, lento);
    expect(within(j3).getByText(/sem conduta/i)).toBeTruthy();
    expect(Number(j3.querySelector(".oc-j3-stage")?.getAttribute("data-caixas") ?? 999)).toBeLessThanOrEqual(
      200,
    );
    fireEvent.click(within(j3).getByRole("button", { name: "CTCAE" }));
    expect(within(j3).getByLabelText("Chart3D CTCAE skyline")).toBeTruthy();
    fireEvent.click(within(j3).getByRole("button", { name: "RECIST" }));
    expect(within(j3).getByLabelText("Chart3D RECIST 1.1")).toBeTruthy();
    expect(within(j3).getByText(/−30% limiar RP/)).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Jornada oncológica 3D" })).toBeNull();
  }, 60_000);
});
