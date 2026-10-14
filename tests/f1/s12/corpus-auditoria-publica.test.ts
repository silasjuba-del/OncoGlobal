import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { criarBiblioteca, sha256Biblioteca } from "../../../src/kernel/corpus/biblioteca.js";

// Só arquivos publicáveis rastreados. Os diretórios privados/ignorados não são lidos por esta auditoria.
const arquivos = execFileSync("git", ["ls-files", "-z", "--", "corpus"], { encoding: "utf8" }).split("\0")
  .filter(p => p.endsWith(".json")).sort();
function pacote(dependencia = "base", versaoDependencia = "1.0.0") {
  const item = (id: string) => ({ schema: "ItemBiblioteca@1", id, versao: "1.0.0", pilar: 6, tipo: "REGRA",
    titulo: `Fixture SOFTWARE ${id}`, texto: "Fixture de software sem limiar, dose ou regra clínica.",
    aplicabilidade: { tumor: ["software"], histologia: [], estadio: [], biomarcador: [], linha: [] },
    proveniencia: { fonte: "https://example.org/software", trecho: "Contrato de software sintético", publicadoEm: "2026-01-01",
      recuperadoEm: "2026-01-01T00:00:00Z", licenca: "Fixture software" }, dependencias: [] as { id: string; versao: string }[] });
  const base = item("base"), consumidor = { ...item("consumidor"), dependencias: [{ id: dependencia, versao: versaoDependencia }] };
  const bytes = Object.fromEntries([base, consumidor].map(i => [`${i.id}.json`, JSON.stringify(i)]));
  return { bytes, manifesto: { schema: "PacoteBiblioteca@1", id: "auditoria-software", versao: "1.0.0", origem: "CURADOR_LOCAL",
    classificacao: "PUBLIC", criadoEm: "2026-01-01T00:00:00Z", itens: [base, consumidor].map(i => ({ id: i.id,
      versao: i.versao, arquivo: `${i.id}.json`, sha256: sha256Biblioteca(bytes[`${i.id}.json`]!) })) } };
}
describe("S12 A12/A18/A19: inventário público e contrato de referências/curadoria", () => {
  it("inventaria todos os JSON públicos por arquivo/hash sem declarar aprovação clínica", () => {
    expect(arquivos.length).toBeGreaterThan(0); expect(new Set(arquivos).size).toBe(arquivos.length);
    const inventario = arquivos.map(arquivo => {
      const bytes = readFileSync(arquivo), conteudo = JSON.parse(bytes.toString("utf8")) as Record<string, any>;
      return { arquivo, hash: createHash("sha256").update(bytes).digest("hex"),
        id: conteudo.header?.id ?? conteudo.id ?? null, versao: conteudo.header?.versao ?? conteudo.versao ?? null,
        aprovacaoClinica: "NAO_AVALIADA_NESTE_TESTE" };
    });
    expect(inventario.every(i => /^[a-f0-9]{64}$/.test(i.hash))).toBe(true);
    console.info(JSON.stringify({ prova: "S12-A12-INVENTARIO-PUBLICO", quantidade: inventario.length, inventario }));
  });
  it.each(["ausente", "versao", "ciclo"])("referência %s é recusada mesmo com SHA recalculado", ataque => {
    const db = new DatabaseSync(":memory:");
    try {
      const b = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: "medico-software" }), emitir: () => {} });
      const p = pacote(ataque === "ausente" ? "inexistente" : ataque === "ciclo" ? "consumidor" : "base", ataque === "versao" ? "9.0.0" : "1.0.0");
      expect(() => b.importarPacote(p.manifesto, path => p.bytes[path]!)).toThrow(ataque === "ciclo" ? "DEPENDENCIA_CICLICA" : "DEPENDENCIA_AUSENTE");
      expect(db.prepare("SELECT count(*) n FROM biblioteca_pacote").get()?.n).toBe(0);
    } finally { db.close(); }
  });
  it("consultável é positivo para consulta e negativo para alerta; dependência não revisada impede ativação", () => {
    const db = new DatabaseSync(":memory:"); let autorizado = true;
    try {
      const b = criarBiblioteca(db, { autorizarCuradoria: () => autorizado ? { atorId: "medico-software" } : null, emitir: () => {} });
      const p = pacote(), id = b.importarPacote(p.manifesto, path => p.bytes[path]!);
      b.revisarItem(id, "consumidor", "CONSULTAVEL");
      expect(() => b.ativar(id)).toThrow("DEPENDENCIA_NAO_APROVADA");
      b.revisarItem(id, "base", "CONSULTAVEL"); b.ativar(id);
      expect(b.consultar({ tumor: "software" }).map(i => i.id).sort()).toEqual(["base", "consumidor"]);
      expect(b.consultar({ tumor: "software" }, "ALERTA")).toEqual([]);
      autorizado = false; expect(() => b.revisarItem(id, "consumidor", "ALERTA")).toThrow("SEM_AUTORIDADE");
      expect(b.consultar({ tumor: "software" }, "ALERTA")).toEqual([]);
    } finally { db.close(); }
  });
});
