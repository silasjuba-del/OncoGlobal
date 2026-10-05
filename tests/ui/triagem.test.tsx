// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalaoRuleset } from "../../src/contracts/regras.js";
import { FormTriagem } from "../../src/ui/salao/FormTriagem.js";
import { ctxBase, fonteSintetica } from "../fixtures/triagem.js";

const ruleset = SalaoRuleset.parse(
  JSON.parse(readFileSync(join(process.cwd(), "corpus/rulesets/salao-triagem.v1.json"), "utf8")),
);

afterEach(() => {
  cleanup();
});

function preencherSeguros() {
  fireEvent.change(screen.getByLabelText("PA sistólica (mmHg)"), { target: { value: "120" } });
  fireEvent.change(screen.getByLabelText("Frequência cardíaca (bpm)"), { target: { value: "78" } });
  fireEvent.change(screen.getByLabelText("Saturação (%)"), { target: { value: "98" } });
  fireEvent.change(screen.getByLabelText("Temperatura (°C)"), { target: { value: "36,5" } });
  fireEvent.change(screen.getByLabelText("Hemoglobina (g/dL)"), { target: { value: "12,0" } });
  fireEvent.change(screen.getByLabelText("Neutrófilos (/µL)"), { target: { value: "3000" } });
  fireEvent.change(screen.getByLabelText("Plaquetas (/µL)"), { target: { value: "210000" } });
  fireEvent.change(screen.getByLabelText("Coleta do hemograma"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("ECOG"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Grau CTCAE"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Idade (anos)"), { target: { value: "60" } });
}

function abrir() {
  const onSalvar = vi.fn();
  render(
    <FormTriagem
      patientId="paciente-teste-01"
      encounterId="encontro-teste-01"
      chegadaEm="2026-10-05T08:00:00-03:00"
      ruleset={ruleset}
      contexto={ctxBase()}
      fonte={fonteSintetica()}
      onSalvar={onSalvar}
    />,
  );
  return onSalvar;
}

describe("triagem do salão", () => {
  it("não calcula corte no componente", () => {
    const src = readFileSync(join(process.cwd(), "src/ui/salao/FormTriagem.tsx"), "utf8");
    expect(src).toContain("avaliarTriagem");
    expect(src).not.toMatch(/pasMax|tempDecimosMax|hbDgDlMin/);
    expect(src).not.toMatch(/\b160\b|\b378\b|\b80\b/);
  });

  it("PA 161 mostra FILA_MEDICO com o motivo e não impede salvar", () => {
    const onSalvar = abrir();
    const botao = screen.getByRole("button", { name: "salvar triagem" });
    expect(botao.hasAttribute("disabled")).toBe(false);
    preencherSeguros();
    fireEvent.change(screen.getByLabelText("PA sistólica (mmHg)"), { target: { value: "161" } });
    fireEvent.click(botao);
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Destino: FILA_MEDICO")).toBeTruthy();
    expect(screen.getByText("pressão arterial acima do limite")).toBeTruthy();
  });

  it("37,9 °C mostra corte e 37,8 não", () => {
    abrir();
    preencherSeguros();
    fireEvent.change(screen.getByLabelText("Temperatura (°C)"), { target: { value: "37,8" } });
    fireEvent.click(screen.getByRole("button", { name: "salvar triagem" }));
    expect(screen.queryByText("temperatura acima do limite")).toBeNull();

    fireEvent.change(screen.getByLabelText("Temperatura (°C)"), { target: { value: "37,9" } });
    fireEvent.click(screen.getByRole("button", { name: "salvar triagem" }));
    expect(screen.getByText("temperatura acima do limite")).toBeTruthy();
  });

  it("campo vazio aplicável mostra pendência", () => {
    const onSalvar = abrir();
    preencherSeguros();
    fireEvent.change(screen.getByLabelText("Hemoglobina (g/dL)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "salvar triagem" }));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(screen.getByText("hemoglobina ausente")).toBeTruthy();
  });
});
