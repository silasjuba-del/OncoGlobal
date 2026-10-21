// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { App } from "../../src/ui/App.js";
import { TelaSalao } from "../../src/ui/telas/TelaSalao.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { SalaoVisao } from "../../src/ui/api/porta.js";
import type { Triagem } from "../../src/contracts/clinico.js";
import { HOJE, ctxBase, fonteSintetica } from "../fixtures/triagem.js";
import { SalaoRuleset } from "../../src/contracts/regras.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };
const salaoRuleset = SalaoRuleset.parse(JSON.parse(readFileSync(
  join(process.cwd(), "corpus/rulesets/salao-triagem.v1.json"), "utf8")));

describe("CURSOR-12 triagem e Salão integrado", () => {
  it("avança sem travar, alerta em campo e não mostra agenda QT fictícia", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    fireEvent.click(screen.getByRole("button", { name: "Salão" }));
    const salao = await screen.findByRole("region", { name: "Salão" }, lento);
    const tri = within(salao).getByRole("region", { name: "Triagem em 5 passos" });
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: Sinais/ }));
    fireEvent.change(within(tri).getByLabelText("PAS"), { target: { value: "190" } });
    expect(within(tri).getByRole("status").textContent).toMatch(/alerta/i);
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: Laboratorial/ }));
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: ECOG/ }));
    fireEvent.click(within(tri).getByRole("button", { name: "ECOG 1" }));
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: CTCAE/ }));
    expect(within(tri).getByLabelText("Resumo final da triagem").textContent).toMatch(/ECOG: 1/);
    expect(within(salao).queryByRole("region", { name: "Agenda de QT" })).toBeNull();
    expect(within(salao).queryByText(/Paciente A|Paciente B|Paciente C/)).toBeNull();
  }, 60_000);

  it("renderiza aviso da Porta e salva a triagem do paciente/encontro exibidos", async () => {
    const patientId = "paciente-fixture-salao-41";
    const encounterId = "encontro-fixture-salao-41";
    const nome = "Paciente Fixture Salão 41";
    const chegadaEm = "2026-10-05T08:15:00-03:00";
    const visao: SalaoVisao = {
      hoje: HOJE,
      ruleset: salaoRuleset,
      contexto: ctxBase(),
      fonte: fonteSintetica("fonte-salao-fixture-41"),
      cartoes: [],
      pacientes: [{ patientId, encounterId, chegadaEm, nome, draftId: null, revision: null, estadoRascunho: null }],
      decisoes: [],
      avisos: [{ patientId, texto: "Aviso sintético recebido pela Porta do Salão." }],
      relatosInfusao: [],
    };
    const visaoAposSalvar: SalaoVisao = {
      ...visao,
      avisos: [{ patientId, texto: "Triagem sintética atualizada pela Porta." }],
      pacientes: [{ ...visao.pacientes[0]!, draftId: "triagem-fixture-salao-41", revision: 1, estadoRascunho: "RASCUNHO" }],
    };
    const salvarTriagem = vi.fn(async (_triagem: Triagem, _expectedRevision: number | null = null) => visaoAposSalvar);
    const { gerarContingenciaSalao: _gerarContingenciaSalao, historicoContingenciaSalao: _historicoContingenciaSalao,
      ...portaBase } = criarPortaFalsa();
    void _gerarContingenciaSalao;
    void _historicoContingenciaSalao;
    const porta = {
      ...portaBase,
      filaSalao: vi.fn(async () => visao),
      selecionarContexto: vi.fn(async () => undefined),
      salvarTriagem,
    };

    render(<TelaSalao porta={porta} />);
    const salao = await screen.findByRole("region", { name: "Salão" }, lento);
    expect((within(salao).getByLabelText("Paciente em triagem") as HTMLSelectElement).value).toBe(patientId);
    expect(within(salao).getByLabelText("Avisos do salão").textContent).toContain("Aviso sintético recebido pela Porta");
    expect(within(salao).queryByRole("region", { name: "Agenda de QT" })).toBeNull();

    fireEvent.change(within(salao).getByLabelText("PA sistólica (mmHg)"), { target: { value: "170" } });
    fireEvent.click(within(salao).getByRole("button", { name: "salvar triagem" }));

    await waitFor(() => expect(within(salao).getByLabelText("Avisos do salão").textContent)
      .toContain("Triagem sintética atualizada pela Porta"));
    expect(salvarTriagem).toHaveBeenCalledOnce();
    expect(salvarTriagem).toHaveBeenCalledWith(expect.objectContaining({ patientId, encounterId,
      pas: expect.objectContaining({ valor: 170 }) }), null);
    expect(within(salao).getByRole("region", { name: "Resultado da triagem" }).textContent)
      .toContain("pressão arterial acima do limite");
    expect(within(salao).queryByText(/Paciente A|Paciente B|Paciente C/)).toBeNull();
  }, 60_000);
});
