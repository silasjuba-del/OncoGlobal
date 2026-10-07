import { describe, expect, it } from "vitest";
import { g08AnatomiaSexo } from "../../../src/kernel/harness/gates.js";

describe("G-08 · anatomia × sexo (D-W9-06)", () => {
  it.each([["prostata", "F"], ["Próstata", "F"], ["utero", "M"], ["ovário", "M"], ["pênis", "F"], ["vulva", "M"], ["vagina", "M"], ["testículo", "F"]])(
    "%s × %s ⇒ ALERTA (nunca bloqueio)", (anatomia, sexoCadastral) => {
      const v = g08AnatomiaSexo({ anatomia, sexoCadastral });
      expect(v.decisao).toBe("ALERTA");
      expect(v.motivo).toContain("cadastro");
    });
  it.each([["prostata", "M"], ["penis", "M"], ["testiculo", "M"], ["utero", "F"], ["ovario", "F"], ["vulva", "F"], ["mama", "F"]])("%s × %s coerente passa", (anatomia, sexoCadastral) =>
    expect(g08AnatomiaSexo({ anatomia, sexoCadastral }).decisao).toBe("PASSA"));
  it("mama × M não é incoerência: só conferir (PENDENTE)", () => expect(g08AnatomiaSexo({ anatomia: "mama", sexoCadastral: "M" }).decisao).toBe("PENDENTE"));
  it.each(["NAO_INFORMADO", "OUTRO", "", undefined, null])("sexo %s com anatomia restrita ⇒ PENDENTE", (sexoCadastral) =>
    expect(g08AnatomiaSexo({ anatomia: "prostata", sexoCadastral }).decisao).toBe("PENDENTE"));
  it("anatomia ausente ⇒ PENDENTE; anatomia sem restrição passa", () => {
    expect(g08AnatomiaSexo({ sexoCadastral: "F" }).decisao).toBe("PENDENTE");
    expect(g08AnatomiaSexo({ anatomia: "pulmao", sexoCadastral: "F" }).decisao).toBe("PASSA");
  });
});
