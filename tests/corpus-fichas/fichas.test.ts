// W10-INT-FICHAS · invariantes das fichas de protocolo em corpus/fichas/** (todas RASCUNHO; só o Dr. Silas promove).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";

const PASTA = fileURLToPath(new URL("../../corpus/fichas", import.meta.url));

function listar(d: string): string[] {
  return readdirSync(d).sort().flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? listar(p) : f.endsWith(".json") ? [p] : [];
  });
}
const arquivos = listar(PASTA);
const fichas = arquivos.map((a) => ({ arquivo: a, texto: readFileSync(a, "utf8") }))
  .map((x) => ({ ...x, json: JSON.parse(x.texto) as Record<string, unknown> }));

function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
/** Mesma regra do gerador: SHA-256 do conteúdo canônico sem `hash` e sem `status`. */
function hashDe(t: Record<string, unknown>): string {
  const { hash: _h, status: _s, ...resto } = t;
  return createHash("sha256").update(canonico(resto), "utf8").digest("hex");
}

const parseadas = fichas.map((f) => ({ ...f, ficha: ProtocolTemplate.parse(f.json) }));
const eh5fu = (drug: string) => /fluoruracila|fluorouracil|5-?fu\b/i.test(drug);
const ehTaxano = (drug: string) => /paclitaxel|docetaxel|cabazitaxel/i.test(drug);

// Esquemas de bomba: 5-FU obrigatoriamente em infusão de 46 h, sem bolus (D-W9-23a, D-W9-50).
// "Leucovorina (LV5FU2)" = ficha ESÔFAGO com a regra local da bomba de 46 h (D-W9-23a); o LV5FU2 do P1512
// (D-F1-50) é o de Gramont clássico (bolus 400 + 600 CI 22 h) e NÃO entra na família de bomba.
const FAMILIA_BOMBA = /\b(FOLFOX|FOLFIRI|FOLFIRINOX|FOLFOXIRI|FLOT)\b|Leucovorina \(LV5FU2\)/i;
// 5-FU em bolus só onde o bolus é o desenho do esquema (Mayo mantido por D-W9-23b; Roswell Park; CMF).
const BOLUS_POR_DESENHO = /Mayo Clinic|Roswell Park|^CMF$|Folinato \+ 5-FU semanal \(P1577\)|LV5FU2/
// Outros 5-FU infusionais fora da bomba de 46 h, declarados um a um (revisão institucional / esquema próprio).
const INFUSAO_FORA_46H: Record<string, string> = {
  "DCF modificado (institucional)": "6 h",
  "Cisplatina + 5-Fluorouracil (PF)": "24 h",
  // F1-B2 (D-F1-49): Khansur 1995 — 1.000 mg/m²/dia CI ×4 dias em CUP escamoso.
  "Cisplatina + 5-Fluorouracil (CUP escamoso)": "24 h",
  // F1-B2 (D-F1-50): LV5FU2 (P1512 mapeado pela decisão) — 600 mg/m² CI 22 h em D1 e D2.
  "LV5FU2 — 5-FU + folinato (P1512)": "22 h",
  // FOLFOX4 — decisão Dr. Silas 2026-10-08 (bolus + infusão de 22 h; ficha nova, não altera a FOLFOX de 46 h).
  "FOLFOX4 — com port-a-cath": "22 h",
  "FOLFOX4 — sem port-a-cath": "22 h",
};
// Bolus de 5-FU fora do desenho Mayo/Roswell Park/CMF: só as duas FOLFOX4 — decisão Dr. Silas 2026-10-08. Nominais, nada mais.
const BOLUS_EXCECAO_FOLFOX4 = ["FOLFOX4 — com port-a-cath", "FOLFOX4 — sem port-a-cath"];
// F1-B2 (D-F1-50): P1577 = NHS CR004 (slow IV bolus); LV5FU2 = de Gramont/FOLFOX4 sem oxaliplatina (bolus 400 por desenho).
const BOLUS_EXCECAO_D50 = ["Folinato + 5-FU semanal (P1577)", "LV5FU2 — 5-FU + folinato (P1512)"];

describe("corpus/fichas", () => {
  it("existem fichas (60 da planilha + P1477 fora dela)", () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(60);
  });

  it("toda ficha parseia no Zod (ProtocolTemplate estrito)", () => {
    for (const f of fichas) expect(() => ProtocolTemplate.parse(f.json), f.arquivo).not.toThrow();
  });

  it("nenhuma ficha é CONFERIDA_MEDICO: todas RASCUNHO (só o Dr. Silas promove)", () => {
    for (const { ficha, arquivo } of parseadas) expect(ficha.status, arquivo).toBe("RASCUNHO");
    expect(parseadas.some((p) => p.ficha.status === "CONFERIDA_MEDICO")).toBe(false);
  });

  it("hash SHA-256 do conteúdo canônico confere", () => {
    for (const { json, ficha, arquivo } of parseadas) {
      expect(ficha.hash, arquivo).toMatch(/^[0-9a-f]{64}$/);
      expect(hashDe(json), arquivo).toBe(ficha.hash);
    }
  });

  it("alterar o conteúdo muda o hash", () => {
    const { json } = parseadas[0]!;
    const adulterada = { ...json, intervaloDias: 999 };
    expect(hashDe(adulterada)).not.toBe(json.hash);
  });

  it("templateId único e identidade tumor+nome+cenário+versão única", () => {
    const ids = parseadas.map((p) => p.ficha.templateId);
    expect(new Set(ids).size).toBe(ids.length);
    const identidades = parseadas.map((p) => [p.ficha.tumor, p.ficha.nome, p.ficha.cenario, p.ficha.versao].join("|"));
    expect(new Set(identidades).size).toBe(identidades.length);
  });

  it("fonte citada e limiaresBula só com fonte (ou null)", () => {
    for (const { ficha, arquivo } of parseadas) {
      expect(ficha.fonte.length, arquivo).toBeGreaterThan(20);
      if (ficha.limiaresBula !== null) expect(ficha.limiaresBula.fonte.length, arquivo).toBeGreaterThan(0);
    }
  });

  it("sequence é 1..n sem buracos e nenhum item ajustado de fábrica", () => {
    for (const { ficha, arquivo } of parseadas) {
      expect(ficha.itens.map((i) => i.sequence), arquivo).toEqual(ficha.itens.map((_, k) => k + 1));
      for (const i of ficha.itens) {
        expect(i.adjustmentPercent, arquivo).toBeNull();
        expect(i.calculatedDose, arquivo).toBeNull();
        expect(i.prescribedDose, arquivo).toBeNull();
        expect(i.source, arquivo).toBe("PROTOCOL");
      }
    }
  });

  describe("5-FU", () => {
    it("esquemas de bomba (FOLFOX/FOLFIRI/FOLFIRINOX/FOLFOXIRI/FLOT/LV5FU2): um único 5-FU, infusão de 46 h, sem bolus", () => {
      const familia = parseadas.filter((p) => FAMILIA_BOMBA.test(p.ficha.nome));
      expect(familia.length).toBe(11); // + FOLFIRI + Bevacizumabe (D-W9-61)
      for (const { ficha, arquivo } of familia) {
        const fus = ficha.itens.filter((i) => eh5fu(i.drug));
        expect(fus.length, arquivo).toBe(1);
        expect(fus[0]!.infusionTime, arquivo).toBe("46 h");
        expect(fus[0]!.drug, arquivo).not.toMatch(/bolus/i);
        expect(fus[0]!.days, arquivo).toEqual(["d1"]);
      }
    });

    it("bolus de 5-FU só no Mayo, Roswell Park e CMF (desenho do esquema); nunca em esquema de bomba", () => {
      for (const { ficha, arquivo } of parseadas) {
        const bolus = ficha.itens.filter((i) => eh5fu(i.drug) && /bolus/i.test(i.drug));
        if (bolus.length === 0) continue;
        if (BOLUS_EXCECAO_FOLFOX4.includes(ficha.nome) || BOLUS_EXCECAO_D50.includes(ficha.nome)) continue;
        expect(BOLUS_POR_DESENHO.test(ficha.nome), arquivo).toBe(true);
        expect(FAMILIA_BOMBA.test(ficha.nome), arquivo).toBe(false);
      }
      const nomesComBolus = parseadas.filter((p) => p.ficha.itens.some((i) => eh5fu(i.drug) && /bolus/i.test(i.drug))).map((p) => p.ficha.nome).sort();
      expect(nomesComBolus).toEqual(["5-FU + Leucovorina (Mayo Clinic)", "5-FU + Leucovorina (Roswell Park)", "CMF", ...BOLUS_EXCECAO_FOLFOX4, ...BOLUS_EXCECAO_D50].sort());
    });

    it("a FOLFOX de 46 h existente continua sem bolus e em 46 h", () => {
      const folfox = parseadas.find((p) => p.ficha.nome === "FOLFOX")!;
      expect(folfox.ficha.itens.some((i) => eh5fu(i.drug) && /bolus/i.test(i.drug))).toBe(false);
      expect(folfox.ficha.itens.find((i) => eh5fu(i.drug))!.infusionTime).toBe("46 h");
    });

    it("todo 5-FU infusional é 46 h, exceto os declarados; dose pendente (null) não tem administração", () => {
      for (const { ficha, arquivo } of parseadas) {
        for (const i of ficha.itens.filter((x) => eh5fu(x.drug) && !/bolus/i.test(x.drug))) {
          if (i.standardDose === null) continue; // F1-B2 (D-F1-49): P1577/P1512 — dose NAO_LOCALIZADO, nada a conferir
          const esperado = INFUSAO_FORA_46H[ficha.nome] ?? "46 h";
          expect(i.infusionTime, arquivo).toBe(esperado);
        }
      }
    });

    it("nenhuma ficha de 5-FU sai com infusão de 8 h (a planilha 'sem bomba' não vira ficha)", () => {
      for (const { ficha, arquivo } of parseadas)
        for (const i of ficha.itens.filter((x) => eh5fu(x.drug))) expect(i.infusionTime, arquivo).not.toBe("8 h");
    });
  });

  describe("antiemese e pré-medicação locais", () => {
    it("nenhuma ficha cita aprepitanto, fosaprepitanto ou netupitanto (sem NK1)", () => {
      for (const f of fichas) expect(f.texto.toLowerCase(), f.arquivo).not.toMatch(/aprepit|netupit/);
    });

    it("todo taxano tem cimetidina 300 mg nos mesmos dias", () => {
      let taxanos = 0;
      for (const { ficha, arquivo } of parseadas) {
        for (const t of ficha.itens.filter((i) => ehTaxano(i.drug))) {
          taxanos++;
          const cim = ficha.itens.find((i) => /cimetidina/i.test(i.drug));
          expect(cim, arquivo).toBeDefined();
          expect(cim!.standardDose, arquivo).toBe(300);
          expect(cim!.unit, arquivo).toBe("mg");
          expect(cim!.classe, arquivo).toBe("PRE_QT");
          for (const d of t.days) expect(cim!.days, arquivo).toContain(d);
        }
      }
      expect(taxanos).toBeGreaterThan(20);
    });

    it("fichas EV levam ondansetrona + dexametasona + prometazina VO; sem difenidramina", () => {
      for (const { ficha, arquivo } of parseadas) {
        expect(ficha.itens.some((i) => /difenidramina/i.test(i.drug)), arquivo).toBe(false);
        const temEV = ficha.itens.some((i) => i.classe === "QT" && i.route === "EV");
        if (!temEV) continue;
        if (ficha.nome === "Cemiplimabe" || ficha.nome === "Pembrolizumabe") continue; // F1-B2 (D-F1-49/50): anti-PD1 sem pré-medicação de rotina (eviQ 4151/5066)
        const nomes = ficha.itens.map((i) => i.drug.toLowerCase());
        expect(nomes.some((n) => n.startsWith("ondansetrona")), arquivo).toBe(true);
        expect(nomes.some((n) => n.startsWith("dexametasona")), arquivo).toBe(true);
        const prom = ficha.itens.find((i) => /prometazina/i.test(i.drug));
        expect(prom, arquivo).toBeDefined();
        expect(prom!.route, arquivo).toBe("VO");
      }
    });

    it("olanzapina nunca é item: só observação opcional", () => {
      for (const { ficha, arquivo } of parseadas) expect(ficha.itens.some((i) => /olanzapina/i.test(i.drug)), arquivo).toBe(false);
    });
  });

  describe("cisplatina", () => {
    it("hidratação com Mg/K (pré) e KCl (pós) em cada dia de cisplatina; manitol junto", () => {
      let comCis = 0;
      for (const { ficha, arquivo } of parseadas) {
        const cis = ficha.itens.find((i) => /^cisplatina/i.test(i.drug));
        if (!cis) continue;
        comCis++;
        for (const d of cis.days) {
          const pre = (re: RegExp) => ficha.itens.some((i) => i.classe === "PRE_QT" && re.test(i.drug) && i.days.includes(d));
          expect(pre(/magn[eé]sio/i), `${arquivo} Mg ${d}`).toBe(true);
          expect(pre(/pot[aá]ssio/i), `${arquivo} K ${d}`).toBe(true);
          expect(pre(/pr[eé]-cisplatina/i), `${arquivo} SF pré ${d}`).toBe(true);
          expect(ficha.itens.some((i) => i.classe === "POS_QT" && /pot[aá]ssio/i.test(i.drug) && i.days.includes(d)), `${arquivo} KCl pós ${d}`).toBe(true);
          expect(ficha.itens.some((i) => i.classe === "POS_QT" && /p[oó]s-cisplatina/i.test(i.drug) && i.days.includes(d)), `${arquivo} SF pós ${d}`).toBe(true);
          expect(ficha.itens.some((i) => /manitol/i.test(i.drug) && i.days.includes(d)), `${arquivo} manitol ${d}`).toBe(true);
        }
      }
      expect(comCis).toBeGreaterThanOrEqual(7);
    });

    it("P1477 (cisplatina D1 e D8): hidratação Mg/K nos dois dias e doses null", () => {
      const p = parseadas.find((x) => x.ficha.codigoInstitucional === "P1477")!;
      const cis = p.ficha.itens.find((i) => /^cisplatina/i.test(i.drug))!;
      expect(cis.days).toEqual(["d1", "d8"]);
      expect(cis.standardDose).toBeNull();
      for (const d of ["d1", "d8"]) {
        expect(p.ficha.itens.some((i) => /magn[eé]sio/i.test(i.drug) && i.days.includes(d))).toBe(true);
        expect(p.ficha.itens.some((i) => /pot[aá]ssio/i.test(i.drug) && i.classe === "PRE_QT" && i.days.includes(d))).toBe(true);
      }
    });
  });

  describe("dose ausente = null e erros do manual SOnHe não entram", () => {
    it("FLOT: 5-FU 2.400 mg/m² em 46 h (D-W9-59)", () => {
      for (const p of parseadas.filter((x) => x.ficha.nome === "FLOT")) {
        const fu = p.ficha.itens.find((i) => eh5fu(i.drug))!;
        expect(fu.standardDose).toBe(2400);
        expect(fu.infusionTime).toBe("46 h");
      }
    });

    it("gemcitabina + capecitabina: 830 mg/m² (não 1.660); sem erros do manual (ifosfamida em g/m², topotecano 1.200, amivantamabe)", () => {
      const gc = parseadas.find((x) => x.ficha.nome === "Gemcitabina + Capecitabina")!;
      expect(gc.ficha.itens.find((i) => /capecitabina/i.test(i.drug))!.standardDose).toBe(830);
      for (const { ficha, arquivo } of parseadas) {
        expect(ficha.itens.some((i) => /amivantamabe/i.test(i.drug)), arquivo).toBe(false);
        for (const i of ficha.itens.filter((x) => /ifosfamida|topotecan/i.test(x.drug))) {
          expect(i.unit, arquivo).toBe("mg/m²");
          if (/topotecan/i.test(i.drug)) expect(i.standardDose, arquivo).not.toBe(1200);
        }
        for (const i of ficha.itens) expect([1660, 2400].includes(i.standardDose ?? 0) && /capecitabina/i.test(i.drug), arquivo).toBe(false);
      }
    });

    it("dose zero nunca aparece (positiva ou null)", () => {
      for (const { ficha, arquivo } of parseadas) for (const i of ficha.itens) expect(i.standardDose === null || i.standardDose > 0, arquivo).toBe(true);
    });
  });

  describe("códigos institucionais das fichas reais", () => {
    const porCodigo = (c: string) => parseadas.filter((p) => p.ficha.codigoInstitucional === c).map((p) => `${p.ficha.tumor}|${p.ficha.nome}`).sort();
    it("P1603, P1456, P1477, P1393, P1426 casados", () => {
      expect(porCodigo("P1603")).toEqual(["Mama|Doxorrubicina + Paclitaxel (AT)"]);
      expect(porCodigo("P1393")).toEqual(["Mama|AC-T (fase T — paclitaxel semanal)"]);
      expect(porCodigo("P1426")).toEqual(["Pulmão (CPNPC)|Cisplatina + Docetaxel"]);
      expect(porCodigo("P1456")).toEqual(["Cabeça e pescoço|Carboplatina + Docetaxel", "Pulmão (CPNPC)|Carboplatina + Docetaxel"]);
      expect(porCodigo("P1477")).toEqual(["Não informado (ficha institucional)|Cisplatina + Gemcitabina (D1 e D8)"]);
    });
    it("todo código segue P####", () => {
      for (const { ficha } of parseadas) if (ficha.codigoInstitucional !== null) expect(ficha.codigoInstitucional).toMatch(/^P\d{4}$/);
    });
  });
});

describe("esquemas novos (D-W9-61)", () => {
  const por = (nome: string) => parseadas.filter((p) => p.ficha.nome === nome);
  it("mesna nos 3 horários (0/4/8 h) em toda ficha com ifosfamida; 8 h sem fonte = null", () => {
    const ifo = parseadas.filter((p) => p.ficha.itens.some((i) => /^ifosfamida/i.test(i.drug)));
    expect(ifo.map((p) => p.ficha.nome).sort()).toEqual(["Ewing IE (ciclo B — alternado ao VDC)", "Ifosfamida + Gemcitabina", "Ifosfamida + Mesna", "Ifosfamida + Topotecana"]);
    for (const { ficha, arquivo } of ifo) {
      for (const h of ["0 h", "4 h", "8 h"]) expect(ficha.itens.filter((i) => i.drug === `Mesna (${h})`).length, `${arquivo} ${h}`).toBe(1);
      // F1-B2 (D-F1-49): mesna 8h SEM fonte = null (D-W9-61); no Ewing IE eviQ 3465 documenta 600 mg/m².
      if (ficha.nome !== "Ewing IE (ciclo B — alternado ao VDC)") expect(ficha.itens.find((i) => i.drug === "Mesna (8 h)")!.standardDose, arquivo).toBeNull();
      else expect(ficha.itens.find((i) => i.drug === "Mesna (8 h)")!.standardDose, arquivo).toBe(600);
    }
    const m = por("Ifosfamida + Mesna")[0]!.ficha;
    expect(m.itens.find((i) => /^ifosfamida/i.test(i.drug))!.standardDose).toBe(1200);
    expect(m.itens.find((i) => i.drug === "Mesna (4 h)")!.standardDose).toBe(600);
  });
  it("combinações sem fonte (ifosfamida + gencitabina/topotecana): todas as doses null", () => {
    for (const n of ["Ifosfamida + Gemcitabina", "Ifosfamida + Topotecana"])
      for (const i of por(n)[0]!.ficha.itens.filter((x) => /ifosfamida|gemcitabina|topotecana|mesna/i.test(x.drug))) expect(i.standardDose, `${n} ${i.drug}`).toBeNull();
  });
  it("AC-TH: trastuzumabe ataque 8 mg/kg e manutenção 6 mg/kg; AC 60/600", () => {
    const th = por("AC-TH (fase TH — paclitaxel semanal + trastuzumabe)")[0]!.ficha;
    expect(th.itens.find((i) => /ataque/i.test(i.drug))!.standardDose).toBe(8);
    expect(th.itens.find((i) => /manuten/i.test(i.drug))!.standardDose).toBe(6);
    for (const i of th.itens.filter((x) => /trastuzumabe/i.test(x.drug))) expect(i.unit).toBe("mg/kg");
    const ac = por("AC-TH (fase AC)")[0]!.ficha;
    expect(ac.itens.find((i) => /doxorrubicina/i.test(i.drug))!.standardDose).toBe(60);
    expect(ac.itens.find((i) => /ciclofosfamida/i.test(i.drug))!.standardDose).toBe(600);
  });
  it("carbotaxol semanal de cabeça e pescoço AUC 2; Mayo 425; carbo+pacli semanal AUC 2 mantidos", () => {
    const hn = parseadas.find((p) => p.ficha.tumor === "Cabeça e pescoço" && p.ficha.nome === "Carboplatina + Paclitaxel semanal")!.ficha;
    expect(hn.itens.find((i) => /carboplatina/i.test(i.drug))!.standardDose).toBe(2);
    const mayo = por("5-FU + Leucovorina (Mayo Clinic)")[0]!.ficha;
    expect(mayo.itens.find((i) => eh5fu(i.drug))!.standardDose).toBe(425);
    for (const p of por("Carboplatina + Paclitaxel semanal (CROSS + RxT)")) expect(p.ficha.itens.find((i) => /carboplatina/i.test(i.drug))!.standardDose).toBe(2);
  });
  it("cisplatina semanal 40 mg/m² com RT (colo), GEMOX, FOLFIRI + bevacizumabe e temozolomida", () => {
    expect(por("Cisplatina semanal + RxT")[0]!.ficha.itens.find((i) => /^cisplatina/i.test(i.drug))!.standardDose).toBe(40);
    expect(por("GEMOX")[0]!.ficha.itens.map((i) => i.drug)).toEqual(expect.arrayContaining(["Gemcitabina", "Oxaliplatina"]));
    const fb = por("FOLFIRI + Bevacizumabe")[0]!.ficha;
    expect(fb.itens.find((i) => /bevacizumabe/i.test(i.drug))!.standardDose).toBe(5);
    const tmz = (n: string) => por(n)[0]!.ficha.itens.find((i) => /temozolomida/i.test(i.drug))!;
    expect(tmz("Temozolomida monoterapia (ciclo 1)").route).toBe("VO");
    expect(tmz("Temozolomida monoterapia (ciclo 1)").standardDose).toBe(150); // D-W9-62
    expect(tmz("Temozolomida monoterapia (ciclos 2 em diante)").standardDose).toBe(200);
    expect(por("GEMOX")[0]!.ficha.itens.find((i) => i.drug === "Oxaliplatina")!.standardDose).toBe(100); // D-W9-62
  });
});

describe("F1-B2 — fichas institucionais novas (D-F1-49)", () => {
  const manifest = JSON.parse(readFileSync(join(fileURLToPath(new URL(".", import.meta.url)), "../../corpus/manifesto/b2-fichas.v1.json"), "utf8")) as { fichasNovas: any[]; fichasAlteradas: any[]; fontesExternas: Record<string, any>; materiaisLocais: Record<string, any> };
  const nome = (t: string, n: string) => parseadas.find((p) => p.ficha.tumor === t && p.ficha.nome === n)!;

  it("manifesto B2 cobre 23 fichas (inclui a fase VC sem doxorrubicina) e 6 paclitaxel alteradas; nenhuma é CONFERIDA_MEDICO", () => {
    expect(manifest.fichasNovas).toHaveLength(23);
    expect(manifest.fichasAlteradas).toHaveLength(6);
    for (const f of manifest.fichasNovas) {
      const achada = parseadas.find((p) => p.ficha.templateId === f.templateId);
      expect(achada, f.arquivo).toBeDefined();
      expect(achada!.ficha.status).toBe("RASCUNHO");
      expect(achada!.ficha.fonte).toContain("D-F1-49");
    }
    for (const a of manifest.fichasAlteradas) {
      const achada = parseadas.find((p) => p.ficha.templateId === a.templateId);
      expect(achada, a.caminho).toBeDefined();
      expect(achada!.ficha.fonte).toContain(a.caminho.includes("/esofago/") ? "EXT-LEG-013" : "EXT-LEG-008");
    }
  });

  it("P1577 (D-F1-50): folinato 20 + 5-FU 425 semanais IV bolus (NHS CR004 casa com a identidade)", () => {
    const f = nome("Não informado (ficha institucional)", "Folinato + 5-FU semanal (P1577)").ficha;
    expect(f.codigoInstitucional).toBe("P1577");
    expect(f.itens.find((i) => /folinato/i.test(i.drug))!.standardDose).toBe(20);
    const fu = f.itens.find((i) => eh5fu(i.drug))!;
    expect(fu.standardDose).toBe(425);
    expect(fu.days).toEqual(["d1"]);
    expect(f.ciclos).toBe(6);
    expect(Array.from({length:f.ciclos!},(_,c)=>1+c*f.intervaloDias!)).toEqual([1,8,15,22,29,36]);
    expect(f.fonte).toContain("EXT-LEG-019");
    expect(f.intervaloDias).toBe(7);
  });

  it("LV5FU2 (P1512, D-F1-50): folinato 200 2h + 5-FU 400 bolus + 600 CI 22h, D1–D2, q14", () => {
    const f = nome("Não informado (ficha institucional)", "LV5FU2 — 5-FU + folinato (P1512)").ficha;
    expect(f.codigoInstitucional).toBe("P1512");
    expect(f.intervaloDias).toBe(14);
    expect(f.itens.find((i) => /folinato/i.test(i.drug))!.standardDose).toBe(200);
    expect(f.itens.find((i) => eh5fu(i.drug) && /bolus/i.test(i.drug))!.standardDose).toBe(400);
    const ci = f.itens.find((i) => eh5fu(i.drug) && !/bolus/i.test(i.drug))!;
    expect(ci.standardDose).toBe(600);
    expect(ci.infusionTime).toBe("22 h");
  });

  it("CUP: variantes preparadas e a dupla cisplatina+vinorelbina toda NAO_LOCALIZADO", () => {
    expect(nome("Primário desconhecido (CUP)", "Cisplatina + Docetaxel").ficha.itens.find((i) => /docetaxel/i.test(i.drug))!.standardDose).toBe(75);
    expect(nome("Primário desconhecido (CUP)", "Cisplatina + Docetaxel").ficha.itens.find((i) => /^cisplatina/i.test(i.drug))!.standardDose).toBe(75);
    const cb = nome("Primário desconhecido (CUP)", "Carboplatina + Paclitaxel 21/21 dias").ficha;
    expect(cb.itens.find((i) => /paclitaxel/i.test(i.drug))!.standardDose).toBe(200);
    expect(cb.itens.find((i) => /carboplatina/i.test(i.drug))!.standardDose).toBe(6);
    const dg = nome("Primário desconhecido (CUP)", "Docetaxel + Gemcitabina").ficha;
    expect(dg.itens.find((i) => /gemcitabina/i.test(i.drug))!.standardDose).toBe(1000);
    expect(dg.itens.find((i) => /docetaxel/i.test(i.drug))!.days).toEqual(["d8"]); // Pouessel 2004: docetaxel só no D8
    const cf = nome("Primário desconhecido (CUP)", "Cisplatina + 5-Fluorouracil (CUP escamoso)").ficha;
    expect(cf.itens.find((i) => /^cisplatina/i.test(i.drug))!.standardDose).toBe(100);
    expect(cf.itens.find((i) => eh5fu(i.drug))!.infusionTime).toBe("24 h");
    expect(cf.cenario).toContain("escamoso"); // população restrita: não generaliza
  });

  it("Ewing: pegfilgrastim D3 no VDC e D6 no IE (ambiguidade local resolvida pelo eviQ por braço)", () => {
    const vdc = nome("Ewing", "Ewing VDC (ciclo A — alternado ao IE)").ficha;
    expect(vdc.itens.find((i) => /doxorrubicina/i.test(i.drug))!.standardDose).toBe(37.5);
    expect(vdc.itens.find((i) => /doxorrubicina/i.test(i.drug))!.days).toEqual(["d1", "d2"]);
    expect(vdc.itens.find((i) => /pegfilgrastim/i.test(i.drug))!.days).toEqual(["d3"]);
    const ie = nome("Ewing", "Ewing IE (ciclo B — alternado ao VDC)").ficha;
    expect(ie.itens.find((i) => /etopos/i.test(i.drug))!.standardDose).toBe(100);
    expect(ie.itens.find((i) => /^ifosfamida/i.test(i.drug))!.standardDose).toBe(1800);
    expect(ie.itens.find((i) => /pegfilgrastim/i.test(i.drug))!.days).toEqual(["d6"]);
    expect(vdc.intervaloDias).toBe(14);
  });

  it("Osteossarcoma MAP: cisplatina 60 D1–D2 em 2 h (SBOC=eviQ), MTX 12 g D22/D29 com resgate; C5–6 sem cisplatina", () => {
    const m14 = nome("Osteossarcoma", "MAP (ciclos 1–4)").ficha;
    const cis = m14.itens.find((i) => /^cisplatina/i.test(i.drug))!;
    expect(cis.standardDose).toBe(60);
    expect(cis.days).toEqual(["d1", "d2"]);
    expect(cis.infusionTime).toBe("2 h");
    const mtx = m14.itens.find((i) => /^metotrexato/i.test(i.drug))!;
    expect(mtx.standardDose).toBe(12000);
    expect(mtx.days).toEqual(["d22", "d29"]);
    expect(m14.itens.find((i) => /resgate/i.test(i.drug))!.days).toContain("d23");
    expect(m14.intervaloDias).toBe(35);
    const m56 = nome("Osteossarcoma", "MAP (ciclos 5–6 — sem cisplatina)").ficha;
    expect(m56.itens.some((i) => /^cisplatina/i.test(i.drug))).toBe(false);
    expect(m56.itens.find((i) => /^metotrexato/i.test(i.drug))!.days).toEqual(["d15", "d22"]);
    expect(m56.intervaloDias).toBe(28);
    const ap = nome("Osteossarcoma", "AP (doxorrubicina + cisplatina)").ficha;
    expect(ap.itens.find((i) => /doxorrubicina/i.test(i.drug))!.standardDose).toBe(75);
    expect(ap.itens.find((i) => /^cisplatina/i.test(i.drug))!.standardDose).toBe(100);
  });

  it("Vulva (D-F1-35): cisplatina 40 semanal com RT e carboplatina AUC 6 + paclitaxel 175 q21d", () => {
    const v1 = nome("Vulva", "Cisplatina semanal + RxT (vulva)").ficha;
    expect(v1.itens.find((i) => /^cisplatina/i.test(i.drug))!.standardDose).toBe(40);
    expect(v1.intervaloDias).toBe(7);
    const v2 = nome("Vulva", "Carboplatina + Paclitaxel 21/21 dias (vulva)").ficha;
    expect(v2.itens.find((i) => /paclitaxel/i.test(i.drug))!.standardDose).toBe(175);
    expect(v2.itens.find((i) => /carboplatina/i.test(i.drug))!.standardDose).toBe(6);
  });

  it("CEC de pele: cemiplimabe 350 mg/50 mL/30 min sem pré-medicação; extrapolações declaradas", () => {
    const c = nome("CEC de pele (cutâneo)", "Cemiplimabe").ficha;
    const cem = c.itens.find((i) => /cemiplimabe/i.test(i.drug))!;
    expect(cem.standardDose).toBe(350);
    expect(cem.finalVolumeMl).toBe(50);
    expect(cem.infusionTime).toBe("30 min");
    expect(c.itens.some((i) => /ondansetrona|dexametasona|prometazina/i.test(i.drug))).toBe(false);
    expect(nome("CEC de pele (cutâneo)", "Carboplatina + Paclitaxel 21/21 dias (CEC de pele)").ficha.fonte).toMatch(/extrapola[iç]/i);
    expect(nome("CEC de pele (cutâneo)", "Cisplatina semanal + RxT (CEC de pele)").ficha.fonte).toMatch(/extrapola[iç]/i);
    const pem = nome("CEC de pele (cutâneo)", "Pembrolizumabe").ficha; // D-F1-50
    expect(pem.itens.find((i) => /pembrolizumabe/i.test(i.drug))!.standardDose).toBe(200);
    expect(pem.itens.find((i) => /pembrolizumabe/i.test(i.drug))!.infusionTime).toBe("30 min");
    expect(pem.fonte).toContain("EXT-SARC-008");
    expect(pem.fonte).toContain("EMA");
  });

  it("NTG: EMA/EP com D2 SOMENTE folínico (Lok 2025 Tabela A5/Figura A4); EMA-CO e baixo risco conforme eviQ", () => {
    const ep = nome("Neoplasia trofoblástica gestacional", "EMA/EP (resistência ao EMA-CO)").ficha;
    const d2 = ep.itens.filter((i) => i.days.includes("d2"));
    expect(d2.map((i) => i.drug)).toEqual(["Folinato de cálcio (resgate do MTX +24 h)", "Folinato de cálcio (resgate do MTX +36 h)"]);
    expect(ep.itens.filter(i=>i.days.includes("d3")).map(i=>i.drug)).toEqual(["Folinato de cálcio (resgate do MTX +48 h)", "Folinato de cálcio (resgate do MTX +60 h)"]);
    expect(ep.itens.find((i) => /etoposideo-d8|Etoposideo-d8|etoposídeo \(D8/i.test(i.drug))!.standardDose).toBe(150);
    expect(ep.itens.find((i) => /^cisplatina/i.test(i.drug))!.days).toEqual(["d8"]);
    const co = nome("Neoplasia trofoblástica gestacional", "EMA-CO (alto risco)").ficha;
    expect(co.itens.find((i) => /^metotrexato/i.test(i.drug))!.infusionTime).toBe("12 h");
    expect(co.itens.find((i) => /vincristina/i.test(i.drug))!.standardDose).toBe(0.8); // D-F1-50
    expect(co.itens.find((i) => /filgrastim/i.test(i.drug))!.days).toEqual(["d3-d5", "d9-d11"]);
    const br = nome("Neoplasia trofoblástica gestacional", "Metotrexato + ácido folínico (baixo risco)").ficha;
    expect(br.itens.find((i) => /^metotrexato/i.test(i.drug))!.days).toEqual(["d1", "d3", "d5", "d7"]);
    expect(br.itens.find((i) => /^metotrexato/i.test(i.drug))!.standardDose).toBe(50); // D-F1-50: 50 mg fixa
    const fol = br.itens.find((i) => /folínico/i.test(i.drug))!;
    expect(fol.days).toEqual(["d2", "d4", "d6", "d8"]);
    expect(fol.standardDose).toBe(7.5); // D-F1-50: 7,5 mg (Charing Cross clássico)
    expect(br.cenario).toContain("0–4"); // D-F1-50: corte baixo risco 0–4
    const ep5 = nome("Neoplasia trofoblástica gestacional", "EP de indução (escore ultra-alto)").ficha;
    expect(ep5.intervaloDias).toBe(7);
    expect(ep5.cenario).toContain("12"); // D-F1-50: ultra-alto ≥12
  });

  it("Osteossarcoma (D-F1-50): idade-limite 40 anos registrada; doxorrubicina permanece 25×3 (SBOC)", () => {
    const m14 = nome("Osteossarcoma", "MAP (ciclos 1–4)").ficha;
    expect(m14.itens.find((i) => /doxorrubicina/i.test(i.drug))!.standardDose).toBe(25); // D-F1-50: só a idade mudou
    expect(m14.itens.find((i) => /doxorrubicina/i.test(i.drug))!.days).toEqual(["d1", "d2", "d3"]);
    expect(m14.fonte).toContain("D-F1-50");
    expect(nome("Osteossarcoma", "AP (doxorrubicina + cisplatina)").ficha.fonte).toContain("40 anos");
  });

  it("manifesto: dose DOCUMENTADA tem fonte existente; NAO_LOCALIZADO tem valor null; fontes com hash completo", () => {
    const fontes = { ...manifest.fontesExternas, ...manifest.materiaisLocais };
    for (const [id, f] of Object.entries(fontes)) expect(f.sha256, id).toMatch(/^[a-f0-9]{64}$/);
    let naoLocalizado = 0;
    for (const f of manifest.fichasNovas) for (const c of f.campos) {
      if (c.situacao === "NAO_LOCALIZADO") { naoLocalizado++; expect(c.valor).toBeNull(); }
      if (c.situacao === "DOCUMENTADO") for (const s of c.sourceIds) expect(fontes[s], `${f.arquivo} ${s}`).toBeDefined();
    }
    expect(naoLocalizado).toBe(0); // D-F1-50: P1577 dosado (NHS CR004), P1512->LV5FU2, cis+vinorelbina retirada
  });
});
