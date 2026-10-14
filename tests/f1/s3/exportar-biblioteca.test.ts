import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportarBiblioteca, validarPacoteConsulta } from "../../../scripts/exportar-biblioteca.mjs";
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })));
function fixture(texto = "Referência sintética para teste") {
  const dir = mkdtempSync(join(tmpdir(), "f1-exportacao-")); dirs.push(dir);
  const root = join(dir, "repo"), out = join(dir, "pacote");
  mkdirSync(join(root, "corpus/1-exames"), { recursive: true });
  writeFileSync(join(root, "corpus/1-exames/item.json"), JSON.stringify({ id: "item-sintetico", versao: "1", texto, fonte: "fixture sintética" }));
  return { root, out };
}
it("exporta e valida bytes para consulta sem ativar conteúdo nem inventar fonte", () => {
  const f = fixture(); expect(exportarBiblioteca(f.root, f.out).arquivos).toBe(1);
  expect(validarPacoteConsulta(f.out)).toEqual({ arquivos: 1, estado: "RASCUNHO", alerta: false });
});
it.each(["hash", "ativacao", "traversal"])("recusa pacote adulterado: %s", caso => {
  const f = fixture(); exportarBiblioteca(f.root, f.out);
  const path = join(f.out, "manifesto.json"), m = JSON.parse(readFileSync(path, "utf8"));
  if (caso === "hash") m.arquivos[0].sha256 = "0".repeat(64);
  if (caso === "ativacao") m.arquivos[0].alerta = true;
  if (caso === "traversal") m.arquivos[0].caminho = "../item.json";
  writeFileSync(path, JSON.stringify(m));
  expect(() => validarPacoteConsulta(f.out)).toThrow();
});
it("PHI estrutural impede criar o pacote, mesmo com rótulo de fonte pública", () => {
  const f = fixture("Paciente: Pessoa Sintética");
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("PHI_ESTRUTURAL");
  expect(existsSync(f.out)).toBe(false);
});
it("não sobrescreve destino nem exporta para dentro do repositório", () => {
  const f = fixture();
  expect(() => exportarBiblioteca(f.root, join(f.root, "exportado"))).toThrow("FORA_DO_REPOSITORIO");
  exportarBiblioteca(f.root, f.out);
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("DESTINO_JA_EXISTE");
});
