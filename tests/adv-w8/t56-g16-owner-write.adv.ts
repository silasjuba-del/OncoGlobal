// KIMI-15 · T-56 + G-16 · OWNER: write em objeto alheio é rejeitado (PLANO R-15 linha 463;
// INV-15; MATRIZ). capabilities.v1.json declara ownerOf por agente (AG-13 é dono de Document,
// AG-14 de Conversation — K-21), mas declaração não é enforcement: "dono cadastrado não
// enforcement runtime" (MATRIZ T-56).
// ESTADO 2026-10-07: g16Owner está em src/kernel/harness/ownership.ts e reexportado por
// gates.ts. Write alheio → BLOQUEIA_AUTORIDADE; dono e leitura → PASSA. Título
// SEM_IMPLEMENTACAO é histórico. O writeRouter em si não é reauditado por este arquivo.
import { describe, expect, it } from "vitest";

interface VereditoLike { gate?: string; decisao?: string; motivo?: string }

async function gateG16(): Promise<((input: unknown) => VereditoLike) | null> {
  const mod = (await import("../../src/kernel/harness/gates.js")) as Record<string, unknown>;
  const fn = mod["g16Owner"] ?? mod["g16"] ?? mod["donoDoObjeto"];
  return typeof fn === "function" ? (fn as (input: unknown) => VereditoLike) : null;
}

describe("T-56 / G-16 · um dono por objeto: write alheio rejeitado em runtime", () => {
  it("T-56 · SEM_IMPLEMENTACAO: veredito de ownership existe no harness", async () => {
    expect(await gateG16(),
      "T-56 não implementado: capabilities.v1.json só DECLARA ownerOf; nenhum gate/runtime " +
      "rejeita agente escrevendo objeto de que não é dono (ex.: AG-04 escrevendo Conversation)").not.toBeNull();
  });

  it("T-56 · positivo: AG-04 (dono de ImagingStudy) escrevendo Conversation (dono AG-14) ⇒ rejeitado", async () => {
    const g16 = await gateG16();
    if (!g16) return;
    const v = g16({ agenteId: "AG-04", objetoTipo: "Conversation", operacao: "write" });
    expect(v.gate).toBe("G-16");
    expect(v.decisao).toMatch(/REJEITA|BLOQUEIA/);
  });

  it("T-56 · negativo: AG-14 escrevendo Conversation (próprio objeto) passa", async () => {
    const g16 = await gateG16();
    if (!g16) return;
    expect(g16({ agenteId: "AG-14", objetoTipo: "Conversation", operacao: "write" }).decisao).toBe("PASSA");
  });

  it("T-56 · negativo: leitura de objeto alheio não é write (não rejeita por G-16)", async () => {
    const g16 = await gateG16();
    if (!g16) return;
    expect(g16({ agenteId: "AG-04", objetoTipo: "Conversation", operacao: "read" }).decisao).toBe("PASSA");
  });

  it("T-56 · catálogo real (K-21): donos declarados não se sobrepõem por objeto", async () => {
    // Base real verificável hoje: o catálogo declara exatamente um dono por objeto.
    const capabilities = JSON.parse(
      (await import("node:fs")).readFileSync(
        new URL("../../corpus/capabilities.v1.json", import.meta.url), "utf8")) as {
      agentes: { id: string; ownerOf: string[] }[] };
    const donos = new Map<string, string[]>();
    for (const a of capabilities.agentes)
      for (const o of a.ownerOf) {
        const lista = donos.get(o) ?? [];
        lista.push(a.id);
        donos.set(o, lista);
      }
    for (const [objeto, agentes] of donos)
      expect(agentes, `${objeto} com ${agentes.length} donos declarados`).toHaveLength(1);
  });
});
