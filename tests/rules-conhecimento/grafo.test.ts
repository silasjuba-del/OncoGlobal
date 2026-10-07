// W10-INT-PRESC-04 · loader do ragGRAFO (RT-11a/c/d). Fixtures sintéticas + dado vivo (somente leitura).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GrafoErro, avaliarTrial, carregarGrafo, carregarGrafoEstrito, classificarResultadoTrial, confrontarFontes,
  divergenciasDoGrafo, resumirTrial, verificarArestas, visaoDoNo, type NoGrafo,
} from "../../src/rules/conhecimento/index.js";

const jl = (...xs: unknown[]): string => xs.map((x) => JSON.stringify(x)).join("\n");
const trial = (status_resultado: unknown, extra: Record<string, unknown> = {}): NoGrafo => ({
  id: "tri.x", tipo: "trial", nome: "ESTUDO-X", status: "NAO_VERIFICADO", desfecho_primario: "SG", ano: 2020,
  bracos: "A 100 mg/m² vs B", ...(status_resultado === undefined ? {} : { status_resultado }), ...extra,
});

describe("RT-11c · loader valida status e arestas ao carregar", () => {
  const nos = jl(
    { id: "tum.a", tipo: "tumor", nome: "A", status: "NAO_VERIFICADO" },
    { id: "src.1", tipo: "fonte", nome: "S", status: "DIRETRIZ_FINAL_SBOC_2026" },
  );
  it("grafo íntegro ⇒ ok, índice por id", () => {
    const g = carregarGrafo(nos, jl({ de: "tum.a", rel: "FONTE", para: "src.1" }));
    expect(g).toMatchObject({ ok: true, orfas: [] });
    expect(g.porId.get("src.1")?.nome).toBe("S");
    expect(carregarGrafoEstrito(nos, "").nos).toHaveLength(2);
  });
  it("aresta órfã (nó removido) é separada e relatada; estrito lança GrafoErro", () => {
    const ar = jl({ de: "tum.a", rel: "FONTE", para: "src.1" }, { de: "tum.a", rel: "TEM_CENARIO", para: "cen.removido" });
    const g = carregarGrafo(nos, ar);
    expect(g.ok).toBe(false);
    expect(g.orfas).toHaveLength(1);
    expect(g.arestas).toHaveLength(1);
    expect(g.erros[0]).toMatchObject({ codigo: "ARESTA_ORFA", arquivo: "arestas", linha: 2 });
    expect(() => carregarGrafoEstrito(nos, ar)).toThrow(GrafoErro);
    expect(verificarArestas(g.nos, [{ de: "x", rel: "R", para: "tum.a" }])).toHaveLength(1);
  });
  it("nó sem status, status desconhecido, id duplicado, JSON quebrado e campo faltante são rejeitados", () => {
    const g = carregarGrafo(jl(
      { id: "a", tipo: "t", nome: "n" },
      { id: "b", tipo: "t", nome: "n", status: "VERIFICADO" },
      { id: "c", tipo: "t", nome: "n", status: "NAO_VERIFICADO" },
      { id: "c", tipo: "t", nome: "n2", status: "NAO_VERIFICADO" },
      { id: "d", nome: "sem tipo", status: "NAO_VERIFICADO" },
    ) + "\n{quebrado", "");
    expect(g.nos.map((n) => n.id)).toEqual(["c"]);
    expect(g.erros.map((e) => e.codigo)).toEqual(["STATUS_AUSENTE", "STATUS_DESCONHECIDO", "ID_DUPLICADO", "NO_SEM_CAMPO", "JSON_INVALIDO"]);
    expect(g.ok).toBe(false);
  });
  it("visão do nó: nunca usável como regra nem ficha; NAO_VERIFICADO avisa; diretriz final não", () => {
    const v = visaoDoNo({ id: "reg.x", tipo: "regime", nome: "R", status: "NAO_VERIFICADO", dose_literal: "Carbo AUC 2" });
    expect(v).toMatchObject({ usavelComoRegra: false, usavelComoFicha: false, doseSomenteReferencia: true, nivel: "REFERENCIA_NAO_VERIFICADA" });
    expect(v.aviso).toMatch(/NAO_VERIFICADO/u);
    const d = visaoDoNo({ id: "reg.y", tipo: "regime", nome: "R", status: "DIRETRIZ_FINAL_SBOC_2026" });
    expect(d).toMatchObject({ usavelComoRegra: false, usavelComoFicha: false, nivel: "DIRETRIZ_FINAL", aviso: null });
  });
});

describe("RT-11a · trial só POSSIBLE_MATCH; negativo nunca é ganho", () => {
  it("classificação do status_resultado do grafo", () => {
    const casos: Array<[unknown, string]> = [
      ["positivo", "POSITIVO"], ["positivo (não inferior)", "POSITIVO"], ["positivo (marginal)", "POSITIVO"],
      ["negativo", "NEGATIVO"], ["NS", "NEGATIVO"], ["NS (RT)", "NEGATIVO"], ["benefício não sustentado", "NEGATIVO"],
      ["negativo (experimental inferior)", "NEGATIVO"], ["negativo/limitado", "NEGATIVO"], ["NI não confirmada globalmente", "NEGATIVO"],
      ["positivo (SLP); SG NS", "MISTO"], ["positivo em CPS≥10; NS no ITT", "MISTO"], ["NS no ITT; positivo per-protocolo", "MISTO"],
      ["positivo (QT); negativo (QRT)", "MISTO"], ["positivo (SLP); encerrado sem ganho de SG", "MISTO"],
      ["atividade (braço único)", "SEM_COMPARACAO"], ["observacional", "SEM_COMPARACAO"], ["dados de congresso", "SEM_COMPARACAO"],
      [undefined, "INDEFINIDO"], ["", "INDEFINIDO"], [42, "INDEFINIDO"],
    ];
    for (const [s, esperado] of casos) expect(classificarResultadoTrial(s), String(s)).toBe(esperado);
  });
  it("só POSITIVO limpo é ganho; sempre POSSIBLE_MATCH e elegivel=false", () => {
    for (const s of ["positivo", "negativo", "NS", "positivo (SLP); SG NS", "atividade", undefined]) {
      const a = avaliarTrial(trial(s));
      if (!a.ok) throw new Error("trial deveria avaliar");
      expect(a.classificacao).toBe("POSSIBLE_MATCH");
      expect(a.elegivel).toBe(false);
      expect(a.apresentavelComoGanho).toBe(s === "positivo");
      expect(a.resumo).not.toMatch(/\belegível\b/iu);
    }
    const neg = avaliarTrial(trial("negativo (SG)"));
    if (!neg.ok) throw new Error("x");
    expect(neg.resumo).toMatch(/NEGATIVO.*não apresentar como ganho/u);
    expect(neg.statusResultadoLiteral).toBe("negativo (SG)");
    expect(neg.aviso).toMatch(/NAO_VERIFICADO/u);
  });
  it("nó que não é trial ou sem status válido é recusado; resumirTrial devolve frase", () => {
    expect(avaliarTrial({ id: "r", tipo: "regime", nome: "R", status: "NAO_VERIFICADO" })).toMatchObject({ ok: false });
    expect(avaliarTrial({ ...trial("positivo"), status: "XYZ" })).toMatchObject({ ok: false });
    expect(resumirTrial(trial("positivo"))).toMatch(/^ESTUDO-X \(2020\): desfecho primário SG;/u);
  });
});

describe("RT-11d · fontes divergentes lado a lado", () => {
  const aula: NoGrafo = { id: "reg.mama.aula", tipo: "regime", nome: "AC-T", status: "NAO_VERIFICADO", linha: "adjuvante", intencao: "curativa", observacao: "dose-densa opcional" };
  const final: NoGrafo = { id: "reg.mama.sboc", tipo: "regime", nome: "AC-T", status: "DIRETRIZ_FINAL_SBOC_2026", linha: "adjuvante", intencao: "curativa", dose_literal: "AC 60/600 q14d" };
  it("mostra AMBAS as fontes, diretriz final primeiro só por exibição; ausência vira NAO_INFORMADO, nunca preenchida", () => {
    const c = confrontarFontes([aula, final]);
    expect(c.divergente).toBe(true);
    expect(c.preenchimentoEntreFontes).toBe(false);
    expect(c.fontes.map((f) => f.id)).toEqual(["reg.mama.sboc", "reg.mama.aula"]);
    const dose = c.campos.find((x) => x.campo === "dose_literal")!;
    expect(dose.valores).toEqual([{ id: "reg.mama.sboc", valor: "AC 60/600 q14d" }, { id: "reg.mama.aula", valor: "NAO_INFORMADO" }]);
    expect(dose.diverge).toBe(true);
    expect(c.campos.find((x) => x.campo === "linha")!.diverge).toBe(false);
    expect(Object.keys(c)).not.toContain("vencedora");
  });
  it("fontes idênticas não divergem; status inválido lança", () => {
    expect(confrontarFontes([aula, { ...aula, id: "outro" }]).divergente).toBe(false);
    expect(() => confrontarFontes([aula, { ...final, status: "?" }])).toThrow(GrafoErro);
  });
});

describe("dado vivo · ragGRAFO/oncologia", () => {
  const dir = join(process.cwd(), "docs", "referencias", "ragGRAFO-oncologia", "dados");
  const g = carregarGrafo(readFileSync(join(dir, "nos.jsonl"), "utf8"), readFileSync(join(dir, "arestas.jsonl"), "utf8"));
  it("carrega íntegro: status explícito em todos, nenhuma aresta órfã", () => {
    expect(g.erros).toEqual([]);
    expect(g.ok).toBe(true);
    expect(g.nos.filter((n) => n.status === "NAO_VERIFICADO")).toHaveLength(2746);
    expect(g.nos.filter((n) => n.status === "DIRETRIZ_FINAL_SBOC_2026").length).toBeGreaterThan(0);
  });
  it("nenhum trial negativo/NS/misto do grafo é apresentável como ganho; nenhum é elegível", () => {
    let negativos = 0;
    for (const n of g.nos.filter((x) => x.tipo === "trial")) {
      const a = avaliarTrial(n);
      if (!a.ok) throw new Error(a.motivo);
      expect(a.elegivel).toBe(false);
      if (a.resultado !== "POSITIVO") { negativos++; expect(a.apresentavelComoGanho).toBe(false); }
    }
    expect(negativos).toBeGreaterThan(40);
  });
  it("divergências aula × diretriz aparecem com as duas fontes", () => {
    const div = divergenciasDoGrafo(g);
    for (const c of div) expect(c.fontes.length).toBeGreaterThanOrEqual(2);
    expect(div.some((c) => c.fontes.some((f) => f.nivel === "DIRETRIZ_FINAL") && c.fontes.some((f) => f.nivel === "REFERENCIA_NAO_VERIFICADA"))).toBe(true);
  });
});
