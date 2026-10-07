// GROK-05 · cadeias RADS das 30 emergências (D-W9-51). PT08 é sintético.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  detectarEmergencias,
  lerRadsEmergencias,
  type RulesetRads,
} from "../../src/rules/radsEmergencias.js";

const rs = lerRadsEmergencias(JSON.parse(readFileSync("corpus/rulesets/rads-emergencias.v1.json", "utf8")));
const abdome = readFileSync("docs/referencias/modelos/laudos-sinteticos/PT08-tc-abdome-pelve.txt", "utf8");
const cranio = readFileSync("docs/referencias/modelos/laudos-sinteticos/PT08-tc-cranio.txt", "utf8");

describe("GROK-05 detectarEmergencias", () => {
  it("o catálogo tem as 31 linhas e a negação declarada", () => {
    expect(rs.emergencias.map((e) => e.linha)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    expect(rs.negacoes).toEqual(expect.arrayContaining(["sem sinais de", "não há", "ausência de"]));
    expect(rs.decisao).toBe("D-W9-51");
  });

  it("exclusões anulam imuno quando há infecção; tiflite exige neutropenia e exclui pneumoperitônio", () => {
    const imunoOk = detectarEmergencias(
      "Vidro fosco difuso com pneumonia em organização nos limites do campo de RT.",
      rs,
    );
    expect(imunoOk.alertas.map((a) => a.linha)).toContain(28);
    const imunoInfec = detectarEmergencias(
      "Vidro fosco com pneumonia em organização e abscesso pulmonar.",
      rs,
    );
    expect(imunoInfec.alertas.map((a) => a.linha)).not.toContain(28);
    const tiflite = detectarEmergencias(
      "Espessamento cecal com densificação pericecal em paciente com neutropenia febril.",
      rs,
    );
    expect(tiflite.alertas.map((a) => a.linha)).toContain(22);
    const tiflitePerf = detectarEmergencias(
      "Espessamento cecal com densificação pericecal e neutropenia; há pneumoperitônio.",
      rs,
    );
    expect(tiflitePerf.alertas.map((a) => a.linha)).not.toContain(22);
  });

  it("PT08 abdome alerta uropatia à direita e fratura em L5, e só essas", () => {
    const r = detectarEmergencias(abdome, rs);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.alertas.map((a) => a.linha)).toEqual([7, 27]);
    const uro = r.alertas[0];
    const fratura = r.alertas[1];
    expect(uro?.nome).toBe("Uropatia obstrutiva maligna");
    expect(uro?.estado).toBe("ALERTA");
    expect(uro?.confirmadoPeloMedico).toBe(false);
    expect(uro?.bloqueiaSalvar).toBe(false);
    expect(uro?.lateralidade).toBe("direita");
    expect(uro?.trecho.toLowerCase()).toContain("hidronefrose");
    expect(uro?.trecho.toLowerCase()).toContain("afilamento");
    expect(uro?.motivo).toContain("D-W9-51");
    expect(fratura?.nome).toBe("Fratura patológica iminente");
    expect(fratura?.nivel).toBe("L5");
    expect(fratura?.trecho).toContain("L5");
    expect(fratura?.confirmadoPeloMedico).toBe(false);
  });

  it("PT08 crânio não gera alerta", () => {
    const r = detectarEmergencias(cranio, rs);
    expect(r.alertas).toEqual([]);
    expect(r.bloqueiaSalvar).toBe(false);
  });

  it("negação anula o elo e a ordem da cadeia é a do ruleset", () => {
    const negada = detectarEmergencias(
      "Não há sinais de hidronefrose. Ausência de afilamento do parênquima.",
      rs,
    );
    expect(negada.alertas).toEqual([]);
    const invertida = detectarEmergencias(
      "Afilamento do parênquima renal antes da hidronefrose acentuada.",
      rs,
    );
    expect(invertida.alertas.map((a) => a.linha)).not.toContain(7);
    const solta: RulesetRads = { ...rs, ordemObrigatoria: false };
    expect(detectarEmergencias(
      "Afilamento do parênquima renal antes da hidronefrose acentuada.",
      solta,
    ).alertas.map((a) => a.linha)).toContain(7);
  });

  it("elos longe demais não fecham a cadeia; a distância vem do ruleset", () => {
    const longe = `Hidronefrose acentuada. ${"x ".repeat(300)}Afilamento do parênquima renal.`;
    expect(detectarEmergencias(longe, rs).alertas.map((a) => a.linha)).not.toContain(7);
    const perto: RulesetRads = { ...rs, proximidade: 2000 };
    expect(detectarEmergencias(longe, perto).alertas.map((a) => a.linha)).toContain(7);
  });

  it("a cadeia não está presa às linhas 7 e 27", () => {
    const medula = detectarEmergencias(
      "Massa epidural com apagamento do saco dural e compressão medular.",
      rs,
    );
    expect(medula.alertas.map((a) => a.linha)).toEqual([1]);
    expect(medula.alertas[0]?.bloqueiaSalvar).toBe(false);
    const nada = detectarEmergencias("Hérnia umbilical. Veia cava de calibre habitual. Nódulos hepáticos.", rs);
    expect(nada.alertas).toEqual([]);
    const semLitica: RulesetRads = {
      ...rs,
      emergencias: rs.emergencias.map((e) => e.linha === 27
        ? { ...e, elos: e.elos.map((elo) => elo.id === "litica" ? { ...elo, sinonimos: ["termo-que-nao-existe"] } : elo) }
        : e),
    };
    expect(detectarEmergencias(abdome, semLitica).alertas.map((a) => a.linha)).toEqual([7]);
  });
});
