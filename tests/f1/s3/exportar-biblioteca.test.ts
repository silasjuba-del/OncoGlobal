import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
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
it.each([
  "Paciente: Pessoa Sintética",
  ["Paciente: Pessoa Sintética"],
  [["Paciente: Pessoa Sintética"]],
  { "Paciente: Pessoa Sintética": null },
  { "Paciente: Pessoa Sintética": { referencia: "genérica" } },
])("inspeciona texto decodificado na raiz JSON e em arrays: %j", dados => {
  const f = fixture();
  writeFileSync(join(f.root, "corpus/1-exames/item.json"), JSON.stringify(dados));
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("PHI_ESTRUTURAL");
  expect(existsSync(f.out)).toBe(false);
});
it.each(["Referência bibliográfica genérica", 0, false, null])("preserva JSON escalar público sem inventar metadados: %j", dados => {
  const f = fixture();
  writeFileSync(join(f.root, "corpus/1-exames/item.json"), JSON.stringify(dados));
  expect(exportarBiblioteca(f.root, f.out).arquivos).toBe(1);
  expect(validarPacoteConsulta(f.out)).toEqual({ arquivos: 1, estado: "RASCUNHO", alerta: false });
});
it("não sobrescreve destino nem exporta para dentro do repositório", () => {
  const f = fixture();
  expect(() => exportarBiblioteca(f.root, join(f.root, "exportado"))).toThrow("FORA_DO_REPOSITORIO");
  exportarBiblioteca(f.root, f.out);
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("DESTINO_JA_EXISTE");
});
it("exceção de prosa pública é exata e não encobre conteúdo pessoal acrescentado", () => {
  const j = JSON.parse(readFileSync("corpus/3-laudos/transporte/laudo-transporte.v1.RASCUNHO.json", "utf8"));
  const configurar = (texto: string) => {
    const f = fixture(); mkdirSync(join(f.root, "corpus/3-laudos/transporte"), { recursive: true });
    writeFileSync(join(f.root, "corpus/3-laudos/transporte/laudo-transporte.v1.RASCUNHO.json"), JSON.stringify({ baseLegal: [null, null, { trecho: texto }] }));
    return f;
  };
  const publico = configurar(j.baseLegal[2].trecho); exportarBiblioteca(publico.root, publico.out);
  const adulterado = configurar(j.baseLegal[2].trecho + " Paciente: Pessoa Sintética");
  expect(() => exportarBiblioteca(adulterado.root, adulterado.out)).toThrow("PHI_ESTRUTURAL");
  const foraDoLocalizador = fixture(j.baseLegal[2].trecho);
  expect(() => exportarBiblioteca(foraDoLocalizador.root, foraDoLocalizador.out)).toThrow("PHI_ESTRUTURAL");
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
  { nomeCompletoPaciente: "Pessoa Sintética" },
  { patientFullName: "Pessoa Sintética" },
  { paciente: { nome: "Pessoa Sintética", dataNascimento: "1970-02-01" } },
  { patientId: "paciente-sintetico-identificavel" },
  { cpf: 1234567 },
  { nomePaciente: { valor: "Pessoa Sintética" } },
  { patientId: ["paciente-sintetico-identificavel"] },
  { paciente: { nome: { valor: "Pessoa Sintética" } } },
  { paciente: { id: ["identificador-sintetico"] } },
  { dataNascimento: { valor: "1970-01-01" } },
  { paciente: "Pessoa Sintética" },
  { telefone: { valor: "contato-sintetico" } },
  { endereco: ["local-sintetico"] },
  { nomePaciente: "[Pessoa Sintética]" },
  { patientId: "{{identificador-sintetico}}" },
])("campos JSON com identidade não saem como biblioteca: %j", dados => {
  const f = fixture();
  writeFileSync(join(f.root, "corpus/1-exames/item.json"), JSON.stringify(dados));
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("PHI_ESTRUTURAL");
  expect(existsSync(f.out)).toBe(false);
});
it.each(["prontuario-1234567", "Paciente-Pessoa-Sintetica", "nomeCompletoPaciente-Pessoa-Sintetica"])("recusa identidade no caminho antes de criar saída: %s", nome => {
  const f = fixture();
  mkdirSync(join(f.root, "corpus", nome), { recursive: true });
  writeFileSync(join(f.root, "corpus", nome, "item.json"), '{"texto":"Referência sintética"}');
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("PHI_CAMINHO");
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
it("instruções ao paciente com IDs de conteúdo não são um cadastro de paciente", () => {
  const f = fixture();
  writeFileSync(join(f.root, "corpus/1-exames/item.json"), JSON.stringify({ instrucoesPaciente: [{ id: "IP-01", texto: "Orientação genérica" }] }));
  expect(exportarBiblioteca(f.root, f.out).arquivos).toBe(1);
});
it.each(["manifesto", "pendencias", "leia-me"])("metadados de retorno não aceitam informação adicional: %s", alvo => {
  const f = fixture(); exportarBiblioteca(f.root, f.out);
  if (alvo === "leia-me") writeFileSync(join(f.out, "LEIA-ME.md"), "Paciente: Pessoa Sintética");
  else {
    const path = join(f.out, `${alvo}.json`), j = JSON.parse(readFileSync(path, "utf8"));
    j.nomePaciente = "Pessoa Sintética"; writeFileSync(path, JSON.stringify(j));
  }
  expect(() => validarPacoteConsulta(f.out)).toThrow();
});
it("manifesto não pode modificar identidade/fonte dos arquivos sem modificar seus bytes", () => {
  const f = fixture(); exportarBiblioteca(f.root, f.out);
  const path = join(f.out, "manifesto.json"), j = JSON.parse(readFileSync(path, "utf8"));
  j.arquivos[0].fontes = "Outra fonte"; writeFileSync(path, JSON.stringify(j));
  expect(() => validarPacoteConsulta(f.out)).toThrow("METADADOS_DIVERGENTES");
});
it("chave JSON duplicada não pode apagar identidade antes da inspeção estrutural", () => {
  const f = fixture();
  writeFileSync(join(f.root, "corpus/1-exames/item.json"), '{"nomePaciente":"Pessoa Sintética","nomePaciente":null}');
  expect(() => exportarBiblioteca(f.root, f.out)).toThrow("JSON_CHAVE_DUPLICADA");
});
it("exceções públicas correspondem ao campo e ao texto integral efetivamente revisados", () => {
  const pins = JSON.parse(readFileSync("scripts/exportacao-publica-triagem.json", "utf8")) as {
    itens: { arquivo: string; campo: string; sha256: string; motivo: string }[];
  };
  const vistos = new Set<string>();
  for (const pin of pins.itens) {
    expect(pin.arquivo.startsWith("corpus/")).toBe(true);
    const chave = `${pin.arquivo}|${pin.campo}`;
    expect(vistos.has(chave), chave).toBe(false); vistos.add(chave);
    let value: any = JSON.parse(readFileSync(pin.arquivo, "utf8"));
    for (const parte of pin.campo.split(".").filter(Boolean)) {
      expect(Object.hasOwn(value, parte), chave).toBe(true); value = value[parte];
    }
    expect(createHash("sha256").update(String(value)).digest("hex"), chave).toBe(pin.sha256);
    expect(pin.motivo.length).toBeGreaterThan(10);
  }
});
