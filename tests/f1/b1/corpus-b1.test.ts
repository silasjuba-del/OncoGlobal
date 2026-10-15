import { describe, expect, it } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error módulo .mjs sem declaração de tipos
import { resolverLocalizador, verificarB1 } from "../../../scripts/corpus-b1.mjs";

const REAL = process.cwd();
const MANIFESTO = "corpus/manifesto/b1-alteracoes.v1.json";
function copia() {
  const dir = mkdtempSync(join(tmpdir(), "b1-"));
  const m = JSON.parse(readFileSync(join(REAL, MANIFESTO), "utf8")) as { alteracoes: { arquivo: string }[] };
  for (const a of [MANIFESTO, ...new Set(m.alteracoes.map(x => x.arquivo))]) {
    mkdirSync(dirname(join(dir, a)), { recursive: true });
    cpSync(join(REAL, a), join(dir, a));
  }
  return dir;
}
const mexer = (dir: string, arquivo: string, f: (j: any) => void) => {
  const p = join(dir, arquivo); const j = JSON.parse(readFileSync(p, "utf8")); f(j); writeFileSync(p, JSON.stringify(j));
};
const usar = (f: (dir: string) => void) => { const d = copia(); try { f(d); } finally { rmSync(d, { recursive: true, force: true }); } };
const LABS = "corpus/1-exames/labs/labs-por-esquema.v1.RASCUNHO.json";
const ADRENAL = "corpus/6-pack-tumor/adrenal/pack-adrenal.v2.RASCUNHO.json";
const LAUDO = "corpus/3-laudos/inss/laudo-inss.v1.RASCUNHO.json";
const SUPORTE = "corpus/2-receitas/suporte/receitas-suporte-oncologico.v1.RASCUNHO.json";

describe("F1-B1 validador do lote clínico", () => {
  it("manifesto ausente ou vazio falha fechado",()=>usar(d=>{
    rmSync(join(d,MANIFESTO));expect(verificarB1(d)).toContain("manifesto B1 obrigatório ausente");
    writeFileSync(join(d,MANIFESTO),JSON.stringify({alteracoes:[]}));
    expect(verificarB1(d)).toContain("manifesto B1 sem lista de alterações");
  }));
  it("positivo: o corpus real passa", () => { expect(verificarB1(REAL)).toEqual([]); });
  it("adversarial: item alterado sem citar a decisão de origem falha", () => usar(d => {
    const p = join(d, "corpus/fichas/mama/ac-t-fase-t-paclitaxel-semanal__adjuvante.json");
    writeFileSync(p, readFileSync(p, "utf8").split("D-F1-28").join("D-X"));
    expect(verificarB1(d).some((x: string) => x.includes("sem citar a decisão de origem D-F1-28"))).toBe(true);
  }));
  it("adversarial (thread #17): remover decisao do protocolo adrenal-cca-edp-sem-mitotano falha, mesmo com D-F1-29 em outros objetos do arquivo", () => usar(d => {
    mexer(d, ADRENAL, j => { delete j.tratamento.protocolos.find((p: any) => p.id === "adrenal-cca-edp-sem-mitotano").decisao; });
    expect(readFileSync(join(d, ADRENAL), "utf8")).toContain("D-F1-29");
    const p: string[] = verificarB1(d);
    expect(p.some(x => x.includes("adrenal-cca-edp-sem-mitotano") && x.includes("D-F1-29"))).toBe(true);
  }));
  it("thread #17: protocolo proposto sem mitotano não pode afirmar fornecimento de mitotano (D-F1-29)", () => {
    const real = JSON.parse(readFileSync(join(REAL, ADRENAL), "utf8"));
    const sem = real.tratamento.protocolos.find((p: any) => p.id === "adrenal-cca-edp-sem-mitotano");
    expect(JSON.stringify({ ...sem, fonte: undefined, fonteVia: undefined })).not.toMatch(/mitotano[^"]*forneci/i);
    usar(d => {
      mexer(d, ADRENAL, j => { j.tratamento.protocolos.find((p: any) => p.id === "adrenal-cca-edp-sem-mitotano").sus.observacao += " Mitotano dentro da APAC paliativa (fornecimento pelo serviço)."; });
      expect(verificarB1(d).some((x: string) => x.includes("afirma fornecimento de mitotano"))).toBe(true);
    });
    usar(d => {
      // citação literal da fonte continua permitida
      mexer(d, ADRENAL, j => { j.tratamento.protocolos.find((p: any) => p.id === "adrenal-cca-edp-sem-mitotano").fonte.trecho += " mitotano com fornecimento"; });
      expect(verificarB1(d).some((x: string) => x.includes("afirma fornecimento"))).toBe(false);
    });
  });
  it("adversarial: decisão trocada no objeto apontado (5HT3) falha", () => usar(d => {
    mexer(d, SUPORTE, j => { j.itens.find((i: any) => i.id === "SUP-NVQ-ALTO-5HT3").politicaLocal.decisao = "D-F1-3"; });
    expect(verificarB1(d).some((x: string) => x.includes("SUP-NVQ-ALTO-5HT3") && x.includes("D-F1-30"))).toBe(true);
  }));
  it("adversarial: entrada do manifesto sem localizador, com objeto ausente ou ambíguo falha", () => usar(d => {
    mexer(d, MANIFESTO, j => {
      j.alteracoes[0] = { arquivo: j.alteracoes[0].arquivo, decisao: j.alteracoes[0].decisao };
      j.alteracoes.push({ arquivo: ADRENAL, decisao: "D-F1-29", caminho: "tratamento.protocolos[id=nao-existe]", campo: "decisao" });
      j.alteracoes.push({ arquivo: SUPORTE, decisao: "D-F1-30", caminho: "itens[categoria=__inexistente__]", campo: "decisao" });
    });
    const p: string[] = verificarB1(d);
    expect(p.some(x => x.includes("sem localizador por objeto"))).toBe(true);
    expect(p.some(x => x.includes("localizador não encontrado (tratamento.protocolos[id=nao-existe])"))).toBe(true);
  }));
  it("borda: localizador resolve raiz, rejeita índice numérico e seletor ambíguo", () => {
    const j = { a: [{ id: "x", v: 1 }, { id: "x", v: 2 }, { id: "y", b: { c: "D-F1-1" } }], r: "D-F1-2" };
    expect(resolverLocalizador(j, "")).toMatchObject({ ok: true, valor: j });
    expect(resolverLocalizador(j, "a[id=y].b")).toMatchObject({ ok: true, valor: { c: "D-F1-1" } });
    expect(resolverLocalizador(j, "a[id=x]")).toMatchObject({ ok: false, erro: expect.stringContaining("ambíguo") });
    expect(resolverLocalizador(j, "a[0]")).toMatchObject({ ok: false });
    expect(resolverLocalizador(j, "a[id=y")).toMatchObject({ ok: false, erro: expect.stringContaining("malformado") });
    expect(resolverLocalizador(j, "r")).toMatchObject({ ok: false, erro: expect.stringContaining("não aponta objeto") });
  });
  it("todo objeto alterado do manifesto é localizável e cada arquivo do lote tem ao menos um localizador", () => {
    const m = JSON.parse(readFileSync(join(REAL, MANIFESTO), "utf8"));
    for (const a of m.alteracoes) { expect(typeof a.caminho, a.arquivo).toBe("string"); expect(typeof a.campo, a.arquivo).toBe("string"); }
    expect(m.alteracoes.find((a: any) => a.caminho === "tratamento.protocolos[id=adrenal-cca-edp-sem-mitotano]")).toMatchObject({ campo: "decisao", decisao: "D-F1-29" });
  });
  it("adversarial: DPYD que gera pedido ou trava falha", () => usar(d => {
    mexer(d, LABS, j => { j.painels.at(-1).lembretes[0].gerarPedido = true; });
    expect(verificarB1(d).some((x: string) => x.includes("lembrete DPYD"))).toBe(true);
  }));
  it("adversarial: mitotano indisponível marcado para propor falha", () => usar(d => {
    mexer(d, ADRENAL, j => {
      const achar = (v: any): void => { if (Array.isArray(v)) v.forEach(achar); else if (v && typeof v === "object") { if (v.disponibilidadeMercado && "propor" in v) v.propor = true; Object.values(v).forEach(achar); } };
      achar(j);
    });
    expect(verificarB1(d).some((x: string) => x.includes("indisponível"))).toBe(true);
  }));
  it("adversarial: NK1/olanzapina proposto falha", () => usar(d => {
    mexer(d, SUPORTE, j => { j.itens.find((i: any) => i.id === "SUP-NVQ-ALTO-OLZ").politicaLocal.propor = true; });
    expect(verificarB1(d).some((x: string) => x.includes("referência consultável"))).toBe(true);
  }));
  it("adversarial: laudo que bloqueia a emissão ou imprime ausente falha", () => usar(d => {
    mexer(d, LAUDO, j => { j.regrasEmissao.bloqueiaEmissao = true; j.regrasEmissao.dadoAusente.imprimir = true; });
    const p: string[] = verificarB1(d);
    expect(p.some(x => x.includes("D-F1-37"))).toBe(true);
    expect(p.some(x => x.includes("D-F1-38"))).toBe(true);
  }));
  it("borda: checkout sem manifesto obrigatório é recusado", () => {
    const d = mkdtempSync(join(tmpdir(), "b1-vazio-"));
    try { expect(verificarB1(d)).toEqual(["manifesto B1 obrigatório ausente"]); } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
