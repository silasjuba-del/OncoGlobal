import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { ProtocolTemplate } from "../../../src/contracts/w10/prescricao.js";
import { instanciarProtocolo } from "../../../src/rules/prescricao/instanciarProtocolo.js";
import { safetyEngine } from "../../../src/rules/prescricao/safetyEngine.js";
import { calcularDosePorBase } from "../../../src/rules/prescricao/index.js";
const man = JSON.parse(readFileSync("corpus/manifesto/b2-fichas.v1.json", "utf8"));
const fichas = man.fichasNovas.map((f: {arquivo: string}) => ProtocolTemplate.parse(JSON.parse(readFileSync(f.arquivo, "utf8"))));
const dados = { pesoKg: 70, alturaCm: 170, bsaM2: 1.8, clcr: 80, medidoEm: "2026-10-14T08:00:00-03:00" };
function calcular(t: typeof ProtocolTemplate._output) {
  const r = instanciarProtocolo({ ...t, status: "CONFERIDA_MEDICO" }, dados);
  if (!r.ok) throw Error("fixture não instanciada");
  return r;
}
const dias = (lista: string[]) => lista.flatMap(d => {
  const m = /^d(\d+)-d(\d+)$/.exec(d);
  return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, n) => `d${Number(m[1]) + n}`) : [d];
});
describe("PR19: representação e execução seguras das fichas B2", () => {
  it("campos do manifesto distinguem todas as ocorrências, inclusive potássio pré e pós-QT",()=>{
    for(const f of man.fichasNovas){
      const t=JSON.parse(readFileSync(f.arquivo,"utf8"));
      expect(new Set(f.campos.map((c:any)=>c.campo)).size).toBe(t.itens.length);
      for(const i of t.itens)expect(f.campos.filter((c:any)=>c.campo===`itens[drug=${i.drug};classe=${i.classe};days=${i.days.join(",")}].standardDose`)).toHaveLength(1);
    }
  });
  it("packs incluem as quatro doses de resgate EMA e o G-CSF do braço IE",()=>{
    const ntg=JSON.parse(readFileSync("corpus/6-pack-tumor/ntg/pack-ntg.v2.RASCUNHO.json","utf8"));
    for(const id of ["ntg-emaco","ntg-emaep"]){
      const resgate=ntg.tratamento.protocolos.find((p:any)=>p.id===id).drogas.filter((d:any)=>d.droga.startsWith("folínico (+"));
      expect(resgate.map((d:any)=>[d.dose,d.via,d.dias])).toEqual([[15,"VO","D2"],[15,"VO","D2"],[15,"VO","D3"],[15,"VO","D3"]]);
    }
    const ewing=JSON.parse(readFileSync("corpus/6-pack-tumor/ewing/pack-ewing.v2.RASCUNHO.json","utf8"));
    expect(ewing.tratamento.protocolos.find((p:any)=>p.id==="ewing-ie").drogas).toContainEqual(expect.objectContaining({droga:"pegfilgrastim",dose:6,via:"SC",dias:"D6"}));
  });
  it("filgrastim preserva microgramas: 5 µg/kg × 70 kg = 350 µg", () => {
    const t = fichas.find((t: any) => t.nome.startsWith("EMA-CO"))!;
    const f = calcular(t).itens.find(i => i.item.drug === "Filgrastim")!;
    expect(f.item.doseBasis).toBe("MCG_KG");
    expect(f.item.unit).toBe("µg");
    expect(f.item.calculatedDose).toBe(350);
    expect(calcularDosePorBase({basis:"MCG_KG",mcgKg:5,pesoKg:70})).toMatchObject({estado:"PRONTO",dose:350,unidade:"µg",doseMg:0.35});
    expect(calcularDosePorBase({basis:"MCG_KG",mcgKg:5,pesoKg:null})).toMatchObject({estado:"PENDENTE",dose:null,unidade:"µg",doseMg:null});
    const legado = { ...t, itens: [{ ...t.itens.find((i: any) => i.drug === "Filgrastim")!, doseBasis: "MG_KG" as const }] };
    expect(calcular(legado).itens[0]!.estado).toBe("PENDENTE");
  });
  it("tetos declarados são aplicados e o SafetyEngine recusa dose acima deles", () => {
    for (const t of fichas) for (const i of calcular(t).itens.filter(i => i.item.doseMaximaMg !== undefined)) {
      expect(i.item.calculatedDose).toBeLessThanOrEqual(i.item.doseMaximaMg!);
      const alterado = { ...i.item, prescribedDose: i.item.doseMaximaMg! + 1 };
      expect(safetyEngine([alterado], [], {} as any).motivos.some(m => m.codigo === "TETO_DOSE_FICHA")).toBe(true);
    }
    const map = calcular(fichas.find((t: any) => t.nome === "MAP (ciclos 1–4)")!);
    expect(map.itens.find(i => i.item.drug === "Metotrexato")!.item.calculatedDose).toBe(20000);
    const vdc = calcular(fichas.find((t: any) => t.nome.startsWith("Ewing VDC"))!);
    expect(vdc.itens.find(i => i.item.drug === "Vincristina")!.item.calculatedDose).toBe(2);
  });
  it("cisplatina respeita 1 mg/min inclusive após alteração manual", () => {
    const cis = fichas.flatMap((t: any) => calcular(t).itens).filter((i: any) => i.item.drug === "Cisplatina");
    expect(cis.length).toBeGreaterThan(0);
    for (const {item} of cis) {
      const m = /^(\d+) (min|h)$/.exec(item.infusionTime!)!;
      expect(item.prescribedDose! / (Number(m[1]) * (m[2] === "h" ? 60 : 1))).toBeLessThanOrEqual(1);
      expect(safetyEngine([{...item, infusionTime:"1 min"}], [], {} as any).motivos.some(x => x.codigo === "TAXA_INFUSAO_FICHA")).toBe(true);
    }
  });
  it("MAP mantém doxo 25×3, G-CSF posterior e resgate contínuo q6h condicionado aos níveis", () => {
    const maps = fichas.filter((t: any) => t.nome.startsWith("MAP")); expect(maps).toHaveLength(2);
    for (const t of maps) {
      expect(t.itens.find((i: any) => i.drug === "Doxorrubicina")!.standardDose).toBe(25);
      expect(t.itens.find((i: any) => i.drug === "Pegfilgrastim")!.days).toEqual(["d4"]);
      const resgate = calcular(t).itens.find(i => i.item.resgateMtx)!;
      expect(resgate.item.resgateMtx).toMatchObject({inicioAposHoras:24, intervaloHoras:6, primeirasDosesEV:4, ateNivelInferiorMicromolL:0.1});
      expect(resgate.estado).toBe("PENDENTE"); expect(resgate.item.prescribedDose).toBeNull();
      expect(safetyEngine([{...resgate.item, prescribedDose:27}], [], {} as any).motivos.some(x => x.codigo === "RESGATE_MTX_INDIVIDUAL")).toBe(true);
    }
  });
  it("EMA-CO e EMA/EP representam quatro doses em D2 e D3", () => {
    for (const t of fichas.filter((t: any) => /^EMA/.test(t.nome))) {
      const fa = t.itens.filter((i: any) => i.drug.startsWith("Folinato de cálcio (resgate"));
      expect(fa).toHaveLength(4);
      expect(fa.map((i: any) => i.days)).toEqual([["d2"], ["d2"], ["d3"], ["d3"]]);
      expect(fa.map((i: any) => i.drug)).toEqual([24,36,48,60].map(h => `Folinato de cálcio (resgate do MTX +${h} h)`));
    }
  });
  it("pré-medicação e lavagem cobrem todos os dias de QT IV, sem duplicação", () => {
    for (const t of fichas) {
      const pre = t.itens.find((i: any) => i.drug === "Ondansetrona"); if (!pre) continue;
      const qt = t.itens.filter((i: any) => i.classe === "QT" && i.route === "EV" && !/folinato|mesna|manitol/i.test(i.drug));
      for (const d of qt.flatMap((i: any) => dias(i.days))) expect(pre.days, t.nome).toContain(d);
      expect(new Set(pre.days).size).toBe(pre.days.length);
    }
  });
  it("pack NTG espelha a variante D-F1-50 das fichas", () => {
    const p = JSON.parse(readFileSync("corpus/6-pack-tumor/ntg/pack-ntg.v2.RASCUNHO.json", "utf8"));
    const m = p.tratamento.protocolos.find((p: any) => p.id === "ntg-mtx-fa");
    const e = p.tratamento.protocolos.find((p: any) => p.id === "ntg-emaco");
    expect(JSON.stringify(m)).toContain("7.5");
    expect(JSON.stringify(e)).toContain("0.8");
    const ep=p.tratamento.protocolos.find((p:any)=>p.id==="ntg-emaep");
    expect(ep.drogas.filter((d:any)=>d.droga==="etoposídeo").map((d:any)=>[d.dose,d.dias])).toEqual([[100,"D1"],[150,"D8"]]);
  });
  it("regenerar duas vezes não duplica notas nem muda hashes", () => {
    const root = mkdtempSync(join(tmpdir(), "b2-idempotencia-"));
    try {
      mkdirSync(join(root,"tests/corpus-fichas"),{recursive:true});
      cpSync("tests/corpus-fichas/gerar-fichas-b2.mjs",join(root,"tests/corpus-fichas/gerar-fichas-b2.mjs"));
      for (const f of man.fichasAlteradas) { mkdirSync(join(root,f.caminho,".."),{recursive:true}); cpSync(f.caminho,join(root,f.caminho)); }
      const run = () => { const r=spawnSync(process.execPath,[join(root,"tests/corpus-fichas/gerar-fichas-b2.mjs")],{encoding:"utf8"}); expect(r.status,r.stderr).toBe(0); };
      run();
      const caminhos = [...man.fichasNovas.map((f: any)=>f.arquivo), ...man.fichasAlteradas.map((f: any)=>f.caminho), "corpus/manifesto/b2-fichas.v1.json"];
      const antes = caminhos.map(p=>readFileSync(join(root,p),"utf8")); run();
      expect(caminhos.map(p=>readFileSync(join(root,p),"utf8"))).toEqual(antes);
      for (const f of man.fichasAlteradas) { const j=JSON.parse(readFileSync(join(root,f.caminho),"utf8"));
        expect(j.itens.find((i:any)=>/^paclitaxel/i.test(i.drug)).observacao.match(/F1-B2:/g)).toHaveLength(1); }
    } finally { rmSync(root,{recursive:true,force:true}); }
  });
});
