import { describe, expect, it } from "vitest";
import { avaliarChip } from "../../src/modules/estoque/chip.js";

const VALIDADE = { dias: 2, fonte: "pack-estoque-teste" };
const HOJE = "2026-10-05";

describe("GRK-07 chip de estoque", () => {
  it("positivo: leitura dentro da janela informa disponibilidade com origem e data, sem travar", () => {
    const chip = avaliarChip(
      { origem: "almox-teste", data: "2026-10-04", estado: "INDISPONIVEL" },
      HOJE,
      VALIDADE,
    );
    expect(chip.estado).toBe("INDISPONIVEL");
    expect(chip.origem).toBe("almox-teste");
    expect(chip.data).toBe("2026-10-04");
    expect(chip.trava).toBe(false);
    expect(chip.sugereTroca).toBe(false);
  });

  it("negativo: sem leitura, sem origem ou sem fonte da validade → DESCONHECIDO", () => {
    expect(avaliarChip(null, HOJE, VALIDADE).estado).toBe("DESCONHECIDO");
    expect(avaliarChip({ origem: " ", data: HOJE, estado: "DISPONIVEL" }, HOJE, VALIDADE)).toMatchObject({
      estado: "DESCONHECIDO", trava: false, sugereTroca: false,
    });
    const semFonte = avaliarChip(
      { origem: "almox-teste", data: HOJE, estado: "DISPONIVEL" },
      HOJE,
      { dias: 2, fonte: "" },
    );
    expect(semFonte.estado).toBe("DESCONHECIDO");
    expect(semFonte.motivo).toContain("[VERIFICAR]");
    expect(semFonte.sugereTroca).toBe(false);
  });

  it("borda: idade igual ao limite permanece; um dia além, data futura ou inválida vira DESCONHECIDO", () => {
    const noLimite = avaliarChip(
      { origem: "almox-teste", data: "2026-10-03", estado: "DISPONIVEL" },
      HOJE,
      VALIDADE,
    );
    expect(noLimite.estado).toBe("DISPONIVEL");

    const velho = avaliarChip(
      { origem: "almox-teste", data: "2026-10-02", estado: "DISPONIVEL" },
      HOJE,
      VALIDADE,
    );
    expect(velho.estado).toBe("DESCONHECIDO");
    expect(velho.motivo).toBe("dado velho");
    expect(velho.trava).toBe(false);
    expect(velho.sugereTroca).toBe(false);

    expect(avaliarChip(
      { origem: "almox-teste", data: "2026-10-06", estado: "DISPONIVEL" },
      HOJE,
      VALIDADE,
    ).estado).toBe("DESCONHECIDO");
    expect(avaliarChip(
      { origem: "almox-teste", data: "2026-02-31", estado: "DISPONIVEL" },
      HOJE,
      VALIDADE,
    ).estado).toBe("DESCONHECIDO");
  });
});
