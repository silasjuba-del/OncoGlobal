// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { CaixaCanal } from "../../src/ui/telas/canal/CaixaCanal.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("falha ao carregar a caixa mostra erro em vez de ficar carregando", async () => {
  const porta = criarPortaFalsa();
  vi.spyOn(porta, "caixaCanal").mockRejectedValueOnce(new Error("falha sintetica"));

  render(<CaixaCanal porta={porta} chaves={criarChaves()} />);

  expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar as mensagens locais.");
  expect(screen.queryByText("carregando canal")).toBeNull();
});
