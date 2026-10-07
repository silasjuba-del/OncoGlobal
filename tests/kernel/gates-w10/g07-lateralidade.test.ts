import { describe, expect, it } from "vitest";
import { g07Lateralidade } from "../../../src/kernel/harness/gates.js";

const base = { path: "DIREITO", rads: "DIREITA", procedimento: "direito", diagnostico: "D" };

describe("G-07 · lateralidade (D-W9-05)", () => {
  it("sinônimos concordantes passam", () => expect(g07Lateralidade({ orgao: "mama", ...base }).decisao).toBe("PASSA"));
  it("cólon aceita TRANSVERSO; mama não", () => {
    const t = { path: "TRANSVERSO", rads: "transverso", procedimento: "TRANSVERSO", diagnostico: "TRANSVERSO" };
    expect(g07Lateralidade({ orgao: "Cólon", ...t }).decisao).toBe("PASSA");
    expect(g07Lateralidade({ orgao: "mama", ...t }).decisao).toBe("ALERTA");
  });
  it("divergência ⇒ ALERTA com revisão, nunca bloqueio", () => {
    const v = g07Lateralidade({ ...base, rads: "ESQUERDA" });
    expect(v.decisao).toBe("ALERTA");
    expect(v.motivo).toContain("revisão");
  });
  it.each([null, undefined, "", "NAO_INFORMADO", "  ", 5])("fonte ausente (%s) ⇒ PENDENTE", (x) => {
    expect(g07Lateralidade({ ...base, procedimento: x }).decisao).toBe("PENDENTE");
  });
  it("divergência prevalece sobre ausência", () => expect(g07Lateralidade({ ...base, path: null, rads: "ESQUERDA" }).decisao).toBe("ALERTA"));
  it("valor fora do vocabulário ⇒ ALERTA (não PASSA)", () =>
    expect(g07Lateralidade({ ...base, path: "BILATERAL", rads: "BILATERAL", procedimento: "BILATERAL", diagnostico: "BILATERAL" }).decisao).toBe("ALERTA"));
  it("órgão fora da tabela não exige lateralidade", () => expect(g07Lateralidade({ orgao: "figado", path: null }).decisao).toBe("PASSA"));
  it("entrada vazia/lixo nunca PASSA", () => {
    expect(g07Lateralidade({}).decisao).toBe("PENDENTE");
    expect(g07Lateralidade(undefined as never).decisao).toBe("PENDENTE");
  });
});
