import { describe, expect, it } from "vitest";
import { g09PtDeBiopsia } from "../../../src/kernel/harness/gates.js";

describe("G-09 · pTNM exige ressecção (D-W9-07)", () => {
  it("pT de biópsia rejeitado, mesmo com TNM explícito", () => {
    for (const specimen of ["NEEDLE_BIOPSY", "core_biopsy"]) expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true, specimen }).decisao).toBe("BLOQUEIA_ARTEFATO");
    expect(g09PtDeBiopsia({ prefixo: "yp", tnmExplicito: true, specimen: "NEEDLE_BIOPSY" }).decisao).toBe("BLOQUEIA_ARTEFATO");
  });
  it("ressecção + TNM explícito passa; sem TNM explícito é PENDENTE", () => {
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true, specimen: "SURGICAL_RESECTION" }).decisao).toBe("PASSA");
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: false, specimen: "SURGICAL_RESECTION" }).decisao).toBe("PENDENTE");
    expect(g09PtDeBiopsia({ prefixo: "p", specimen: "SURGICAL_RESECTION" }).decisao).toBe("PENDENTE");
  });
  it("cT de biópsia passa", () => expect(g09PtDeBiopsia({ prefixo: "c", tnmExplicito: true, specimen: "NEEDLE_BIOPSY" }).decisao).toBe("PASSA"));
  it("peça reconhecida pelo laudo: identificação + (margens|linfonodos|peso|dimensões)", () => {
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true, laudo: { identificacaoPecaCirurgica: true, margens: true } }).decisao).toBe("PASSA");
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true, laudo: { margens: true, linfonodos: true } }).decisao).toBe("PENDENTE");
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true, laudo: { identificacaoPecaCirurgica: true } }).decisao).toBe("PENDENTE");
  });
  it("specimen/prefixo ausente ou desconhecido nunca PASSA", () => {
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true }).decisao).toBe("PENDENTE");
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true, specimen: "ALGO" }).decisao).toBe("PENDENTE");
    expect(g09PtDeBiopsia({}).decisao).toBe("PENDENTE");
    expect(g09PtDeBiopsia({ prefixo: "r", tnmExplicito: true, specimen: "SURGICAL_RESECTION" }).decisao).toBe("PENDENTE");
  });
});
