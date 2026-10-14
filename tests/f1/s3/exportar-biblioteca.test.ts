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
it("exceção de prosa pública é exata e não encobre conteúdo pessoal acrescentado", () => {
  const j = JSON.parse(readFileSync("corpus/3-laudos/transporte/laudo-transporte.v1.RASCUNHO.json", "utf8"));
  const publico = fixture(j.baseLegal[2].trecho); exportarBiblioteca(publico.root, publico.out);
  const adulterado = fixture(j.baseLegal[2].trecho + " Paciente: Pessoa Sintética");
  expect(() => exportarBiblioteca(adulterado.root, adulterado.out)).toThrow("PHI_ESTRUTURAL");
});
it("identificador de estudo/catálogo não mascara rótulo pessoal no mesmo texto", () => {
  const publico = fixture("Referência sintética: NCT99999999; APAC 0304050016");
  exportarBiblioteca(publico.root, publico.out);
  expect(validarPacoteConsulta(publico.out).arquivos).toBe(1);
  const pessoal = fixture("Prontuário: 0304050016");
  expect(() => exportarBiblioteca(pessoal.root, pessoal.out)).toThrow("PHI_ESTRUTURAL");
});
it.each([
  { nomePaciente: "Pessoa Sintética", nascimento: "01/02/1970" },
  { paciente: { nome: "Pessoa Sintética", dataNascimento: "1970-02-01" } },
  { patientId: "paciente-sintetico-identificavel" },
])("campos JSON com identidade não saem como biblioteca: %j", dados => {
  const f = fixture();
  writeFileSync(join(f.root, "corpus/1-exames/item.json"), JSON.stringify(dados));
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("PHI_ESTRUTURAL");
  expect(existsSync(f.out)).toBe(false);
});
it("exporta raízes consumidas pelo app e registra binários/scripts excluídos", () => {
  const f = fixture();
  for (const raiz of ["fichas", "regulatorio", "receitas", "f0c/sigtap/fontes"]) mkdirSync(join(f.root, "corpus", raiz), { recursive: true });
  for (const raiz of ["fichas", "regulatorio", "receitas"]) writeFileSync(join(f.root, "corpus", raiz, "item.json"), '{"id":"fixture","texto":"Referência sintética"}');
  writeFileSync(join(f.root, "corpus/f0c/sigtap/fontes/original.zip"), "binario-nao-exportavel");
  writeFileSync(join(f.root, "corpus/f0c/gerar-cadastro.mjs"), "nao executar");
  expect(exportarBiblioteca(f.root, f.out).arquivos).toBe(4);
  const m = JSON.parse(readFileSync(join(f.out, "manifesto.json"), "utf8"));
  expect(m.naoExportados).toHaveLength(2);
  expect(existsSync(join(f.out, "corpus/f0c/gerar-cadastro.mjs"))).toBe(false);
  expect(validarPacoteConsulta(f.out).arquivos).toBe(4);
});
it("arquivo extra não inventariado não passa na validação de retorno", () => {
  const f = fixture(); exportarBiblioteca(f.root, f.out);
  writeFileSync(join(f.out, "extra.txt"), "Paciente: Pessoa Sintética");
  expect(() => validarPacoteConsulta(f.out)).toThrow("ARQUIVO_NAO_INVENTARIADO");
});
