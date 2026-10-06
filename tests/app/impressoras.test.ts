import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarPreferenciasImpressora } from "../../src/app/impressoras.js";

const roots: string[] = [];
const root = () => {
  const dir = mkdtempSync(join(tmpdir(), "onco-printer-pref-"));
  roots.push(dir);
  return dir;
};
afterEach(() => { for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("preferência de impressora local", () => {
  it("persiste a preferência em JSON e recupera após nova instância", async () => {
    const dataDir = root();
    const prefs = criarPreferenciasImpressora({ dataDir, listarInstaladas: async () => ["Brother local"] });
    expect(await prefs.listar()).toEqual(["Brother local"]);
    expect(await prefs.lerPreferida()).toBeNull();
    await prefs.salvarPreferida("Brother local");
    expect(await criarPreferenciasImpressora({ dataDir }).lerPreferida()).toBe("Brother local");
    expect(readFileSync(join(dataDir, "preferencias.json"), "utf8")).toContain("Brother local");
  });

  it("usa lista injetada, sem descoberta própria, e não acessa rede", async () => {
    const listarInstaladas = vi.fn(async () => ["Impressora instalada"]);
    const prefs = criarPreferenciasImpressora({ dataDir: root(), listarInstaladas });
    expect(await prefs.listar()).toEqual(["Impressora instalada"]);
    expect(listarInstaladas).toHaveBeenCalledOnce();
    expect(await criarPreferenciasImpressora({ dataDir: root() }).listar()).toEqual([]);
  });

  it("rejeita nomes vazios ou com quebras de linha", async () => {
    const prefs = criarPreferenciasImpressora({ dataDir: root() });
    await expect(prefs.salvarPreferida("   ")).rejects.toThrow("NOME_IMPRESSORA_INVALIDO");
    await expect(prefs.salvarPreferida("impressora\nmaliciosa")).rejects.toThrow("NOME_IMPRESSORA_INVALIDO");
  });
});
