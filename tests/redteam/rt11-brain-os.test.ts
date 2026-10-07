// RT-11 · BRAIN_OS e ragGRAFO (S1) — provas de DEFESA: conhecimento com ativo:false nunca
// vira regra (interações/agregação respondem PENDENTE, nunca "sem interação"); o grafo
// ragGRAFO carrega status NAO_VERIFICADO (referência, nunca fato).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { avaliarInteracaoMedicamentosa, type RulesetInteracoes } from "../../src/rules/w8/interacoes.js";
import { agregarCaso } from "../../src/rules/w8/patologiaSitio.js";

const corpus = (nome: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "corpus", "rulesets", nome), "utf8"));

describe("RT-11 · ruleset inativo nunca vira VERMELHO nem 'sem interação'", () => {
  it("interações reais do corpus (ativo:false) ⇒ PENDENTE 'não verificado', nunca VERMELHO", () => {
    const ruleset = corpus("interacoes.v1.json");
    const saida = avaliarInteracaoMedicamentosa("capecitabina", "varfarina", ruleset as RulesetInteracoes);
    expect(saida.estado).toBe("PENDENTE");
    expect(saida.motivo).toMatch(/não verificado/iu);
  });

  it("par SEM regra alguma também é PENDENTE (nunca 'sem interação')", () => {
    const ruleset = corpus("interacoes.v1.json");
    const saida = avaliarInteracaoMedicamentosa("medicamento-inexistente-a", "medicamento-inexistente-b",
      ruleset as RulesetInteracoes);
    expect(saida.estado).toBe("PENDENTE");
  });

  it("agregação de patologia com ruleset inativo ⇒ PENDENTE (nunca grau de caso)", () => {
    // O corpus (patologia-agregacao.v1.json) não tem `ativo` na raiz: o consumidor exige
    // {header, ativo} — a ausência é tratada como inativo (defesa fail-closed).
    const saida = agregarCaso([
      { sitio: "Fragmento A", gleasonPrimario: 3, gleasonSecundario: 4 },
      { sitio: "Fragmento B", gleasonPrimario: 4, gleasonSecundario: 4 },
    ], { header: { id: "patologia-agregacao", versao: "1.0.0" }, ativo: false });
    expect(saida.estado).toBe("PENDENTE");
    expect(saida.grauDoCaso).toBeNull();
    const semRuleset = agregarCaso([
      { sitio: "Fragmento A", gleasonPrimario: 3, gleasonSecundario: 4 },
    ]);
    expect(semRuleset.estado).toBe("PENDENTE");
  });
});

describe("RT-11 · ragGRAFO: conhecimento nasce NAO_VERIFICADO (referência, nunca regra)", () => {
  const dadosDir = join(process.cwd(), "docs", "referencias", "ragGRAFO-oncologia", "dados");

  it("todo nó do grafo carrega status EXPLÍCITO (NAO_VERIFICADO ou diretriz FINAL); nunca fato", () => {
    const nos = readFileSync(join(dadosDir, "nos.jsonl"), "utf8")
      .split("\n").filter(Boolean).map((l) => JSON.parse(l) as { status?: string; tipo?: string });
    expect(nos.length).toBeGreaterThan(0);
    expect(nos.every((n) => typeof n.status === "string" && n.status.length > 0)).toBe(true);
    const statuses = new Set(nos.map((n) => n.status));
    expect(statuses.has("NAO_VERIFICADO")).toBe(true);           // aulas PRO 2026
    expect(statuses.has("DIRETRIZ_FINAL_SBOC_2026")).toBe(true); // diretriz FINAL
  });

  it("arestas do grafo apontam para nós existentes (sem aresta órfã no dado declarado)", () => {
    const ids = new Set(readFileSync(join(dadosDir, "nos.jsonl"), "utf8")
      .split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { id: string }).id));
    const arestas = readFileSync(join(dadosDir, "arestas.jsonl"), "utf8")
      .split("\n").filter(Boolean).map((l) => JSON.parse(l) as { de: string; para: string });
    expect(arestas.length).toBeGreaterThan(0);
    const orfas = arestas.filter((a) => !ids.has(a.de) || !ids.has(a.para));
    expect(orfas.map((a) => `${a.de}→${a.para}`)).toEqual([]);
  });

  it("nenhum ruleset consumidor lê o grafo (BRAIN_OS é referência; rulesets vêm do corpus)", () => {
    // O corpus de regras NÃO pode conter o grafo: checa que rulesets e grafo são universos distintos.
    const arquivos = readdirSync(join(process.cwd(), "corpus", "rulesets"));
    expect(arquivos.every((a) => !a.includes("ragGRAFO"))).toBe(true);
  });
});
