// GLM-10 · registro de capacidades: cada item valida como AgentSpec (C-18); PHI nunca permitido (INV-12).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { AgentSpec, CapabilityStatus } from "../../src/contracts/index.js";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

type Spec = z.infer<typeof AgentSpec>;
const arquivo = fileURLToPath(new URL("../../corpus/capabilities.v1.json", import.meta.url));
const json = JSON.parse(readFileSync(arquivo, "utf8")) as { agentes: Spec[]; metadados: Record<string, { nome: string; fase: string; dono: string }> };

const ESPERADOS = ["AG-01", "AG-02", "AG-03", "AG-04", "AG-05", "AG-06", "AG-07", "AG-08", "AG-11", "AG-13", "AG-14", "AG-15", "AG-16", "AG-19", "AG-20"];

function* pares(valor: unknown): Generator<unknown> {
  if (Array.isArray(valor)) { for (const v of valor) yield* pares(v); return; }
  if (typeof valor === "object" && valor !== null) {
    yield valor;
    for (const v of Object.values(valor)) yield* pares(v);
  }
}

describe("capabilities.v1.json", () => {
  it("header passa na validação G-17", () => {
    expect(validarRuleset(json).ok).toBe(true);
  });

  it("os 15 agentes pós-cortes (AG-09/10/12/17/18 viraram funções) validam como AgentSpec", () => {
    expect(json.agentes.map((a) => a.id)).toEqual(ESPERADOS);
    for (const a of json.agentes) {
      const r = AgentSpec.safeParse(a);
      if (!r.success) throw new Error(`${a.id}: ${r.error.message}`);
      expect(a.extractor).toBeNull(); // nenhum microprompt existe ainda no corpus — nada inventado
    }
  });

  it("nenhum phiAllowed true em nenhum nível (INV-12)", () => {
    for (const o of pares(json))
      for (const [k, v] of Object.entries(o as Record<string, unknown>))
        if (k === "phiAllowed") expect(v).not.toBe(true);
  });

  it("status coerente: só AG-15 TESTED (FN-01/02/03/06/09 verdes), AG-20 DISABLED, demais SPECIFIED", () => {
    const por = Object.fromEntries(json.agentes.map((a) => [a.id, a.capabilityStatus]));
    for (const id of ESPERADOS)
      if (!["AG-15", "AG-20"].includes(id)) expect(por[id], id).toBe("SPECIFIED");
    expect(por["AG-15"]).toBe("TESTED");
    expect(por["AG-20"]).toBe("DISABLED");
    for (const a of json.agentes) expect(CapabilityStatus.options).toContain(a.capabilityStatus);
  });

  it("metadados cobrem todos os agentes com nome e fase do plano (R-13)", () => {
    expect(Object.keys(json.metadados).sort()).toEqual([...ESPERADOS].sort());
    for (const [id, m] of Object.entries(json.metadados)) {
      expect(m.nome.length, id).toBeGreaterThan(0);
      expect(m.fase.length, id).toBeGreaterThan(0);
    }
  });
});
