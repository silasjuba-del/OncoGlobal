// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportarTexto } from "../../src/ui/telas/importar/ImportarTexto.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("importar transcrição", () => {
  it("destaca o token, avisa identificador e só grava rascunho RAW depois da confirmação", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ImportarTexto />);
    const campo = screen.getByLabelText("Transcrição desidentificada");
    fireEvent.change(campo, { target: { value: "consulta de ⟨NOME_1⟩ CPF 123.456.789-09" } });
    expect(screen.getByLabelText("Pré-visualização").querySelector("mark")?.textContent).toBe("⟨NOME_1⟩");

    fireEvent.click(screen.getByRole("button", { name: "importar" }));
    expect(screen.getByText("parece conter identificador")).toBeTruthy();
    expect(screen.queryByLabelText("Rascunho importado")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "confirmar importação" }));
    const rascunho = screen.getByLabelText("Rascunho importado");
    expect(rascunho.textContent).toContain("rascunho");
    expect(rascunho.textContent).toContain("revisao: RAW");
    expect(rascunho.textContent).not.toContain("CONFIRMADO");
    expect(fetchSpy).not.toHaveBeenCalled();

    const voz = screen.getByRole("button", { name: "comando de voz" });
    expect(voz.hasAttribute("disabled")).toBe(true);
    expect(voz.textContent).toContain("capacidade não habilitada");
    fireEvent.click(voz);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("texto sem identificador vira rascunho na hora e o laudo fica local", async () => {
    render(<ImportarTexto />);
    fireEvent.change(screen.getByLabelText("Transcrição desidentificada"), {
      target: { value: "nota sintética sem documento" },
    });
    fireEvent.click(screen.getByRole("button", { name: "importar" }));
    expect(screen.queryByText("parece conter identificador")).toBeNull();
    expect(screen.getByLabelText("Rascunho importado").textContent).toContain("revisao: RAW");

    const arquivo = new File(["laudo sintético ⟨NOME_2⟩"], "laudo.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Anexar laudo"), { target: { files: [arquivo] } });
    expect(await screen.findByText("laudo sintético ⟨NOME_2⟩")).toBeTruthy();
    expect(screen.getByLabelText("Pré-visualização").querySelector("mark")?.textContent).toBe("⟨NOME_2⟩");
    expect(screen.queryByLabelText("Rascunho importado")).toBeNull();
  });
});
