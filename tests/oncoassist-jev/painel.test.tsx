// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { PainelOncoassist } from "../../src/ui/consulta/PainelOncoassist.js";

afterEach(cleanup);
const contexto = { patientId: "paciente-sintetico", encounterId: "consulta-sintetica", tumorLotId: null };
describe("OncoAssist na consulta", () => {
  it("ambiente sem capacidade informa pendência sem simular proposta", async () => {
    render(<PainelOncoassist porta={criarPortaFalsa()} contexto={contexto} />);
    expect(await screen.findByText(/aguardando configuração/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sugerir classificação" })).toBeNull();
  });
  it("envia somente fonte selecionada e contexto após ação e apresenta proposta sem confirmação", async () => {
    const base = criarPortaFalsa();
    const confirmar = vi.spyOn(base, "confirmar");
    const classificar = vi.fn(async () => ({ status: "PROPOSTA" as const, revisaoObrigatoria: true as const,
      fonte: { id: "fonte-local", sha256: "hash" }, categoria: "LAB" as const }));
    const porta = { ...base,
      oncoassistStatus: async () => ({ status: "DISPONIVEL" as const }),
      oncoassistFontes: async () => ({ fontes: [{ draftId: "draft-local", rotulo: "Documento da consulta", criadoEm: "2026-10-07" }] }),
      oncoassistClassificar: classificar };
    render(<PainelOncoassist porta={porta} contexto={contexto} />);
    const botao = await screen.findByRole("button", { name: "Sugerir classificação" });
    expect(classificar).not.toHaveBeenCalled();
    fireEvent.click(botao);
    expect(await screen.findByText("Laboratório — sugestão para revisão.")).toBeTruthy();
    expect(classificar).toHaveBeenCalledWith({ ...contexto, draftId: "draft-local" }, expect.any(AbortSignal));
    expect(confirmar).not.toHaveBeenCalled();
  });
  it("resposta de uma consulta antiga não aparece após troca de paciente", async () => {
    let concluir!: (r: {status:"PENDENTE";codigo:string}) => void;
    const porta = { ...criarPortaFalsa(),
      oncoassistStatus: async () => ({ status: "DISPONIVEL" as const }),
      oncoassistFontes: async () => ({ fontes: [{ draftId: "draft-local", rotulo: "Documento", criadoEm: "2026-10-07" }] }),
      oncoassistClassificar: () => new Promise<{status:"PENDENTE";codigo:string}>(resolve => { concluir = resolve; }) };
    const view = render(<PainelOncoassist porta={porta} contexto={contexto} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    view.rerender(<PainelOncoassist porta={porta} contexto={{ ...contexto, patientId: "outro-paciente" }} />);
    concluir({status:"PENDENTE",codigo:"ANTERIOR"});
    await screen.findByRole("button", { name: "Sugerir classificação" });
    expect(screen.queryByText("Classificação pendente. O documento foi preservado.")).toBeNull();
  });
});
