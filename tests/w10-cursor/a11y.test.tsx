// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };

describe("CURSOR-13 acessibilidade e desempenho", () => {
  it("tokens cobrem foco, reduced-motion e dock ≥44; jornada sob demanda", async () => {
    const css = readFileSync(join(process.cwd(), "src/ui/oncochart/tokens.css"), "utf8");
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/min-height:\s*44px/);
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    expect(screen.queryByRole("dialog", { name: "Jornada oncológica 3D" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver em 3D" }));
    expect(screen.getByRole("dialog", { name: "Jornada oncológica 3D" })).toBeTruthy();
    const dock = screen.getByRole("navigation", { name: "Dock de ações" });
    expect(dock.querySelector('[data-min-touch="44"]')).toBeTruthy();
  }, 60_000);
});
