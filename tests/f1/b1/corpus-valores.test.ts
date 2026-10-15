import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ProtocolTemplate } from "../../../src/contracts/w10/prescricao.js";
import { instanciarProtocolo } from "../../../src/rules/prescricao/instanciarProtocolo.js";

const rd = (p: string) => JSON.parse(readFileSync(join(process.cwd(), p), "utf8"));
const lista = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? lista(p) : p.endsWith(".json") ? [p] : []; });
const canonico = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonico).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${canonico((v as any)[k])}`).join(",")}}` : JSON.stringify(v);
const hashDe = (t: any) => { const { hash: _h, status: _s, ...r } = t; return createHash("sha256").update(canonico(r), "utf8").digest("hex"); };
const protocolos = (j: any, id: (s: string) => boolean): any[] => {
  const out: any[] = [];
  const achar = (v: any): void => { if (Array.isArray(v)) v.forEach(achar); else if (v && typeof v === "object") { if (typeof v.id === "string" && id(v.id) && Array.isArray(v.drogas)) out.push(v); Object.values(v).forEach(achar); } };
  achar(j); return out;
};

describe("F1-B1 valores aplicados ao corpus", () => {
  it("D-F1-28: toda ficha de paclitaxel semanal usa SF 0,9% 500 mL, com hash e contrato válidos", () => {
    const fichas = lista("corpus/fichas").filter(p => /semanal/.test(p)).map(p => JSON.parse(readFileSync(p, "utf8")));
    const comPaclitaxel = fichas.filter(f => f.itens.some((i: any) => /^paclitaxel/i.test(i.drug)));
    expect(comPaclitaxel.length).toBe(6);
    for (const f of comPaclitaxel) {
      const i = f.itens.find((x: any) => /^paclitaxel/i.test(x.drug));
      expect([i.diluent, i.finalVolumeMl], f.templateId).toEqual(["SF 0,9%", 500]);
      expect(hashDe(f), f.templateId).toBe(f.hash);
      expect(ProtocolTemplate.safeParse(f).success, f.templateId).toBe(true);
    }
  });
  it("D-F1-28: paclitaxel 21/21 dias não foi alterado", () => {
    const f = rd("corpus/fichas/mama/paclitaxel-monoterapia-21-21-dias__nao-especificado.json");
    expect(f.itens.find((x: any) => /^paclitaxel/i.test(x.drug)).diluent).toBeNull();
    expect(f.fonte).not.toContain("D-F1-28");
  });
  it("D-F1-43: P1426 tem cimetidina e dipirona como se necessário, sem dose inventada", () => {
    const f = rd("corpus/fichas/pulmao-cpnpc/cisplatina-docetaxel__nao-especificado.json");
    expect(f.codigoInstitucional).toBe("P1426");
    const cim = f.itens.find((x: any) => /^cimetidina/i.test(x.drug)), dip = f.itens.find((x: any) => x.drug === "Dipirona");
    expect(cim.observacao).toMatch(/^SE NECESSÁRIO \(D-F1-43\)/); expect(dip.observacao).toMatch(/^SE NECESSÁRIO \(D-F1-43\)/);
    expect(dip.standardDose).toBeNull(); expect(hashDe(f)).toBe(f.hash); expect(ProtocolTemplate.safeParse(f).success).toBe(true);
  });
  it("D-F1-43 · armadilha (e): na instanciação, nenhum PRE_QT fica depois de POS_QT; dipirona entra logo após a cimetidina", () => {
    const dados = { pesoKg: 70, alturaCm: 170, bsaM2: 1.8, clcr: 90, medidoEm: "2026-10-14T09:00:00-03:00" };
    const fichas = lista("corpus/fichas").map(p => JSON.parse(readFileSync(p, "utf8"))).filter(f => Array.isArray(f.itens));
    expect(fichas.length).toBeGreaterThan(0);
    for (const f of fichas) {
      const seqs = f.itens.map((i: any) => i.sequence);
      expect(new Set(seqs).size, f.templateId).toBe(seqs.length);
      // simula a promoção do RASCUNHO: a ordem gerada é a ordem do template.
      const r = instanciarProtocolo({ ...f, status: "CONFERIDA_MEDICO" }, dados);
      expect(r.ok, f.templateId).toBe(true);
      if (!r.ok) continue;
      const classes = r.itens.map(x => x.item.classe);
      const primeiroPos = classes.indexOf("POS_QT");
      if (primeiroPos >= 0) expect(classes.slice(primeiroPos).includes("PRE_QT"), f.templateId).toBe(false);
      const s = r.itens.map(x => x.item.sequence);
      expect(s, f.templateId).toEqual([...s].sort((a, b) => a - b));
    }
    const p1426 = rd("corpus/fichas/pulmao-cpnpc/cisplatina-docetaxel__nao-especificado.json");
    const r = instanciarProtocolo({ ...p1426, status: "CONFERIDA_MEDICO" }, dados);
    if (!r.ok) throw new Error("P1426 não instanciou");
    const nomes = r.itens.map(x => x.item.drug);
    expect(nomes.indexOf("Dipirona")).toBe(nomes.findIndex(n => /^cimetidina/i.test(n)) + 1);
    expect(nomes.indexOf("Dipirona")).toBeLessThan(nomes.indexOf("Docetaxel"));
  });
  it("D-F1-42: AT (P1603) segue em 60 mg/m² de doxorrubicina", () => {
    const f = rd("corpus/fichas/mama/doxorrubicina-paclitaxel-at__nao-especificado.json");
    expect(f.itens.find((x: any) => /^doxorrubicina/i.test(x.drug)).standardDose).toBe(60);
  });
  it("D-F1-25: DCF mantém cisplatina no D2", () => {
    const f = rd("corpus/fichas/estomago-jeg/dcf-modificado-institucional__nao-especificado.json");
    expect(f.itens.find((x: any) => /^cisplatina/i.test(x.drug)).days).toEqual(["d2"]);
  });
  it("D-F1-31/32: audiometria no painel da cisplatina; DPYD é só lembrete", () => {
    const l = rd("corpus/1-exames/labs/labs-por-esquema.v1.RASCUNHO.json");
    expect(l.painels.find((p: any) => p.classe === "esquemas com cisplatina").baseline).toContain("AUDIOMETRIA_TONAL");
    const fp = l.painels.find((p: any) => /fluoropirimidinas/.test(p.classe));
    expect(fp.lembretes[0]).toMatchObject({ id: "DPYD", disponibilidadeSUS: "AUSENTE_NO_SUS", gerarPedido: false, bloqueia: false });
    expect(fp.porCiclo).toBeUndefined(); expect(l.resumo.painels).toBe(l.painels.length);
  });
  it("D-F1-39/46: laudo INSS com validade de 6 meses e incapacidade pré-marcada e desmarcável", () => {
    const l = rd("corpus/3-laudos/inss/laudo-inss.v1.RASCUNHO.json");
    expect(l.validade.valor).toEqual({ meses: 6 }); expect(l.validade.pendencia).toBeNull();
    expect(l.regrasEmissao.incapacidade).toMatchObject({ preMarcada: true, desmarcavel: true });
    expect(l.regrasEmissao.bloqueiaEmissao).toBe(false);
  });
  it("D-F1-29: mitotano indisponível e EDP sem mitotano proposto", () => {
    const todos = protocolos(rd("corpus/6-pack-tumor/adrenal/pack-adrenal.v2.RASCUNHO.json"), id => id.startsWith("adrenal-cca-"));
    for (const p of todos.filter(x => x.drogas.some((d: any) => /mitotano/i.test(d.droga)))) expect(p.propor, p.id).toBe(false);
    const sem = todos.find(x => x.id === "adrenal-cca-edp-sem-mitotano");
    expect(sem.propor).toBe(true); expect(sem.drogas.some((d: any) => /mitotano/i.test(d.droga))).toBe(false);
    expect(sem.drogas.map((d: any) => d.droga)).toEqual(["Doxorrubicina", "Etoposídeo", "Cisplatina"]);
  });
  it("D-F1-24: leuprorrelina 7,5 mg IM a cada 28 dias existe como protocolo próprio", () => {
    const todos = protocolos(rd("corpus/6-pack-tumor/prostata/pack-prostata.v2.RASCUNHO.json"), id => id === "prostata-tda-leuprorrelina-im-28d");
    expect(todos).toHaveLength(1);
    expect(todos[0].drogas[0]).toMatchObject({ dose: 7.5, unidade: "mg", via: "IM", dias: "D1 a cada 28 dias" }); expect(todos[0].cicloDias).toBe(28);
  });
  it("D-F1-30: ondansetrona 1ª linha, metoclopramida 2ª; NK1 e olanzapina só como referência", () => {
    const s = rd("corpus/2-receitas/suporte/receitas-suporte-oncologico.v1.RASCUNHO.json");
    const por = (id: string) => s.itens.find((i: any) => i.id === id);
    expect(por("SUP-NVQ-ALTO-5HT3").politicaLocal).toMatchObject({ propor: true, linhaAntiemese: 1 });
    expect(por("SUP-NVQ-2A-LINHA-METOCLOPRAMIDA").politicaLocal).toMatchObject({ propor: true, linhaAntiemese: 2 });
    expect(por("SUP-NVQ-2A-LINHA-METOCLOPRAMIDA").dose).toBe("SEM_FONTE");
    expect(por("SUP-NVQ-BAIXO").droga).not.toMatch(/metoclopramida/i);
    expect(por("SUP-NVQ-BAIXO").dose).not.toMatch(/metoclopramida/i);
    expect(por("SUP-NVQ-BAIXO").politicaLocal.decisao).toBe("D-F1-30");
    for (const id of ["SUP-NVQ-ALTO-NK1-ORAL", "SUP-NVQ-ALTO-NK1-IV", "SUP-NVQ-CARBO5-NK1", "SUP-NVQ-ALTO-OLZ", "SUP-NVQ-TARDIA-ESCAPE", "SUP-NVQ-5HT3-PALO", "SUP-NVQ-ALTO-DEX"])
      expect(por(id).politicaLocal.propor, id).toBe(false);
    expect(s.resumo.total).toBe(s.itens.length);
  });
});
