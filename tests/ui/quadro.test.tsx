// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntradaFila } from "../../src/contracts/regras.js";
import { SalaoRuleset } from "../../src/contracts/regras.js";
import { ordenarFila } from "../../src/rules/index.js";
import { QuadroSalao, type CartaoSalaoVisao } from "../../src/ui/salao/QuadroSalao.js";

const ruleset = SalaoRuleset.parse(
  JSON.parse(readFileSync(join(process.cwd(), "corpus/rulesets/salao-triagem.v1.json"), "utf8")),
);

function entrada(
  patientId: string,
  ecog: number,
  recurso: EntradaFila["recurso"],
  idadeAnos: number,
  hora: string,
): EntradaFila {
  return { patientId, ecog, recurso, idadeAnos, chegadaEm: `2026-10-05T${hora}:00-03:00` };
}

afterEach(() => {
  cleanup();
});

describe("quadro do salão", () => {
  it("a ordem é a de ordenarFila e E1 não muda a posição", () => {
    const cartoes: CartaoSalaoVisao[] = [
      { entrada: entrada("p-amb", 1, "AMBULATORIAL", 40, "07:00"), destino: "SALAO", emergencia: true, temCorte: false, nome: "Paciente Teste 01" },
      { entrada: entrada("p-ecog4", 4, "CADEIRA", 50, "10:00"), destino: "SALAO", emergencia: false, temCorte: true, nome: "Paciente Teste 02" },
      { entrada: entrada("p-cama", 2, "CAMA", 50, "11:00"), destino: "SALAO", emergencia: false, temCorte: false, nome: "Paciente Teste 03" },
    ];
    const { container } = render(
      <QuadroSalao cartoes={cartoes} ruleset={ruleset} onLiberarComCorte={() => undefined} />,
    );
    const ids = [...container.querySelectorAll("[aria-label='SALÃO'] [data-patient]")].map((el) => el.getAttribute("data-patient"));
    const esperado = ordenarFila(cartoes.map((c) => c.entrada), ruleset).map((e) => e.patientId);
    expect(ids).toEqual(esperado);
    expect(ids[0]).not.toBe("p-amb");
    expect(screen.getByLabelText("Escalonamento").textContent).toContain("Paciente Teste 01");
    expect(screen.getByLabelText("Escalonamento").textContent).toContain("E1");
  });

  it("liberar com corte exige motivo e não sai sem ele", () => {
    const onLiberar = vi.fn();
    const cartoes: CartaoSalaoVisao[] = [
      { entrada: entrada("p-ecog4", 4, "CADEIRA", 50, "10:00"), destino: "FILA_MEDICO", emergencia: false, temCorte: true, nome: "Paciente Teste 02" },
    ];
    render(<QuadroSalao cartoes={cartoes} ruleset={ruleset} onLiberarComCorte={onLiberar} />);
    fireEvent.click(screen.getByRole("button", { name: "liberar mesmo com corte" }));
    fireEvent.click(screen.getByRole("button", { name: "confirmar liberação" }));
    expect(onLiberar).not.toHaveBeenCalled();
    expect(screen.getByText("motivo obrigatório")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "conduta do médico neste ciclo" } });
    fireEvent.click(screen.getByRole("button", { name: "confirmar liberação" }));
    expect(onLiberar).toHaveBeenCalledWith("p-ecog4", "conduta do médico neste ciclo");
  });
});
