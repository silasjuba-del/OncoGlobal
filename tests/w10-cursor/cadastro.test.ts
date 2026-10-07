import { describe, expect, it } from "vitest";
import {
  estadoAlergias,
  idadeAnosEMeses,
  linhasMatriculaCns,
  valorOuPendente,
} from "../../src/ui/oncochart/cadastro.js";

describe("cadastro Modelo 08", () => {
  it("calcula idade em anos e meses", () => {
    expect(idadeAnosEMeses("1960-04-02", "2026-10-06")).toBe("66 anos e 6 meses");
    expect(idadeAnosEMeses("1960-10-07", "2026-10-06")).toBe("65 anos e 11 meses");
    expect(idadeAnosEMeses("2027-01-01", "2026-10-06")).toBeNull();
  });

  it("Matrícula = CNS quando iguais; senão mostra os dois", () => {
    expect(linhasMatriculaCns("700000000000099", "700000000000099")).toEqual([
      { chave: "Matrícula / CNS", valor: "700000000000099" },
    ]);
    expect(linhasMatriculaCns("M1", "C1")).toEqual([
      { chave: "Matrícula", valor: "M1" },
      { chave: "CNS", valor: "C1" },
    ]);
  });

  it("alergia ausente é PENDENTE; nega só com texto explícito", () => {
    expect(estadoAlergias([])).toEqual({ estado: "PENDENTE" });
    expect(estadoAlergias(["nenhuma alergia informada"])).toEqual({ estado: "PENDENTE" });
    expect(estadoAlergias(["nega alergias"])).toEqual({ estado: "NEGA" });
    expect(estadoAlergias(["penicilina"])).toEqual({ estado: "LISTA", itens: ["penicilina"] });
  });

  it("SEM INFORMACAO vira PENDENTE", () => {
    expect(valorOuPendente("SEM INFORMACAO")).toBe("PENDENTE");
    expect(valorOuPendente("")).toBe("PENDENTE");
    expect(valorOuPendente("Mãe Sintética")).toBe("Mãe Sintética");
  });
});
