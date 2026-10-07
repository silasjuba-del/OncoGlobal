// GROK-02 · limiar de bula abre o ciclo; grau CTCAE só candidata toxicidade (D-W9-22a).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  grauCtcae,
  lerSalaoCtcae,
  portaCiclo,
  type LabsCiclo,
  type ProtocoloCiclo,
  type SalaoCtcae,
} from "../../src/rules/portaCiclo.js";

const rs = lerSalaoCtcae(JSON.parse(readFileSync("corpus/rulesets/salao-ctcae.v1.json", "utf8")));

const labs = (over: Partial<LabsCiclo> = {}): LabsCiclo => ({
  anc: 2000,
  plq: 200000,
  clearance: 80,
  feve: 60,
  ...over,
});

const bula = (limiares: ProtocoloCiclo["limiares"], portaPorGrau: ProtocoloCiclo["portaPorGrau"] = null): ProtocoloCiclo => ({
  protocoloId: "sintetico-bula",
  versao: "1",
  limiares,
  portaPorGrau,
});

describe("GROK-02 portaCiclo", () => {
  it("N 1200 com porta grau ≥ 2 não solta: a bula 1500 segura", () => {
    const grau = grauCtcae("neutrofilos", 1200, rs);
    expect(grau.grau).toBe(1);
    expect(grau.grau).not.toBe(0);
    const porta = portaCiclo(
      labs({ anc: 1200 }),
      bula([{ codigo: "anc", minimo: 1500 }], { grauMinimo: 2 }),
      rs,
    );
    expect(porta.solta).toBe(false);
    expect(porta.destino).toBe("FILA_MEDICO");
    expect(porta.bloqueiaSalvar).toBe(false);
    expect(porta.grauUsadoNaPorta).toBe(false);
    expect(porta.motivos.map((m) => m.codigo)).toEqual(["portaCiclo.anc.abaixo"]);
    expect(porta.motivos[0]?.texto).toContain("1200");
    expect(porta.motivos[0]?.texto).toContain("1500");
    expect(porta.motivos[0]?.texto).toContain("D-W9-22a");
  });

  it("só a porta de grau, sem limiar de bula, não solta", () => {
    const porta = portaCiclo(labs({ anc: 1200 }), bula([], { grauMinimo: 2 }), rs);
    expect(porta.solta).toBe(false);
    expect(porta.grauUsadoNaPorta).toBe(false);
    expect(porta.pendentes.map((m) => m.codigo)).toContain("pendente.portaCiclo.limiares");
    expect(porta.bloqueiaSalvar).toBe(false);
  });

  it("código grau no protocolo não entra na lista da bula", () => {
    const porta = portaCiclo(
      labs(),
      bula([{ codigo: "grau" as "anc", minimo: 2 }]),
      rs,
    );
    expect(porta.solta).toBe(false);
    expect(porta.pendentes.map((m) => m.codigo)).toContain("pendente.portaCiclo.codigo");
  });

  it("igual ao mínimo passa; um abaixo não solta", () => {
    expect(portaCiclo(labs({ anc: 1500 }), bula([{ codigo: "anc", minimo: 1500 }]), rs).solta).toBe(true);
    expect(portaCiclo(labs({ anc: 1499 }), bula([{ codigo: "anc", minimo: 1500 }]), rs).solta).toBe(false);
    expect(portaCiclo(labs({ plq: 100000 }), bula([{ codigo: "plq", minimo: 100000 }]), rs).solta).toBe(true);
    expect(portaCiclo(labs({ plq: 99999 }), bula([{ codigo: "plq", minimo: 100000 }]), rs).solta).toBe(false);
    expect(portaCiclo(labs({ clearance: 60 }), bula([{ codigo: "clearance", minimo: 60 }]), rs).solta).toBe(true);
    expect(portaCiclo(labs({ clearance: 59 }), bula([{ codigo: "clearance", minimo: 60 }]), rs).solta).toBe(false);
    expect(portaCiclo(labs({ feve: 50 }), bula([{ codigo: "feve", minimo: 50 }]), rs).solta).toBe(true);
    const feve = portaCiclo(labs({ feve: 49 }), bula([{ codigo: "feve", minimo: 50 }]), rs);
    expect(feve.solta).toBe(false);
    expect(feve.bloqueiaSalvar).toBe(false);
    expect(feve.destino).toBe("FILA_MEDICO");
  });

  it("ausente é PENDENTE e não vira 0", () => {
    const porta = portaCiclo(labs({ anc: null }), bula([{ codigo: "anc", minimo: 0 }]), rs);
    expect(porta.solta).toBe(false);
    expect(porta.motivos).toEqual([]);
    expect(porta.pendentes.map((m) => m.codigo)).toContain("pendente.portaCiclo.anc");
  });

  it("um limiar que falha segura os outros que passam", () => {
    const porta = portaCiclo(
      labs({ anc: 1200, plq: 100000, clearance: 60, feve: 50 }),
      bula([
        { codigo: "anc", minimo: 1500 },
        { codigo: "plq", minimo: 100000 },
        { codigo: "clearance", minimo: 60 },
        { codigo: "feve", minimo: 50 },
      ]),
      rs,
    );
    expect(porta.solta).toBe(false);
    expect(porta.motivos.map((m) => m.codigo)).toEqual(["portaCiclo.anc.abaixo"]);
  });

  it("o mínimo vem do protocolo, não de constante no código", () => {
    const baixo = portaCiclo(labs({ anc: 1200 }), bula([{ codigo: "anc", minimo: 1000 }]), rs);
    expect(baixo.solta).toBe(true);
    expect(baixo.destino).toBe("SEM_FILA");
    expect(baixo.bloqueiaSalvar).toBe(false);
  });
});

describe("GROK-02 grauCtcae v6", () => {
  it("N 1000 = G1 e 999 = G2; ausente e fora da faixa não viram 0", () => {
    expect(grauCtcae("neutrofilos", 1000, rs)).toMatchObject({ grau: 1, estado: "PENDENTE", confirmadoPeloMedico: false });
    expect(grauCtcae("neutrofilos", 999, rs).grau).toBe(2);
    expect(grauCtcae("neutrofilos", 1500, rs).grau).toBeNull();
    expect(grauCtcae("neutrofilos", 1499, rs).grau).toBe(1);
    expect(grauCtcae("neutrofilos", null, rs).grau).toBeNull();
    expect(grauCtcae("neutrofilos", 2000, rs).grau).toBeNull();
    expect(grauCtcae("neutrofilos", 0, rs).grau).toBe(4);
    for (const r of [
      grauCtcae("neutrofilos", null, rs),
      grauCtcae("neutrofilos", 2000, rs),
      grauCtcae("neutrofilos", 1000, rs),
    ]) {
      expect(r.grau).not.toBe(0);
      expect(r.estado).toBe("PENDENTE");
      expect(r.motivo).toContain("D-W9-22a");
    }
  });

  it("Hb 8,0 (80 dg/dL) = G2 e 79 = G3", () => {
    expect(grauCtcae("hemoglobina", 80, rs).grau).toBe(2);
    expect(grauCtcae("hemoglobina", 79, rs).grau).toBe(3);
    expect(grauCtcae("hemoglobina", 100, rs).grau).toBeNull();
    expect(grauCtcae("hemoglobina", 99, rs).grau).toBe(2);
  });

  it("PLQ 10000 = G3 e 9999 = G4", () => {
    expect(grauCtcae("plaquetas", 10000, rs).grau).toBe(3);
    expect(grauCtcae("plaquetas", 9999, rs).grau).toBe(4);
    expect(grauCtcae("plaquetas", 50000, rs).grau).toBe(2);
    expect(grauCtcae("plaquetas", 49999, rs).grau).toBe(3);
  });

  it("a faixa vem do ruleset", () => {
    const copia: SalaoCtcae = structuredClone(rs);
    const neutro = copia.termos.neutrofilos;
    expect(neutro).toBeDefined();
    if (neutro === undefined) return;
    neutro.faixas = [{ grau: 2, minInclusivo: 0, maxExclusivo: 10 }];
    expect(grauCtcae("neutrofilos", 999, copia).grau).toBeNull();
    expect(grauCtcae("neutrofilos", 5, copia).grau).toBe(2);
  });
});
