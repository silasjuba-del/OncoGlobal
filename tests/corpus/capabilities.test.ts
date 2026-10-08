// GLM-10 · registro de capacidades: cada item valida como AgentSpec (C-18); PHI nunca permitido (INV-12).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { AgentSpec, CapabilityStatus } from "../../src/contracts/index.js";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

type Spec = z.infer<typeof AgentSpec>;
const arquivo = fileURLToPath(new URL("../../corpus/capabilities.v1.json", import.meta.url));
const json = JSON.parse(readFileSync(arquivo, "utf8")) as { agentes: Spec[]; metadados: Record<string, { nome: string; fase: string; dono: string; planejado?: { microprompt: string | null; ruleset: string | null } }> };

const ESPERADOS = ["AG-01", "AG-02", "AG-03", "AG-04", "AG-05", "AG-06", "AG-07", "AG-08", "AG-11", "AG-13", "AG-14", "AG-15", "AG-16", "AG-19", "AG-20", "AG-21", "AG-22", "AG-23"];
const DESLIGADOS = ["AG-20", "AG-21", "AG-22", "AG-23"];

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

  it("15 agentes pós-cortes + 3 módulos do centro de comando (W8/GLM-19) validam como AgentSpec", () => {
    expect(json.agentes.map((a) => a.id)).toEqual(ESPERADOS);
    for (const a of json.agentes) {
      const r = AgentSpec.safeParse(a);
      if (!r.success) throw new Error(`${a.id}: ${r.error.message}`);
      expect(a.extractor).toBeNull(); // wiring (tokenBudget/timeoutMs) é [VERIFICAR] até a tabela do Maestro — nada inventado
    }
  });

  it("nenhum phiAllowed true em nenhum nível (INV-12)", () => {
    for (const o of pares(json))
      for (const [k, v] of Object.entries(o as Record<string, unknown>))
        if (k === "phiAllowed") expect(v).not.toBe(true);
  });

  it("status coerente: só AG-15 TESTED (FN-01/02/03/06/09 verdes), centro de comando + AG-20 DISABLED, demais SPECIFIED", () => {
    const por = Object.fromEntries(json.agentes.map((a) => [a.id, a.capabilityStatus]));
    for (const id of ESPERADOS)
      if (!["AG-15", ...DESLIGADOS].includes(id)) expect(por[id], id).toBe("SPECIFIED");
    expect(por["AG-15"]).toBe("TESTED");
    for (const id of DESLIGADOS) expect(por[id], id).toBe("DISABLED");
    for (const a of json.agentes) expect(CapabilityStatus.options).toContain(a.capabilityStatus);
  });

  it("metadados cobrem todos os agentes com nome e fase do plano (R-13)", () => {
    expect(Object.keys(json.metadados).sort()).toEqual([...ESPERADOS].sort());
    for (const [id, m] of Object.entries(json.metadados)) {
      expect(m.nome.length, id).toBeGreaterThan(0);
      expect(m.fase.length, id).toBeGreaterThan(0);
    }
  });

  it("W8/GLM-19: prompts novos registrados em metadados.planejado existem no corpus", () => {
    const raizPrompts = fileURLToPath(new URL("../../corpus/prompts/", import.meta.url));
    const esperados = { "AG-01": "CAPTURA@1.0.0", "AG-04": "RADS@1.1.0", "AG-05": "PATH@1.1.0", "AG-13": "DOCID@1.0.0" };
    for (const [id, microprompt] of Object.entries(esperados)) {
      expect(json.metadados[id]!.planejado!.microprompt, id).toBe(microprompt);
      expect(existsSync(join(raizPrompts, `${microprompt}.md`)), `${id} -> ${microprompt}`).toBe(true);
    }
  });

  it("W8/GLM-19: módulos do centro de comando nascem DISABLED com versão de prompt [VERIFICAR]", () => {
    for (const id of ["AG-21", "AG-22", "AG-23"]) {
      expect(json.metadados[id]!.planejado!.microprompt, id).toBe("[VERIFICAR]");
      expect(json.agentes.find((a) => a.id === id)!.capabilityStatus, id).toBe("DISABLED");
    }
  });

  it("nenhuma referência concreta de microprompt pendura: toda versão declarada existe como arquivo", () => {
    const raizPrompts = fileURLToPath(new URL("../../corpus/prompts/", import.meta.url));
    for (const [id, m] of Object.entries(json.metadados)) {
      const microprompt = m.planejado?.microprompt;
      if (microprompt === null || microprompt === undefined || microprompt === "[VERIFICAR]") continue;
      expect(microprompt, `${id}: versão concreta sem @`).toMatch(/@1\.\d+\.\d+$/);
      expect(existsSync(join(raizPrompts, `${microprompt}.md`)), `${id} -> ${microprompt}`).toBe(true);
    }
  });
});
