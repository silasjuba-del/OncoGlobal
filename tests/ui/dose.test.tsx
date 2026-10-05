// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EntradaDose } from "../../src/contracts/regras.js";
import { DoseRuleset } from "../../src/contracts/regras.js";
import { calcularDose } from "../../src/rules/index.js";
import { CalculadoraDose } from "../../src/ui/tratamento/CalculadoraDose.js";

const ruleset = DoseRuleset.parse(
  JSON.parse(readFileSync(join(process.cwd(), "corpus/rulesets/dose.v1.json"), "utf8")),
);

const base: Omit<EntradaDose, "reducaoPct"> = {
  doseAdministradaAnteriorMg: 125,
  pesoKg: 70,
  origemPeso: "MEDIDO",
  ciclosSemPesoAnteriores: 0,
};

afterEach(() => {
  cleanup();
});

describe("calculadora de dose", () => {
  it("não calcula no componente e só oferece −20 −30 −40", () => {
    const src = readFileSync(join(process.cwd(), "src/ui/tratamento/CalculadoraDose.tsx"), "utf8");
    expect(src).toContain("calcularDose");
    expect(src).not.toMatch(/Math\.|0\.8|0\.7|0\.6/);
    render(<CalculadoraDose base={base} ruleset={ruleset} />);
    expect(screen.getByRole("button", { name: "−20" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "−30" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "−40" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "−10" })).toBeNull();
    expect(screen.queryByRole("button", { name: "−25" })).toBeNull();
    expect(screen.queryByRole("button", { name: "−50" })).toBeNull();
    expect(screen.getByText("Origem do peso: MEDIDO")).toBeTruthy();
  });

  it("mostra o resultado de calcularDose", () => {
    render(<CalculadoraDose base={base} ruleset={ruleset} />);
    fireEvent.click(screen.getByRole("button", { name: "−30" }));
    const saida = calcularDose({ ...base, reducaoPct: 30 }, ruleset);
    expect(screen.getByText(`Dose: ${saida.doseMg} mg`)).toBeTruthy();
    expect(screen.getByText(saida.estado)).toBeTruthy();
    expect(screen.getByText(`Ciclos sem peso: ${saida.ciclosSemPesoConsecutivos}`)).toBeTruthy();
  });

  it("sem base mostra PENDENTE", () => {
    render(
      <CalculadoraDose
        base={{ ...base, doseAdministradaAnteriorMg: null }}
        ruleset={ruleset}
      />,
    );
    expect(screen.getByText("Dose do ciclo anterior: PENDENTE")).toBeTruthy();
    expect(screen.getByText("Dose: PENDENTE")).toBeTruthy();
    expect(screen.getByText("PENDENTE").className).not.toMatch(/verde/);
  });

  it("peso informado pede confirmação e a origem fica visível", () => {
    render(
      <CalculadoraDose
        base={{ ...base, origemPeso: "INFORMADO_PACIENTE", pesoKg: 68 }}
        ruleset={ruleset}
      />,
    );
    expect(screen.getByText("Origem do peso: INFORMADO PELO PACIENTE")).toBeTruthy();
    expect(screen.getByText("diferença incerta — confirme")).toBeTruthy();
  });
});
