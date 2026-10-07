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
const FAMILIA_BOMBA = /\b(FOLFOX|FOLFIRI|FOLFIRINOX|FOLFOXIRI|FLOT|LV5FU2)\b/i;
// 5-FU em bolus só onde o bolus é o desenho do esquema (Mayo mantido por D-W9-23b; Roswell Park; CMF).
const BOLUS_POR_DESENHO = /Mayo Clinic|Roswell Park|^CMF$/;
// Outros 5-FU infusionais fora da bomba de 46 h, declarados um a um (revisão institucional / esquema próprio).
const INFUSAO_FORA_46H: Record<string, string> = {
  "DCF modificado (institucional)": "6 h",
  "Cisplatina + 5-Fluorouracil (PF)": "24 h",
};

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
      expect(familia.length).toBe(10);
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
        expect(BOLUS_POR_DESENHO.test(ficha.nome), arquivo).toBe(true);
        expect(FAMILIA_BOMBA.test(ficha.nome), arquivo).toBe(false);
      }
      const nomesComBolus = parseadas.filter((p) => p.ficha.itens.some((i) => eh5fu(i.drug) && /bolus/i.test(i.drug))).map((p) => p.ficha.nome).sort();
      expect(nomesComBolus).toEqual(["5-FU + Leucovorina (Mayo Clinic)", "5-FU + Leucovorina (Roswell Park)", "CMF"]);
    });

    it("todo 5-FU infusional é 46 h, exceto os dois esquemas fora de bomba declarados", () => {
      for (const { ficha, arquivo } of parseadas) {
        for (const i of ficha.itens.filter((x) => eh5fu(x.drug) && !/bolus/i.test(x.drug))) {
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
    it("FLOT: dose do 5-FU null (2.400 x 2.600 ambíguo) mas infusão 46 h", () => {
      for (const p of parseadas.filter((x) => x.ficha.nome === "FLOT")) {
        const fu = p.ficha.itens.find((i) => eh5fu(i.drug))!;
        expect(fu.standardDose).toBeNull();
        expect(fu.infusionTime).toBe("46 h");
      }
    });

    it("gemcitabina + capecitabina: 830 mg/m² (não 1.660); sem ifosfamida/topotecano/amivantamabe", () => {
      const gc = parseadas.find((x) => x.ficha.nome === "Gemcitabina + Capecitabina")!;
      expect(gc.ficha.itens.find((i) => /capecitabina/i.test(i.drug))!.standardDose).toBe(830);
      for (const { ficha, arquivo } of parseadas) {
        expect(ficha.itens.some((i) => /ifosfamida|topotecano|amivantamabe/i.test(i.drug)), arquivo).toBe(false);
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
