// @vitest-environment jsdom
// W8-MUSE · MU-04 · todos os ícones renderizam SVG com viewBox e aria-hidden.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ICONES } from "../../src/ui/icones/index.js";

describe("ícones SVG (MU-04)", () => {
  it("expõe 11 de navegação + 7 de estado + 8 de cromo", () => {
    expect(Object.keys(ICONES).sort()).toEqual(
      [
        "busca", "canal", "chevron", "lua", "salao", "sino", "sol", "usuario",
        "agenda", "alerta", "apac", "assinado", "conflito", "configuracoes",
        "documentos", "e1", "enfermagem", "exames", "farmacia", "pendente",
        "prescricao", "prontuario", "rascunho", "relatorios", "resumo", "riscado",
      ].sort(),
    );
  });

  it("todos renderizam <svg> com viewBox 24 e aria-hidden", () => {
    for (const [nome, Componente] of Object.entries(ICONES)) {
      const { container, unmount } = render(<Componente />);
      try {
        const svg = container.querySelector("svg");
        expect(svg, nome).not.toBeNull();
        expect(svg?.getAttribute("viewBox"), nome).toBe("0 0 24 24");
        expect(svg?.getAttribute("aria-hidden"), nome).toBe("true");
        expect(svg?.childElementCount ?? 0, `${nome} vazio`).toBeGreaterThan(0);
      } finally {
        unmount();
      }
    }
  });
});
