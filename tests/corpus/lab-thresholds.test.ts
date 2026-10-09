// GLM-02 · lab-thresholds: header válido (G-17). D-W9-58 ativou CREAT (4 analitos do salão).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

interface Analito {
  codigo: string; nome: string; unidadeCanonica: string | null;
  limiarInferior: number | null; limiarSuperior: number | null;
  ativo: boolean; fonte: { tipo: string; referencia: string; trecho: string | null };
}
const arquivo = fileURLToPath(new URL("../../corpus/rulesets/lab-thresholds.v1.json", import.meta.url));
const json = JSON.parse(readFileSync(arquivo, "utf8")) as { analitos: Analito[] };

describe("lab-thresholds.v1.json", () => {
  it("header passa na validação G-17", () => {
    expect(validarRuleset(json).ok).toBe(true);
  });

  it("exatamente 4 analitos ativos: HB, ANC, PLQ e CREAT 150 (D-W9-37/58)", () => {
    const ativos = json.analitos.filter((a) => a.ativo);
    expect(ativos.map((a) => a.codigo).sort()).toEqual(["ANC", "CREAT", "HB", "PLQ"]);
    const por = (cod: string) => ativos.find((a) => a.codigo === cod) as Analito;
    expect(por("HB")).toMatchObject({ unidadeCanonica: "dg/dL", limiarInferior: 80, limiarSuperior: null });
    expect(por("ANC")).toMatchObject({ unidadeCanonica: "/µL", limiarInferior: 1500, limiarSuperior: null });
    expect(por("PLQ")).toMatchObject({ unidadeCanonica: "/µL", limiarInferior: 100000, limiarSuperior: null });
    expect(por("CREAT")).toMatchObject({ unidadeCanonica: "centésimos de mg/dL", limiarInferior: null, limiarSuperior: 150 });
    for (const a of ativos) expect(a.fonte.referencia).toContain("salao-triagem.v1");
  });

  it("todo analito inativo tem limiares null e fonte [VERIFICAR] (nada decide limiar sem fonte)", () => {
    expect(json.analitos.length).toBe(22);
    for (const a of json.analitos.filter((x) => !x.ativo)) {
      expect(a.limiarInferior).toBeNull();
      expect(a.limiarSuperior).toBeNull();
      expect(a.unidadeCanonica).toBeNull();
      expect(a.fonte.referencia).toBe("[VERIFICAR]");
    }
  });

  it("analito ativo sempre com fonte (DECISAO_MEDICA do salão)", () => {
    for (const a of json.analitos.filter((x) => x.ativo)) {
      expect(a.fonte.tipo).toBe("DECISAO_MEDICA");
      expect(a.fonte.referencia.length).toBeGreaterThan(0);
    }
  });
});
