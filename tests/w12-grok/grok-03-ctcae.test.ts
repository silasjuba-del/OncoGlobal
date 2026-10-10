// W12-GROK-03 · termos clínicos da CTCAE v6 no corpus. 25.000 não é limite G4 (D-W9-73).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { grauCtcae, lerSalaoCtcae } from "../../src/rules/portaCiclo.js";

const arquivo = "corpus/rulesets/salao-ctcae.v1.json";
const md = readFileSync("docs/referencias/onco-referencia/02-ctcae-v6.md", "utf8");
const json = JSON.parse(readFileSync(arquivo, "utf8")) as {
  header: { versao: string };
  graus: {
    termos: Record<string, { faixas: Array<{ grau: number; maxExclusivo?: number; minInclusivo?: number }> }>;
    termosClinicos: Record<string, {
      ativo?: boolean;
      status?: string;
      fonte?: { trecho?: string };
      graus?: Array<{ grau: number; texto: string }>;
      nota?: string;
    }>;
  };
};

const PEDIDOS = ["diarreia", "nausea", "vomito", "mucositeOral", "fadiga", "neuropatiaPerifericaSensitiva", "febre"];

describe("W12-GROK-03 corpus clínico v6", () => {
  it("sobe para 1.1.0 e cada termo pedido tem trecho literal no arquivo v6", () => {
    expect(json.header.versao).toBe("1.1.0");
    for (const id of PEDIDOS) {
      const termo = json.graus.termosClinicos[id];
      expect(termo, id).toBeDefined();
      expect(termo?.ativo).toBe(true);
      expect(termo?.status).toBe("VERIFICADO");
      const trecho = termo?.fonte?.trecho ?? "";
      expect(trecho.length).toBeGreaterThan(0);
      expect(md).toContain(trecho);
      for (const grau of termo?.graus ?? []) {
        expect(md, `${id} G${grau.grau}`).toContain(grau.texto);
      }
    }
  });

  it("termo sem trecho no repositório ficaria inativo", () => {
    const semTrecho = Object.entries(json.graus.termosClinicos).filter(([, t]) => t.ativo === false);
    for (const [, termo] of semTrecho) {
      expect(termo.status).toBe("NAO_VERIFICADO");
      expect(termo.fonte?.trecho ?? "").toBe("");
    }
  });

  it("25.000 não aparece como limite G4 de plaquetas (v6 pura, D-W9-73)", () => {
    const texto = readFileSync(arquivo, "utf8");
    expect(texto).not.toContain("25000");
    expect(texto).not.toContain("25.000");
    expect(texto).not.toContain("25,000");
    const faixas = json.graus.termos.plaquetas?.faixas ?? [];
    const g4 = faixas.find((f) => f.grau === 4);
    expect(g4?.maxExclusivo).toBe(10000);
    expect(g4?.minInclusivo).toBeUndefined();
    const rs = lerSalaoCtcae(json);
    expect(grauCtcae("plaquetas", 25000, rs).grau).toBe(3);
    expect(grauCtcae("plaquetas", 10000, rs).grau).toBe(3);
    expect(grauCtcae("plaquetas", 9999, rs).grau).toBe(4);
  });
});
