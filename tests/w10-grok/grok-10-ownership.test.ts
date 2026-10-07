// GROK-10 · G-16 write por dono (K-21). O adv t56 ainda importa gates.ts, fora desta faixa.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { g16Owner, lerCatalogoDonos } from "../../src/kernel/harness/ownership.js";

const catalogo = lerCatalogoDonos(JSON.parse(readFileSync("corpus/capabilities.v1.json", "utf8")));

describe("GROK-10 g16Owner", () => {
  it("write alheio bloqueia autoridade e nomeia o dono declarado", () => {
    const v = g16Owner({ agenteId: "AG-04", objetoTipo: "Conversation", operacao: "write" }, catalogo);
    expect(v.gate).toBe("G-16");
    expect(v.decisao).toBe("BLOQUEIA_AUTORIDADE");
    expect(v.motivo).toContain("AG-14");
    expect(v.motivo).toContain("K-21");
  });

  it("o dono escrevendo no próprio objeto passa", () => {
    const v = g16Owner({ agenteId: "AG-14", objetoTipo: "Conversation", operacao: "write" }, catalogo);
    expect(v.decisao).toBe("PASSA");
    expect(v.gate).toBe("G-16");
  });

  it("leitura de objeto alheio passa", () => {
    const v = g16Owner({ agenteId: "AG-04", objetoTipo: "Conversation", operacao: "read" }, catalogo);
    expect(v.decisao).toBe("PASSA");
  });

  it("AG-04 escreve ImagingStudy, objeto de que é dono", () => {
    expect(g16Owner({ agenteId: "AG-04", objetoTipo: "ImagingStudy", operacao: "WRITE" }, catalogo).decisao).toBe("PASSA");
  });

  it("catálogo real tem um dono por objeto", () => {
    const donos = new Map<string, string[]>();
    for (const agente of catalogo.agentes) {
      for (const objeto of agente.ownerOf) {
        const lista = donos.get(objeto) ?? [];
        lista.push(agente.id);
        donos.set(objeto, lista);
      }
    }
    for (const [objeto, agentes] of donos) expect(agentes, objeto).toHaveLength(1);
  });

  it("dono duplicado, objeto sem dono e campo ausente não passam como write", () => {
    const duplicado = lerCatalogoDonos({
      agentes: [
        { id: "AG-14", ownerOf: ["Conversation"] },
        { id: "AG-04", ownerOf: ["Conversation"] },
      ],
    });
    const conflito = g16Owner({ agenteId: "AG-14", objetoTipo: "Conversation", operacao: "write" }, duplicado);
    expect(conflito.decisao).toBe("BLOQUEIA_AUTORIDADE");
    expect(conflito.motivo).toContain("AG-14");
    expect(conflito.motivo).toContain("AG-04");

    const semDono = g16Owner(
      { agenteId: "AG-14", objetoTipo: "ObjetoNaoDeclarado", operacao: "write" },
      { agentes: [{ id: "AG-14", ownerOf: ["Conversation"] }] },
    );
    expect(semDono.decisao).toBe("BLOQUEIA_AUTORIDADE");

    expect(g16Owner({ objetoTipo: "Conversation", operacao: "write" }, catalogo).decisao).toBe("PENDENTE");
    expect(g16Owner({ agenteId: "AG-14", objetoTipo: "Conversation", operacao: "inventada" }, catalogo).decisao).toBe("PENDENTE");
  });

  it("sem catálogo injetado, a função lê capabilities.v1.json", () => {
    const v = g16Owner({ agenteId: "AG-04", objetoTipo: "Conversation", operacao: "write" });
    expect(v.decisao).toBe("BLOQUEIA_AUTORIDADE");
    expect(v.motivo).toContain("AG-14");
  });
});
