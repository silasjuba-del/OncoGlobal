// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ESTADOS_FARMACIA } from "../../src/modules/farmacia/estados.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { ChatSetor } from "../../src/ui/telas/chat/ChatSetor.js";

afterEach(() => {
  cleanup();
});

describe("chat entre setores", () => {
  it("aceitar a correção não assina e o estoque não trava a prescrição", async () => {
    const visao = await criarPortaFalsa().chatSetor("FARMACIA");
    render(<ChatSetor visao={visao} />);
    expect(ESTADOS_FARMACIA).toContain(visao.prescricao?.estado);
    expect(screen.queryByRole("button", { name: /corrige/i })).toBeNull();
    expect(screen.getByText("estoque: em falta")).toBeTruthy();
    expect(screen.getByRole("button", { name: "prescrever" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "aceitar" }));
    expect(screen.getByLabelText("Prescrição aberta para correção").textContent).toContain("rascunho sem assinatura");
    expect(screen.queryByText("ASSINADO")).toBeNull();
    expect(screen.getByRole("button", { name: "prescrever" }).hasAttribute("disabled")).toBe(false);
  });
});
