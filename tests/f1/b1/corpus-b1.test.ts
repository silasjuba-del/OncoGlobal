import { describe, expect, it } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error módulo .mjs sem declaração de tipos
import { verificarB1 } from "../../../scripts/corpus-b1.mjs";

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
  it("positivo: o corpus real passa", () => { expect(verificarB1(REAL)).toEqual([]); });
  it("adversarial: item alterado sem citar a decisão de origem falha", () => usar(d => {
    const p = join(d, "corpus/fichas/mama/ac-t-fase-t-paclitaxel-semanal__adjuvante.json");
    writeFileSync(p, readFileSync(p, "utf8").split("D-F1-28").join("D-X"));
    expect(verificarB1(d).some((x: string) => x.includes("sem citar a decisão de origem D-F1-28"))).toBe(true);
  }));
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
  it("borda: sem manifesto o checkout passa (fatia não aplicada)", () => {
    const d = mkdtempSync(join(tmpdir(), "b1-vazio-"));
    try { expect(verificarB1(d)).toEqual([]); } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
