// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PortaConsulta } from "../../src/ui/api/porta.js";
import { FichasPrescricaoConsulta } from "../../src/ui/consulta/FichasPrescricaoConsulta.js";
afterEach(cleanup);
it("não monta o catálogo completo até o médico abrir as fichas; mantém o painel após fechar", async () => {
  const listar = vi.fn(async () => ({ fichas: [] }));
  const porta = { listarFichasPrescricao: listar } as unknown as PortaConsulta;
  render(<FichasPrescricaoConsulta porta={porta}
    contexto={{ patientId: "p-sintetico", encounterId: "e-sintetico", tumorLotId: null }}
    ocupado={false} aoInstanciar={vi.fn()} aoAlterarSalvando={vi.fn()} />);
  await waitFor(() => expect(listar).toHaveBeenCalledOnce());
  expect(document.querySelector('[aria-label="Catálogo de fichas de prescrição"]')).toBeNull();
  const details = screen.getByText("Fichas de protocolo: conferir e usar na prescrição").closest("details")!;
  details.open = true; fireEvent(details, new Event("toggle"));
  await screen.findByRole("region", { name: "Catálogo de fichas de prescrição" });
  details.open = false; fireEvent(details, new Event("toggle"));
  expect(document.querySelector('[aria-label="Catálogo de fichas de prescrição"]')).toBeTruthy();
});
