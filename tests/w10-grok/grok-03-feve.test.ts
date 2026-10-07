// GROK-03 · FEVE < 50% com antraciclina ou anti-HER2 programado é alerta (D-W9-34b).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  alertarFeve,
  lerAlertaFeve,
  type EntradaAlertaFeve,
  type RulesetAlertaFeve,
} from "../../src/rules/alertaFeve.js";

const rs = lerAlertaFeve(JSON.parse(readFileSync("corpus/rulesets/salao-feve.v1.json", "utf8")));

const entrada = (over: Partial<EntradaAlertaFeve> = {}): EntradaAlertaFeve => ({
  feve: { percentual: 60, metodo: "Simpson", data: "2026-03-01" },
  programados: [{ nome: "doxorrubicina", classe: null }],
  ...over,
});

describe("GROK-03 alertarFeve", () => {
  it("49% com doxorrubicina alerta e cita valor, método e data", () => {
    const r = alertarFeve(entrada({ feve: { percentual: 49, metodo: "Simpson", data: "2026-03-01" } }), rs);
    expect(r.estado).toBe("ALERTA");
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.percentual).toBe(49);
    expect(r.motivos[0]?.texto).toContain("49%");
    expect(r.motivos[0]?.texto).toContain("Simpson");
    expect(r.motivos[0]?.texto).toContain("2026-03-01");
    expect(r.motivos[0]?.texto).toContain("doxorrubicina");
    expect(r.motivos[0]?.texto).toContain("D-W9-34b");
    expect(r.farmacos).toEqual(["doxorrubicina"]);
  });

  it("50% passa; 49,5 alerta; o limite vem do ruleset", () => {
    expect(alertarFeve(entrada({ feve: { percentual: 50, metodo: "Simpson", data: "2026-03-01" } }), rs).estado).toBe("SEM_ALERTA");
    expect(alertarFeve(entrada({ feve: { percentual: 49.5, metodo: "Simpson", data: "2026-03-01" } }), rs).estado).toBe("ALERTA");
    const baixo: RulesetAlertaFeve = { ...rs, limiteExclusivo: 40 };
    expect(alertarFeve(entrada({ feve: { percentual: 45, metodo: "Simpson", data: "2026-03-01" } }), baixo).estado).toBe("SEM_ALERTA");
    expect(alertarFeve(entrada({ feve: { percentual: 39, metodo: "Simpson", data: "2026-03-01" } }), baixo).estado).toBe("ALERTA");
  });

  it("FEVE ausente com trastuzumabe fica PENDENTE e não vira 0", () => {
    const r = alertarFeve(entrada({
      feve: { percentual: null, metodo: null, data: null },
      programados: [{ nome: "trastuzumabe", classe: "anti-HER2" }],
    }), rs);
    expect(r.estado).toBe("PENDENTE");
    expect(r.percentual).toBeNull();
    expect(r.motivos).toEqual([]);
    expect(r.pendentes[0]?.codigo).toBe("pendente.feve.ausente");
    expect(r.pendentes[0]?.texto).toContain("ausente");
    expect(r.pendentes[0]?.texto).not.toContain("0%");
    expect(r.bloqueiaSalvar).toBe(false);
  });

  it("FEVE medida 0 alerta; é valor, não ausência", () => {
    const r = alertarFeve(entrada({ feve: { percentual: 0, metodo: "Simpson", data: "2026-03-01" } }), rs);
    expect(r.estado).toBe("ALERTA");
    expect(r.percentual).toBe(0);
    expect(r.motivos[0]?.texto).toContain("0%");
  });

  it("sem antraciclina nem anti-HER2 não alerta, mesmo com FEVE baixa ou ausente", () => {
    const baixa = alertarFeve(entrada({
      feve: { percentual: 40, metodo: "Simpson", data: "2026-03-01" },
      programados: [{ nome: "paclitaxel", classe: null }],
    }), rs);
    expect(baixa.estado).toBe("SEM_ALERTA");
    expect(baixa.motivos).toEqual([]);
    const ausente = alertarFeve(entrada({
      feve: { percentual: null, metodo: null, data: null },
      programados: [],
    }), rs);
    expect(ausente.estado).toBe("SEM_ALERTA");
    expect(ausente.pendentes).toEqual([]);
  });

  it("método ou data ausentes continuam no alerta como pendência", () => {
    const r = alertarFeve(entrada({ feve: { percentual: 42, metodo: null, data: "  " } }), rs);
    expect(r.estado).toBe("ALERTA");
    expect(r.motivos[0]?.texto).toContain("método ausente");
    expect(r.motivos[0]?.texto).toContain("data ausente");
    expect(r.pendentes.map((p) => p.codigo)).toEqual(["pendente.feve.metodo", "pendente.feve.data"]);
    expect(r.bloqueiaSalvar).toBe(false);
  });

  it("reconhece a classe pelo nome e pelos sinônimos do ruleset", () => {
    const r = alertarFeve(entrada({
      programados: [
        { nome: "cloridrato de doxorrubicina", classe: null },
        { nome: "T-DXd", classe: null },
        { nome: "paclitaxel", classe: null },
      ],
    }), rs);
    expect(r.farmacos).toEqual(["cloridrato de doxorrubicina", "T-DXd"]);
    const semDoxo: RulesetAlertaFeve = {
      ...rs,
      classes: rs.classes.map((c) => c.id === "antraciclina"
        ? { ...c, sinonimos: c.sinonimos.filter((s) => s !== "doxorrubicina" && s !== "doxorubicina" && s !== "adriamicina") }
        : c),
    };
    const sumiu = alertarFeve(entrada({
      feve: { percentual: 40, metodo: "Simpson", data: "2026-03-01" },
      programados: [{ nome: "doxorrubicina", classe: null }],
    }), semDoxo);
    expect(sumiu.estado).toBe("SEM_ALERTA");
  });
});
