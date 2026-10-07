// W10-INT-FICHAS · gerador determinístico das fichas (ProtocolTemplate) a partir da planilha revisada + SOnHe.
// Uso: node tests/corpus-fichas/gerar-fichas.mjs   (reescreve corpus/fichas/**; todas RASCUNHO)
// Não é teste: o teste (fichas.test.ts) valida a saída. Mantido aqui por rastreabilidade (faixa exclusiva da INT-FICHAS).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SAIDA = join(RAIZ, "corpus", "fichas");
const VERSAO = "1.0.0";

// ---------- SOnHe (só para citar página; as doses divergentes foram analisadas à mão e vão em observacao) ----------
function parseCsv(t) {
  t = t.replace(/^﻿/, "");
  const rows = []; let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { r.push(f); f = ""; }
    else if (c === "\n") { r.push(f.replace(/\r$/, "")); rows.push(r); r = []; f = ""; } else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}
const sonhe = parseCsv(readFileSync(join(RAIZ, "docs/referencias/fornecedores/SONHE-2024-PROTOCOLOS.csv"), "utf8")).slice(1);
function pagSonhe([tumor, proto]) {
  const l = sonhe.find((r) => r[0] === tumor && r[2] === proto);
  if (!l) throw new Error(`SOnHe não achou ${tumor} / ${proto}`);
  return `${tumor} "${proto}" p. ${l[15]}`;
}

// ---------- construtores de item ----------
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const UN = { m2: ["MG_M2", "mg/m²"], mg: ["FIXED", "mg"], auc: ["AUC", "AUC"], ugkg: ["MG_KG", "µg/kg"], mgkg: ["MG_KG", "mg/kg"], fr: ["FIXED", "frasco"], ml: ["FIXED", "mL"] };
function it(drug, classe, dose, un, route, days, o = {}) {
  const [doseBasis, unit] = UN[un];
  return {
    drug, classe, sequence: 0, standardDose: dose, doseBasis, calculatedDose: null, prescribedDose: null, unit,
    adjustmentPercent: null, adjustmentReason: null, route, diluent: o.dil ?? null, finalVolumeMl: o.vol ?? null,
    infusionTime: o.t ?? null, days, observacao: o.obs ?? null, source: "PROTOCOL", overrideMotivo: null,
  };
}
const qt = (drug, dose, un, days, o = {}) => it(drug, "QT", dose, un, o.route ?? "EV", days, o);
const D = (...n) => n.map((x) => `d${x}`);
const R = (a, b) => [`d${a}-d${b}`];
const SEM_NK1 = "sem antagonista NK1 (padrão local)";

// Cisplatina: hidratação pré/pós com Mg/K em CADA dia de cisplatina (D-W9-34d); manitol em Y (planilha).
const CIS = (dose, days, o = {}) => ({ cis: true, dose, days, obsCis: o.obs ?? null, dil: o.dil ?? null, vol: o.vol ?? null, t: o.t ?? "60 min" });
// 5-FU em bomba de 46 h SEM bolus (D-W9-23a).
const FU46 = (dose, obs) => qt("Fluoruracila (5-FU) infusão contínua", dose, "m2", D(1), { t: "46 h", obs: `Bomba de infusão contínua de 46 h (d1 a d3), SEM bolus (D-W9-23a). ${obs}` });

// ---------- montagem da ficha ----------
function montar(s) {
  const itens = [];
  const pos = [];
  const temIV = !s.semPremed;
  const taxano = s.itens.some((i) => i.drug && /paclitaxel|docetaxel/i.test(i.drug));
  const diasTaxano = taxano ? s.itens.find((i) => /paclitaxel|docetaxel/i.test(i.drug ?? "")).days : null;
  const pd = s.premedDias ?? D(1);
  if (temIV) {
    itens.push(it("Soro fisiológico 0,9% 250 mL (lavagem de acesso)", "PRE_QT", 1, "fr", "EV", pd, { vol: 250, obs: "Lavar acesso venoso pré e pós QT (planilha)." }));
    itens.push(it("Ondansetrona", "PRE_QT", s.ond ?? 8, "mg", "EV", pd, { t: "15 min", obs: s.obsOnd ?? "Planilha: 8 mg EV; fichas reais do serviço usam 16 mg em alguns esquemas [VERIFICAR]." }));
    itens.push(it("Dexametasona", "PRE_QT", s.dex ?? 10, "mg", "EV", pd, {
      t: "15 min",
      obs: s.altoRisco ? `Alto risco emetogênico: olanzapina 5 mg VO opcional (D-W9-34c); ${SEM_NK1}.` : "Antiemese local sem NK1 (D-W9-23c/34c).",
    }));
    const dif = s.tinhaDifen ? " Planilha trazia difenidramina 1 amp EV; substituída por prometazina VO (D-W9-34c)." : "";
    itens.push(it("Prometazina", "PRE_QT", 25, "mg", "VO", pd, { obs: `Pré-medicação local (D-W9-34c).${taxano ? " 30 min antes do taxano (ficha real P1456)." : ""}${dif}` }));
    if (taxano) itens.push(it("Cimetidina", "PRE_QT", 300, "mg", "EV", diasTaxano, { t: "15 min", obs: "Todo taxano (D-W9-34c). A ficha real P1426 (docetaxel + CDDP) não trazia cimetidina; vale a regra posterior." }));
    if (s.atropina) itens.push(it("Atropina sulfato", "PRE_QT", 0.25, "mg", "EV", D(1), { t: "5 min", obs: "Prevenção de síndrome colinérgica aguda do irinotecano (planilha)." }));
  }
  for (const x of s.itens) {
    if (!x.cis) { itens.push(x); continue; }
    itens.push(it("Soro fisiológico 0,9% 500 mL (pré-cisplatina)", "PRE_QT", 1, "fr", "EV", x.days, { vol: 500, t: "20 min", obs: "Correr aberto antes da cisplatina. Fichas reais P1426/P1477: 60 min [VERIFICAR]." }));
    itens.push(it("Sulfato de magnésio 10% 10 mL", "PRE_QT", 10, "ml", "EV", x.days, { obs: "Aditivo da bolsa pré-cisplatina, em cada dia de cisplatina (D-W9-34d; fichas reais P1426/P1477)." }));
    itens.push(it("Cloreto de potássio 19,1% 4 mL", "PRE_QT", 4, "ml", "EV", x.days, { obs: "Aditivo da bolsa pré-cisplatina, em cada dia de cisplatina (D-W9-34d; fichas reais P1426/P1477)." }));
    itens.push(qt("Cisplatina", x.dose, "m2", x.days, { t: x.t, dil: x.dil, vol: x.vol, obs: `${x.obsCis ? x.obsCis + " " : ""}Taxa máxima 1 mg/min (fichas reais P1426/P1477); planilha informa 60 min — conferir [VERIFICAR].` }));
    itens.push(qt("Manitol 20% frasco 250 mL", 1, "fr", x.days, { vol: 250, t: "60 min", obs: "Correr em Y com a cisplatina (planilha). Fichas reais: 200 mL [VERIFICAR]." }));
    pos.push(it("Soro fisiológico 0,9% 500 mL (pós-cisplatina)", "POS_QT", 1, "fr", "EV", x.days, { vol: 500, t: "20 min", obs: "Correr aberto após a cisplatina." }));
    pos.push(it("Cloreto de potássio 19,1% 4 mL", "POS_QT", 4, "ml", "EV", x.days, { obs: "Aditivo da bolsa pós-cisplatina, em cada dia de cisplatina (D-W9-34d). D-W9-34d cita Mg/K pré e pós; as fichas reais só têm KCl no pós [VERIFICAR]." }));
  }
  itens.push(...(s.posQt ?? []));
  itens.push(...pos);
  if (temIV) itens.push(it("Soro fisiológico 0,9% 250 mL (lavagem pós-QT)", "POS_QT", 1, "fr", "EV", pd, { vol: 250, obs: "Lavar acesso venoso pós-QT (planilha)." }));
  const finais = itens.map((x, i) => ({ ...x, sequence: i + 1 }));
  const baseId = `${slug(s.nome)}__${slug(s.cenario)}`;
  const t = {
    templateId: `FICHA.${slug(s.tumor)}.${baseId}@${VERSAO}`,
    tumor: s.tumor, nome: s.nome, cenario: s.cenario, versao: VERSAO, hash: "",
    codigoInstitucional: s.codigo ?? null, intervaloDias: s.intervalo ?? null, ciclos: s.ciclos ?? null,
    itens: finais, limiaresBula: null,
    fonte: `Planilha revisada Dr. Silas (docs/referencias/protocolos/protocolos-citotoxicos-revisado-silas.csv, aba SUS-Estado)${s.sonhe ? `; SOnHe 2024 (secundária, setor privado): ${s.sonhe.map(pagSonhe).join("; ")}` : ""}${s.fonteExtra ? `; ${s.fonteExtra}` : ""}; decisões D-W9-23, D-W9-34, D-W9-50.`,
    status: "RASCUNHO",
  };
  t.hash = hashDe(t);
  return { t, tumorSlug: slug(s.tumor), arquivo: `${baseId}.json`, div: s.div ?? [] };
}
export function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
/** SHA-256 do conteúdo canônico (chaves ordenadas), sem `hash` e sem `status` (ciclo de vida: promover não muda o conteúdo). */
export function hashDe(t) {
  const { hash: _h, status: _s, ...resto } = t;
  return createHash("sha256").update(canonico(resto), "utf8").digest("hex");
}

// ---------- fichas ----------
const PAL = "paliativo/metastático", NE = "não especificado", ADJ = "adjuvante", NEO = "neo/adjuvante", RT = "concomitante à RT";
const DOCE_OBS = "[VERIFICAR] sem dexametasona VO de 3 dias (padrão de bula): a planilha só traz dexametasona 10 mg EV no dia (D-W9-22i).";
const FICHAS = [];
const F = (s) => FICHAS.push(s);

// ===== PRÓSTATA =====
F({ tumor: "Próstata", nome: "Docetaxel quinzenal", cenario: PAL, intervalo: 14, ciclos: null, sonhe: [["Próstata", "Docetaxel quinzenal"]],
  div: ["Docetaxel: planilha D1 e D15 em ciclo de 28 d; SOnHe D1 a cada 14 d (vale SOnHe).", "Prednisona: planilha contínuo; SOnHe D1-D14 12/12 h (vale SOnHe)."],
  itens: [qt("Docetaxel", 50, "m2", D(1), { t: "60 min", obs: `Planilha: D1 e D15 em ciclo de 28 d ("fracionado quinzenal"); SOnHe: D1 a cada 14 d (vale SOnHe, D-W9-50). ${DOCE_OBS}` })],
  posQt: [it("Prednisona", "POS_QT", 5, "mg", "VO", R(1, 14), { obs: "12/12 h. Planilha: contínuo; SOnHe: D1 a D14 (vale SOnHe, D-W9-50)." })] });
F({ tumor: "Próstata", nome: "Docetaxel 21/21 dias", cenario: PAL, intervalo: 21, ciclos: null, sonhe: [["Próstata", "Docetaxel q21d"]],
  div: ["Prednisona: planilha contínuo; SOnHe D1-D21 12/12 h (vale SOnHe).", "Ciclos: SOnHe até 6 (sensível à castração) ou até progressão (resistente): null."],
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: `SOnHe: até 6 ciclos (sensível à castração) ou até progressão (resistente à castração). ${DOCE_OBS}` })],
  posQt: [it("Prednisona", "POS_QT", 5, "mg", "VO", R(1, 21), { obs: "12/12 h. Planilha: contínuo; SOnHe: D1 a D21 (vale SOnHe, D-W9-50)." })] });
F({ tumor: "Próstata", nome: "Carboplatina + Paclitaxel semanal", cenario: NE, intervalo: 7, ciclos: null,
  itens: [qt("Paclitaxel", 80, "m2", D(1), { t: "60 min" }), qt("Carboplatina", 2, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 2) semanal (planilha)." })] });
F({ tumor: "Próstata", nome: "Carboplatina + Paclitaxel 21/21 dias", cenario: NE, intervalo: 21, ciclos: null, tinhaDifen: true,
  itens: [qt("Paclitaxel", 175, "m2", D(1), { t: "3 h" }), qt("Carboplatina", 5, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 5) (planilha)." })] });

// ===== MAMA =====
const MAMA = "Mama";
F({ tumor: MAMA, nome: "AC-T (fase AC)", cenario: NEO, intervalo: 21, ciclos: 4, altoRisco: true, sonhe: [[MAMA, "Esquema AC convencional"]],
  itens: [qt("Doxorrubicina", 60, "m2", D(1), { t: "10 min", obs: "Seguido de paclitaxel semanal após 4 ciclos (AC-T)." }), qt("Ciclofosfamida", 600, "m2", D(1), { t: "30 min" })] });
F({ tumor: MAMA, nome: "AC-T (fase T — paclitaxel semanal)", cenario: ADJ, intervalo: 7, ciclos: 12, codigo: "P1393",
  sonhe: [[MAMA, "Esquema T (Paclitaxel semanal adjuvante)"]], fonteExtra: "ficha real P1393 (docs/referencias/modelos/05)",
  div: ["Ficha real P1393 tem Dose Prot 0 (sem base mg/m²): vale a dose planilha/SOnHe 80 mg/m²."],
  itens: [qt("Paclitaxel", 80, "m2", D(1), { t: "60 min", dil: "SF 0,9%", vol: 250, obs: "Ficha real P1393: dose fixa com Dose Prot 0; a base mg/m² vem da planilha/SOnHe." })] });
F({ tumor: MAMA, nome: "AC-CT (fase AC)", cenario: NEO, intervalo: 21, ciclos: 4, altoRisco: true, sonhe: [[MAMA, "Esquema AC convencional"]],
  itens: [qt("Doxorrubicina", 60, "m2", D(1), { t: "10 min", obs: "Seguido de carboplatina + paclitaxel semanal após 4 ciclos." }), qt("Ciclofosfamida", 600, "m2", D(1), { t: "30 min" })] });
F({ tumor: MAMA, nome: "AC-CT (fase CT — carboplatina + paclitaxel semanal)", cenario: NEO, intervalo: 7, ciclos: 12, sonhe: [[MAMA, "Esquema Carbotaxol semanal"]],
  itens: [qt("Paclitaxel", 80, "m2", D(1), { t: "60 min", obs: "Semanal." }), qt("Carboplatina", 2, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 2) semanal; SOnHe aceita faixa 1,5 a 2." })] });
F({ tumor: MAMA, nome: "TC", cenario: NEO, intervalo: 21, ciclos: 4, sonhe: [[MAMA, "Esquema TC"]],
  div: ["Ciclos: planilha 4; SOnHe 4 a 6 (mantido 4 da planilha)."],
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: `SOnHe: 4 a 6 ciclos (planilha: 4). ${DOCE_OBS}` }), qt("Ciclofosfamida", 600, "m2", D(1), { t: "30 min" })],
  posQt: [it("Filgrastim", "POS_QT", 5, "ugkg", "SC", R(2, 8), { obs: "5 µg/kg/dia, 24–72 h após QT (planilha). O SOnHe não traz G-CSF fixo para o TC." })] });
F({ tumor: MAMA, nome: "CMF", cenario: NE, intervalo: 28, ciclos: 6, premedDias: D(1, 8),
  itens: [qt("Ciclofosfamida", 600, "m2", D(1, 8), { t: "30 min" }), qt("Metotrexato", 40, "m2", D(1, 8), { t: "10 min" }),
    qt("Fluoruracila (5-FU) em bolus", 600, "m2", D(1, 8), { t: "10 min", obs: "O bolus é o desenho do CMF (não é esquema de bomba de 46 h)." })] });
F({ tumor: MAMA, nome: "Doxorrubicina + Paclitaxel (AT)", cenario: NE, intervalo: 21, ciclos: 4, codigo: "P1603", tinhaDifen: true,
  fonteExtra: "ficha real P1603 (docs/referencias/modelos/05)",
  div: ["Doxorrubicina: planilha 50 mg/m²; ficha real P1603 60 mg/m² — decidido 60 pelo Dr. Silas (D-W9-59)."],
  itens: [qt("Doxorrubicina", 60, "m2", D(1), { t: "10 min", dil: "SF 0,9%", vol: 100, obs: "60 mg/m² decidido pelo Dr. Silas (D-W9-59; ficha real P1603, 15 min). Planilha trazia 50." }),
    qt("Paclitaxel", 175, "m2", D(1), { t: "3 h", dil: "SF 0,9%", vol: 500 })] });
F({ tumor: MAMA, nome: "Docetaxel monoterapia", cenario: PAL, intervalo: 21, ciclos: null, sonhe: [[MAMA, "Docetaxel"]],
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: DOCE_OBS })] });
F({ tumor: MAMA, nome: "Paclitaxel monoterapia 21/21 dias", cenario: NE, intervalo: 21, ciclos: null, tinhaDifen: true,
  itens: [qt("Paclitaxel", 175, "m2", D(1), { t: "3 h" })] });
F({ tumor: MAMA, nome: "Gemcitabina", cenario: PAL, intervalo: 21, ciclos: null, premedDias: D(1, 8), sonhe: [[MAMA, "Gencitabina"]],
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8), { t: "30 min" })] });
F({ tumor: MAMA, nome: "Capecitabina monoterapia", cenario: PAL, intervalo: 21, ciclos: null, semPremed: true, sonhe: [[MAMA, "Capecitabina"]],
  div: ["Capecitabina: planilha 1.250 mg/m²; SOnHe paliativo 1.000 (vale SOnHe; 1.250 é o adjuvante do SOnHe)."],
  itens: [qt("Capecitabina", 1000, "m2", R(1, 14), { route: "VO", obs: "Dose por administração, 12/12 h; nº de comprimidos pela SC. Planilha: 1.250 mg/m²; SOnHe paliativo: 1.000 mg/m² (vale SOnHe, D-W9-50); SOnHe adjuvante: 1.250." })] });
F({ tumor: MAMA, nome: "Capecitabina + Docetaxel (XT)", cenario: PAL, intervalo: 21, ciclos: null, sonhe: [[MAMA, "Docetaxel + Capecitabina"]],
  div: ["Capecitabina: planilha 1.250 mg/m²; SOnHe 1.000 (vale SOnHe)."],
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: DOCE_OBS }),
    qt("Capecitabina", 1000, "m2", R(1, 14), { route: "VO", obs: "Dose por administração, 12/12 h; nº de comprimidos pela SC. Planilha: 1.250 mg/m²; SOnHe: 1.000 mg/m² (vale SOnHe, D-W9-50)." })] });
F({ tumor: MAMA, nome: "Carboplatina + Paclitaxel 21/21 dias", cenario: PAL, intervalo: 21, ciclos: null, tinhaDifen: true, sonhe: [[MAMA, "Carboplatina + Paclitaxel"]],
  div: ["Carboplatina: planilha AUC 5; SOnHe AUC 6 (vale SOnHe)."],
  itens: [qt("Paclitaxel", 175, "m2", D(1), { t: "3 h" }), qt("Carboplatina", 6, "auc", D(1), { t: "60 min", obs: "Planilha: Calvert AUC 5; SOnHe: AUC 6 (vale SOnHe, D-W9-50)." })] });
F({ tumor: MAMA, nome: "Carboplatina + Gemcitabina", cenario: NE, intervalo: 21, ciclos: null, premedDias: D(1, 8),
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8), { t: "30 min" }), qt("Carboplatina", 5, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 5), apenas D1 (planilha)." })] });

// ===== PULMÃO =====
const PUL = "Pulmão (CPNPC)", SP = "Pulmão CPNPC";
F({ tumor: PUL, nome: "Cisplatina + Gemcitabina", cenario: NE, intervalo: 21, ciclos: 6, premedDias: D(1, 8), altoRisco: true, sonhe: [[SP, "CDDP + Gencitabina"]],
  div: ["Gemcitabina: planilha 1.250 mg/m²; SOnHe 1.000 (vale SOnHe).", "Cisplatina: planilha 75 mg/m²; SOnHe 80 (vale SOnHe).", "Ciclos: planilha 6; SOnHe 4 a 6 (mantido 6)."],
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8), { t: "30 min", obs: "Planilha: 1.250 mg/m²; SOnHe: 1.000 mg/m² (vale SOnHe, D-W9-50)." }),
    CIS(80, D(1), { obs: "Planilha: 75 mg/m²; SOnHe: 80 mg/m² (vale SOnHe, D-W9-50). Cisplatina só em D1." })] });
F({ tumor: PUL, nome: "Carboplatina + Gemcitabina", cenario: NE, intervalo: 21, ciclos: 6, premedDias: D(1, 8), sonhe: [[SP, "Carboplatina + Gencitabina"]],
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8), { t: "30 min" }), qt("Carboplatina", 5, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 5), apenas D1." })] });
F({ tumor: PUL, nome: "Cisplatina + Docetaxel", cenario: NE, intervalo: 21, ciclos: 6, codigo: "P1426", altoRisco: true, fonteExtra: "ficha real P1426 (docs/referencias/modelos/05)",
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", dil: "SF 0,9%", vol: 250, obs: DOCE_OBS }), CIS(75, D(1), { dil: "SF 0,9%", vol: 500 })] });
F({ tumor: PUL, nome: "Carboplatina + Docetaxel", cenario: NE, intervalo: 21, ciclos: 6, codigo: "P1456", fonteExtra: "ficha real P1456 (docs/referencias/modelos/05; mesma droga e dose também em cabeça e pescoço)",
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", dil: "SF 0,9%", vol: 250, obs: DOCE_OBS }),
    qt("Carboplatina", 5, "auc", D(1), { t: "60 min", dil: "SG 5%", vol: 250, obs: "Calvert (AUC 5); diluente SG 5% como na ficha real P1456." })] });
F({ tumor: PUL, nome: "Cisplatina + Paclitaxel", cenario: NE, intervalo: 21, ciclos: 6, tinhaDifen: true, altoRisco: true,
  itens: [qt("Paclitaxel", 175, "m2", D(1), { t: "3 h" }), CIS(75, D(1))] });
F({ tumor: PUL, nome: "Carboplatina + Paclitaxel 21/21 dias", cenario: PAL, intervalo: 21, ciclos: 6, tinhaDifen: true, sonhe: [[SP, "Carboplatina + Paclitaxel q21d"]],
  div: ["Carboplatina: planilha AUC 5; SOnHe AUC 6 (vale SOnHe)."],
  itens: [qt("Paclitaxel", 200, "m2", D(1), { t: "3 h" }), qt("Carboplatina", 6, "auc", D(1), { t: "60 min", obs: "Planilha: Calvert AUC 5; SOnHe: AUC 6 (vale SOnHe, D-W9-50)." })] });
F({ tumor: PUL, nome: "Cisplatina + Vinorelbina", cenario: NE, intervalo: 21, ciclos: 6, premedDias: D(1, 8), altoRisco: true, sonhe: [[SP, "CDDP + Vinorelbine VO (adjuvante)"]],
  div: ["SOnHe só traz vinorelbina VO 80 mg/m² D1/D8 q21 ou EV 25 mg/m² D1,D8,D15,D22 com cisplatina 50 D1/D8 q28: nenhum casa com a planilha; mantida a planilha."],
  itens: [qt("Vinorelbina", 25, "m2", D(1, 8), { t: "10 min", obs: "Planilha: EV 25 mg/m² D1,D8. O SOnHe (VO 80 mg/m² D1/D8 q21; EV 25 mg/m² D1,D8,D15,D22 q28 com cisplatina 50 D1/D8) não casa: mantida a planilha [VERIFICAR]." }),
    CIS(80, D(1), { obs: "Planilha: 80 mg/m² (SOnHe VO: 80 mg/m² D1)." })] });
F({ tumor: PUL, nome: "Cisplatina + Pemetrexede (não escamoso)", cenario: PAL, intervalo: 21, ciclos: 6, altoRisco: true, sonhe: [[SP, "CDDP + Pemetrexede (paliativo)"]],
  div: ["Cisplatina: planilha 75 mg/m²; SOnHe paliativo 80 (vale SOnHe; 75 é o adjuvante)."],
  itens: [qt("Pemetrexede", 500, "m2", D(1), { t: "10 min", obs: "Suplementar ácido fólico + B12 (planilha; doses não informadas)." }),
    CIS(80, D(1), { obs: "Planilha: 75 mg/m²; SOnHe paliativo: 80 mg/m² (vale SOnHe, D-W9-50)." })] });
F({ tumor: PUL, nome: "Carboplatina + Pemetrexede (não escamoso)", cenario: PAL, intervalo: 21, ciclos: 6, sonhe: [[SP, "Carboplatina + Pemetrexede"]],
  itens: [qt("Pemetrexede", 500, "m2", D(1), { t: "10 min", obs: "Suplementar ácido fólico + B12 (planilha; doses não informadas)." }), qt("Carboplatina", 5, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 5)." })] });
F({ tumor: PUL, nome: "Docetaxel monoterapia", cenario: PAL, intervalo: 21, ciclos: null, sonhe: [[SP, "Docetaxel monoterapia"]],
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: DOCE_OBS })] });
F({ tumor: PUL, nome: "Gemcitabina monoterapia", cenario: NE, intervalo: 21, ciclos: null, premedDias: D(1, 8),
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8), { t: "30 min" })] });

// ===== PÂNCREAS =====
const PAN = "Pâncreas";
F({ tumor: PAN, nome: "FOLFIRINOX", cenario: PAL, intervalo: 14, ciclos: null, atropina: true, sonhe: [[PAN, "Esquema mFOLFIRINOX"]],
  div: ["Irinotecano: planilha 150 mg/m²; SOnHe 180 (vale SOnHe).", "5-FU: planilha 1.200 mg/m² D1+D2 em 8 h sem bomba; ficha 2.400 mg/m² em bomba de 46 h sem bolus (D-W9-23a; SOnHe 2.400/48 h).", "Pré-medicação/lavagem: planilha D1,D2; ficha d1 (a bomba liga em d1 e desconecta em d3)."],
  itens: [qt("Irinotecano", 180, "m2", D(1), { t: "90 min", obs: "Planilha: 150 mg/m²; SOnHe mFOLFIRINOX: 180 mg/m² (vale SOnHe, D-W9-50)." }),
    qt("Oxaliplatina", 85, "m2", D(1), { t: "2 h" }), qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h" }),
    FU46(2400, "Planilha: 1.200 mg/m² em D1 e D2, 8 h, sem bomba (total 2.400); SOnHe: 2.400 mg/m² em bomba de 48 h; total 2.400 mantido (D-W9-23a, D-W9-50).")],
  posQt: [it("Filgrastim", "POS_QT", 5, "ugkg", "SC", R(4, 10), { obs: "5 µg/kg/dia, 24–72 h após QT (planilha; o SOnHe não fixa o G-CSF do mFOLFIRINOX)." })] });
F({ tumor: PAN, nome: "Gemcitabina monoterapia", cenario: ADJ, intervalo: 28, ciclos: 6, premedDias: D(1, 8, 15), sonhe: [[PAN, "Gencitabina monoterapia"]],
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8, 15), { t: "30 min" })] });
F({ tumor: PAN, nome: "Gemcitabina + Capecitabina", cenario: NE, intervalo: 28, ciclos: 6, premedDias: D(1, 8, 15), sonhe: [[PAN, "Gencitabina + Capecitabina"]],
  div: ["Capecitabina: planilha 830 mg/m² 12/12 h; o SOnHe grafa 1.660 mg/m² 12/12 h = erro do manual (1.660 é a dose diária): NÃO entra (D-W9-50)."],
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8, 15), { t: "30 min" }),
    qt("Capecitabina", 830, "m2", R(1, 21), { route: "VO", obs: "Dose por administração, 12/12 h (total 1.660 mg/m²/dia); nº de comprimidos pela SC. O SOnHe grafa '1.660 mg/m² 12/12 h' (erro do manual): não adotado (D-W9-50)." })] });

// ===== CÓLON/RETO =====
const CR = "Cólon/Reto";
F({ tumor: CR, nome: "FOLFOXIRI", cenario: PAL, intervalo: 14, ciclos: null, atropina: true, sonhe: [["Cólon", "Esquema FOLFOXIRI"]],
  div: ["Folinato: planilha 200 mg/m² (TRIBE); SOnHe 400 (vale SOnHe).", "5-FU: planilha 2.400 mg/m² total (8 h, D1+D2); SOnHe 3.200 mg/m² em bomba (vale SOnHe); infusão 46 h sem bolus (D-W9-23a).", "Pré-medicação/lavagem: planilha D1,D2; ficha d1."],
  itens: [qt("Irinotecano", 165, "m2", D(1), { t: "90 min" }), qt("Oxaliplatina", 85, "m2", D(1), { t: "2 h" }),
    qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h", obs: "Planilha: 200 mg/m² (padrão TRIBE); SOnHe: 400 mg/m² (vale SOnHe, D-W9-50)." }),
    FU46(3200, "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400); SOnHe: 3.200 mg/m² em bomba de 48 h (vale SOnHe em dose, D-W9-50); janela de 46 h por D-W9-23a. O total do ciclo mudou de 2.400 para 3.200: conferir [VERIFICAR].")],
  posQt: [it("Filgrastim", "POS_QT", 5, "ugkg", "SC", R(4, 10), { obs: "5 µg/kg/dia, 24–72 h após QT (planilha)." })] });
F({ tumor: CR, nome: "FOLFOX", cenario: PAL, intervalo: 14, ciclos: null, sonhe: [["Cólon", "Esquema FOLFOX"]],
  div: ["5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus (o bolus 400 do SOnHe NÃO entra)."],
  itens: [qt("Oxaliplatina", 85, "m2", D(1), { t: "2 h" }), qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h", obs: "Correr em Y com a oxaliplatina." }),
    FU46(2400, "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400). O SOnHe traz também bolus de 5-FU 400 mg/m², que NÃO entra (D-W9-50).")] });
F({ tumor: CR, nome: "FOLFIRI", cenario: PAL, intervalo: 14, ciclos: null, atropina: true, sonhe: [["Cólon", "Esquema FOLFIRI"]],
  div: ["5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus (o SOnHe cita bolus apenas no FOLFOX/de Gramont)."],
  itens: [qt("Irinotecano", 180, "m2", D(1), { t: "90 min" }), qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h" }),
    FU46(2400, "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400). Sem bolus (D-W9-50).")] });
F({ tumor: CR, nome: "CAPOX (XELOX)", cenario: ADJ, intervalo: 21, ciclos: 8, sonhe: [["Cólon", "Esquema CapOx"]],
  itens: [qt("Oxaliplatina", 130, "m2", D(1), { t: "2 h" }), qt("Capecitabina", 1000, "m2", R(1, 14), { route: "VO", obs: "Dose por administração, 12/12 h; nº de comprimidos pela SC." })] });
F({ tumor: CR, nome: "Irinotecano monoterapia", cenario: NE, intervalo: 21, ciclos: null, atropina: true,
  itens: [qt("Irinotecano", 350, "m2", D(1), { t: "90 min" })] });
F({ tumor: CR, nome: "5-FU + Leucovorina (Mayo Clinic)", cenario: NE, intervalo: 28, ciclos: 6, premedDias: R(1, 5), sonhe: [[PAN, "5FU/LV"]],
  div: ["Mayo mantido (D-W9-23b): o bolus de 5-FU é o desenho do esquema; o 5FU/LV D1-D5 425/20 do SOnHe coincide."],
  itens: [qt("Folinato de cálcio (leucovorina)", 20, "m2", R(1, 5), { t: "5 min", obs: "IV push, antes do 5-FU." }),
    qt("Fluoruracila (5-FU) em bolus", 425, "m2", R(1, 5), { t: "5 min", obs: "Bolus IV (3–5 min) após o folinato: desenho do Mayo, mantido por decisão (D-W9-23b); não é esquema de bomba de 46 h." })] });
F({ tumor: CR, nome: "5-FU + Leucovorina (Roswell Park)", cenario: NE, intervalo: 56, ciclos: 3, premedDias: D(1, 8, 15, 22, 29, 36), sonhe: [["Cólon", "Esquema Roswell-Park"]],
  div: ["Ciclos: planilha 4; SOnHe 3 (vale SOnHe)."],
  itens: [qt("Folinato de cálcio (leucovorina)", 500, "m2", D(1, 8, 15, 22, 29, 36), { t: "2 h", obs: "Ciclos: planilha 4; SOnHe 3 (vale SOnHe, D-W9-50)." }),
    qt("Fluoruracila (5-FU) em bolus", 500, "m2", D(1, 8, 15, 22, 29, 36), { t: "5 min", obs: "Bolus IV (3–5 min), 1 h após o início do folinato: desenho do Roswell Park; não é esquema de bomba de 46 h." })] });
F({ tumor: "Reto", nome: "Capecitabina + RxT (radiossensibilização)", cenario: RT, intervalo: 7, ciclos: null, semPremed: true, sonhe: [["Reto", "Capecitabina (+ RT)"]],
  itens: [qt("Capecitabina", 825, "m2", ["dias de RxT (5 dias por semana)"], { route: "VO", obs: "Dose por administração, 12/12 h, nos dias de radioterapia; nº de comprimidos pela SC." })] });

// ===== ESÔFAGO =====
const ESO = "Esôfago";
const OBS_FLOT = "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400); SOnHe: 2.600 mg/m² em bomba de 24 h ('validar' no próprio manual); decisão local: 46 h. Dose decidida pelo Dr. Silas: 2.400 mg/m² (D-W9-59).";
const DIV_FLOT = ["5-FU: planilha 2.400 total em 8 h; SOnHe 2.600 em 24 h (manual pede validar); decisão local 46 h sem bolus. 5-FU 2.400 mg/m² (D-W9-59)."];
const flot = (tumor, cenario, sonheRef) => ({ tumor, nome: "FLOT", cenario, intervalo: 14, ciclos: null, sonhe: sonheRef, div: DIV_FLOT,
  itens: [qt("Docetaxel", 50, "m2", D(1), { t: "60 min", obs: DOCE_OBS }), qt("Oxaliplatina", 85, "m2", D(1), { t: "2 h" }),
    qt("Folinato de cálcio (leucovorina)", 200, "m2", D(1), { t: "2 h", obs: "LV 200 (FLOT4)." }), FU46(2400, OBS_FLOT)],
  posQt: [it("Filgrastim", "POS_QT", 5, "ugkg", "SC", R(4, 10), { obs: "5 µg/kg/dia, 24–72 h após QT (planilha)." })] });
F(flot(ESO, NE, null));
F({ tumor: ESO, nome: "Carboplatina + Paclitaxel semanal (CROSS + RxT)", cenario: RT, intervalo: 7, ciclos: 5, sonhe: [[ESO, "Esquema CROSS"]],
  itens: [qt("Paclitaxel", 50, "m2", D(1), { t: "60 min" }), qt("Carboplatina", 2, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 2) semanal." })] });
F({ tumor: ESO, nome: "FOLFOX", cenario: NE, intervalo: 14, ciclos: null,
  div: ["5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus."],
  itens: [qt("Oxaliplatina", 85, "m2", D(1), { t: "2 h" }), qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h", obs: "Correr em Y com a oxaliplatina." }),
    FU46(2400, "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400).")] });
F({ tumor: ESO, nome: "Carboplatina + Paclitaxel 21/21 dias", cenario: NE, intervalo: 21, ciclos: null, tinhaDifen: true,
  itens: [qt("Paclitaxel", 175, "m2", D(1), { t: "3 h" }), qt("Carboplatina", 5, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 5)." })] });
F({ tumor: ESO, nome: "Docetaxel monoterapia", cenario: NE, intervalo: 21, ciclos: null,
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: DOCE_OBS })] });
F({ tumor: ESO, nome: "5-FU + Leucovorina (LV5FU2)", cenario: NE, intervalo: 14, ciclos: null,
  div: ["5-FU: planilha 8 h D1+D2; ficha 2.400 mg/m² em 46 h sem bolus (o de Gramont do SOnHe traz bolus 400, que NÃO entra)."],
  itens: [qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h" }), FU46(2400, "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400). O de Gramont do SOnHe traz bolus 400 mg/m², que NÃO entra (D-W9-50).")] });
F({ tumor: ESO, nome: "Irinotecano monoterapia", cenario: NE, intervalo: 21, ciclos: null, atropina: true,
  itens: [qt("Irinotecano", 350, "m2", D(1), { t: "90 min" })] });

// ===== ESTÔMAGO/JEG =====
const EST = "Estômago/JEG";
F(flot(EST, PAL, [["Estômago", "Esquema FLOT"]]));
F({ tumor: EST, nome: "FOLFOX", cenario: PAL, intervalo: 14, ciclos: null, sonhe: [["Estômago", "Esquema FOLFOX"]],
  div: ["5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus (o bolus 400 do SOnHe NÃO entra)."],
  itens: [qt("Oxaliplatina", 85, "m2", D(1), { t: "2 h" }), qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h", obs: "Correr em Y com a oxaliplatina." }),
    FU46(2400, "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400). O SOnHe traz também bolus 400 mg/m², que NÃO entra (D-W9-50).")] });
F({ tumor: EST, nome: "FOLFIRI", cenario: NE, intervalo: 14, ciclos: null, atropina: true,
  div: ["5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus."],
  itens: [qt("Irinotecano", 180, "m2", D(1), { t: "90 min" }), qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h" }),
    FU46(2400, "Planilha: 1.200 mg/m² D1+D2 em 8 h (total 2.400).")] });
F({ tumor: EST, nome: "XELOX (CAPOX)", cenario: ADJ, intervalo: 21, ciclos: 8, sonhe: [["Estômago", "Esquema CapOx"]],
  itens: [qt("Oxaliplatina", 130, "m2", D(1), { t: "2 h" }), qt("Capecitabina", 1000, "m2", R(1, 14), { route: "VO", obs: "Dose por administração, 12/12 h; nº de comprimidos pela SC." })] });
F({ tumor: EST, nome: "DCF modificado (institucional)", cenario: NE, intervalo: 14, ciclos: null, premedDias: D(1, 2), sonhe: [["Estômago", "Esquema mDCF"]],
  div: ["MANTIDA a planilha (revisão institucional do Dr. Silas, LEIA-ME): docetaxel 40 D1, 5-FU 600 mg/m² 6 h/dia D1-D2, cisplatina 40 D2.", "SOnHe mDCF: cisplatina D3, folinato 400, 5-FU 2.000 mg/m² em 48 h (bolus 400 NÃO entra). Divergência registrada e não aplicada: o Dr. Silas decide."],
  itens: [qt("Docetaxel", 40, "m2", D(1), { t: "60 min", obs: `${DOCE_OBS} SOnHe mDCF: docetaxel 40 D1 (igual).` }),
    qt("Fluoruracila (5-FU) infusão 6 h/dia", 600, "m2", D(1, 2), { t: "6 h", obs: "Planilha institucional (revisão Dr. Silas): infusão de 6 h por dia em D1 e D2. SOnHe mDCF: 5-FU 2.000 mg/m² em bomba de 48 h + bolus 400 (o bolus NÃO entra) e folinato 400 mg/m² [VERIFICAR]. Não é esquema de bomba de 46 h." }),
    CIS(40, D(2), { obs: "Planilha: D2; SOnHe mDCF: D3 [VERIFICAR]." })] });
F({ tumor: EST, nome: "Docetaxel monoterapia", cenario: PAL, intervalo: 21, ciclos: null, sonhe: [["Estômago", "Docetaxel monoterapia"]],
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: DOCE_OBS })] });
F({ tumor: EST, nome: "Irinotecano monoterapia", cenario: PAL, intervalo: 14, ciclos: null, atropina: true, sonhe: [["Estômago", "Irinotecano monoterapia"]],
  div: ["Irinotecano: planilha 350 mg/m² q21; SOnHe 180 mg/m² q14 (vale SOnHe: dose e intervalo)."],
  itens: [qt("Irinotecano", 180, "m2", D(1), { t: "90 min", obs: "Planilha: 350 mg/m² a cada 21 d; SOnHe: 180 mg/m² a cada 14 d (vale SOnHe, D-W9-50)." })] });

// ===== CABEÇA E PESCOÇO =====
const HN = "Cabeça e pescoço";
F({ tumor: HN, nome: "Cisplatina + RxT", cenario: RT, intervalo: 21, ciclos: 3, altoRisco: true, sonhe: [[HN, "CDDP q21d (+RT)"]],
  itens: [CIS(100, D(1), { obs: "Concomitante à RxT em D1, D22 e D43." })] });
F({ tumor: HN, nome: "Carboplatina + Paclitaxel", cenario: NE, intervalo: 21, ciclos: null, tinhaDifen: true,
  itens: [qt("Paclitaxel", 175, "m2", D(1), { t: "3 h" }), qt("Carboplatina", 5, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 5)." })] });
F({ tumor: HN, nome: "Carboplatina + Docetaxel", cenario: NE, intervalo: 21, ciclos: null, codigo: "P1456", fonteExtra: "ficha real P1456 (docs/referencias/modelos/05; mesma droga e dose também em pulmão)",
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", dil: "SF 0,9%", vol: 250, obs: DOCE_OBS }),
    qt("Carboplatina", 5, "auc", D(1), { t: "60 min", dil: "SG 5%", vol: 250, obs: "Calvert (AUC 5); diluente SG 5% como na ficha real P1456." })] });
F({ tumor: HN, nome: "Cisplatina + 5-Fluorouracil (PF)", cenario: NE, intervalo: 21, ciclos: null, altoRisco: true,
  itens: [CIS(100, D(1)), qt("Fluoruracila (5-FU) infusão contínua 24 h/dia", 1000, "m2", R(1, 4), { t: "24 h", obs: "Infusão contínua de 24 h por dia em D1-D4 (4.000 mg/m² em 96 h; o SOnHe usa 5-FU 4.000 mg/m² em 96 h nos esquemas com cisplatina). Sem bolus. Não é o esquema de 46 h." })] });
F({ tumor: HN, nome: "Docetaxel monoterapia", cenario: PAL, intervalo: 21, ciclos: null, sonhe: [[HN, "Docetaxel monoterapia"]],
  itens: [qt("Docetaxel", 75, "m2", D(1), { t: "60 min", obs: DOCE_OBS })] });
F({ tumor: HN, nome: "Metotrexato semanal", cenario: PAL, intervalo: 7, ciclos: null, sonhe: [[HN, "Metotrexato monoterapia"]],
  itens: [qt("Metotrexato", 40, "m2", D(1), { t: "10 min", obs: "SOnHe aceita faixa de 30 a 60 mg/m²; planilha 40 mg/m² dentro da faixa." })] });

// ===== FICHA INSTITUCIONAL REAL (fora da planilha) =====
F({ tumor: "Não informado (ficha institucional)", nome: "Cisplatina + Gemcitabina (D1 e D8)", cenario: NE, codigo: "P1477", intervalo: null, ciclos: null,
  premedDias: D(1, 8), dex: 20, ond: 16, obsOnd: "Ficha real P1477: ondansetrona 16 mg e dexametasona 20 mg.", altoRisco: true,
  fonteExtra: "ficha real P1477 (docs/referencias/modelos/05), sem equivalente na planilha; tumor e doses não informados na ficha",
  div: ["Fora da planilha: cisplatina em D1 e D8; doses ausentes na ficha real (Dose Prot 0): null (PENDENTE da base de cálculo)."],
  itens: [qt("Gemcitabina", null, "m2", D(1, 8), { t: "30 min", dil: "SF 0,9%", vol: 250, obs: "Ficha real P1477: dose fixa com Dose Prot 0; base mg/m² ausente [VERIFICAR]." }),
    CIS(null, D(1, 8), { dil: "SF 0,9%", vol: 500, obs: "Cisplatina D1 e D8 (D-W9-34d): hidratação Mg/K nos dois dias. Ficha real P1477: dose fixa com Dose Prot 0; base mg/m² ausente [VERIFICAR]." })] });

// ===== ESQUEMAS NOVOS (D-W9-61): fonte de dose/dias = SOnHe quando houver; dose sem fonte = null =====
const NI = "Não informado (ficha institucional)";
const MESNA3 = (dose, days, nota) => [
  qt("Mesna (0 h)", dose, "m2", days, { t: "15 min", obs: `Junto com a ifosfamida (0 h). ${nota}` }),
  it("Mesna (4 h)", "POS_QT", dose, "m2", "EV", days, { t: "15 min", obs: `4 h após o início da ifosfamida. ${nota}` }),
  it("Mesna (8 h)", "POS_QT", null, "m2", "EV", days, { t: "15 min", obs: "8 h após o início da ifosfamida: cobertura nos 3 tempos 0/4/8 h (AVALIACAO-CONSULTAS-E-CONSOLIDADO §3.3 item 6). O SOnHe só traz 0 e 4 h: dose do 8 h sem fonte = null [VERIFICAR]." }),
];
const NOTA_MESNA_SONHE = "SOnHe: mesna 600 mg/m² em 0 e 4 h após a ifosfamida; o terceiro horário (8 h) foi acrescentado pela regra de cobertura 0/4/8 h.";
F({ tumor: NI, nome: "GEMOX", cenario: PAL, intervalo: 21, ciclos: null, premedDias: D(1, 8), sonhe: [["Testículo", "GemOx"]],
  fonteExtra: "tumor da ficha não definido: o único GemOx do SOnHe está no capítulo de testículo; uso real citado em AVALIACAO-CONSULTAS-E-CONSOLIDADO §4 (oxaliplatina ~100, gemcitabina ~1000)",
  div: ["Oxaliplatina: SOnHe 130 mg/m² D1; uso real do consolidado ~100 mg/m² (vale SOnHe, D-W9-50; conferir [VERIFICAR]).", "Tumor/cenário/ciclos: o SOnHe traz GemOx só em testículo (paliativo, até progressão)."],
  itens: [qt("Gemcitabina", 1000, "m2", D(1, 8), { t: "30 min", obs: "SOnHe GemOx p. 227: 1.000 mg/m² em D1 e D8." }),
    qt("Oxaliplatina", 100, "m2", D(1), { t: "2 h", obs: "100 mg/m² decidido pelo Dr. Silas (D-W9-62); SOnHe GemOx p. 227 traz 130." })] });
F({ tumor: HN, nome: "Carboplatina + Paclitaxel semanal", cenario: NE, intervalo: 7, ciclos: null, sonhe: [["Colo de útero", "Carboplatina + Paclitaxel semanal (indução)"]],
  fonteExtra: "uso real em cabeça e pescoço em AVALIACAO-CONSULTAS-E-CONSOLIDADO §4 (paclitaxel 80 + carboplatina AUC 1,5 em um caso); AUC 2 decidida pelo Dr. Silas (D-W9-61); o SOnHe não traz carbotaxol semanal de cabeça e pescoço: paclitaxel 80 e AUC 2 tomados do esquema semanal do SOnHe de colo (p. 51) e de mama (p. 21)",
  div: ["Carboplatina: AUC 2 (Dr. Silas, D-W9-61); consolidado registra AUC 1,5 em um caso real e o SOnHe de mama aceita 1,5 a 2."],
  itens: [qt("Paclitaxel", 80, "m2", D(1), { t: "60 min", obs: "Semanal. Dose do esquema semanal do SOnHe (colo p. 51 / mama p. 21) e do uso real do consolidado." }),
    qt("Carboplatina", 2, "auc", D(1), { t: "60 min", obs: "Calvert (AUC 2) semanal, decidido pelo Dr. Silas (D-W9-61)." })] });
F({ tumor: "Colo do útero", nome: "Ifosfamida + Mesna", cenario: PAL, intervalo: 21, ciclos: null, premedDias: R(1, 5), sonhe: [["Colo de útero", "Ifosfamida monoterapia"]],
  div: ["Ifosfamida 1.200 mg/m² D1-D5 q21 (SOnHe p. 54); o '1.200 g/m²' do capítulo de endométrio é erro do manual e não entra (D-W9-50).", "Mesna: SOnHe 600 mg/m² em 0 e 4 h; 8 h sem dose de fonte (null). Uso real do consolidado (ifosfamida 1.800, mesna 2x900) não adotado."],
  itens: [qt("Ifosfamida", 1200, "m2", R(1, 5), { t: "60 min", obs: "SOnHe p. 54 (colo, paliativo, até progressão): 1.200 mg/m² D1 a D5 a cada 21 d. Tempo de infusão sem fonte no SOnHe [VERIFICAR]." }),
    ...MESNA3(600, R(1, 5), NOTA_MESNA_SONHE)] });
F({ tumor: NI, nome: "Ifosfamida + Gemcitabina", cenario: NE, intervalo: null, ciclos: null, premedDias: R(1, 5),
  fonteExtra: "esquema sem fonte de dose/dias no SOnHe (só ifosfamida e gemcitabina em monoterapia); uso real citado em AVALIACAO-CONSULTAS-E-CONSOLIDADO §4 sem doses auditadas",
  div: ["Doses e dias do esquema combinado sem fonte: null. Dias plausíveis (ifosfamida D1-D5, gemcitabina D1 e D8) a conferir."],
  itens: [qt("Ifosfamida", null, "m2", R(1, 5), { t: "60 min", obs: "Dose sem fonte para o esquema combinado: null (o SOnHe só traz a monoterapia 1.200 mg/m²) [VERIFICAR]; dias a conferir." }),
    qt("Gemcitabina", null, "m2", D(1, 8), { t: "30 min", obs: "Dose sem fonte para o esquema combinado: null [VERIFICAR]; dias a conferir." }),
    ...MESNA3(null, R(1, 5), "Dose do 0 h e 4 h sem fonte para o esquema combinado: null [VERIFICAR].")] });
F({ tumor: NI, nome: "Ifosfamida + Topotecana", cenario: NE, intervalo: null, ciclos: null, premedDias: R(1, 5),
  fonteExtra: "esquema sem fonte de dose/dias no SOnHe (só ifosfamida e topotecano em monoterapia: colo p. 54, 1,5 mg/m² D1-D5); o topotecano de 1.200 mg/m² do capítulo de endométrio é erro do manual e não entra (D-W9-50)",
  div: ["Doses e dias do esquema combinado sem fonte: null. Dias plausíveis (D1-D5) a conferir."],
  itens: [qt("Ifosfamida", null, "m2", R(1, 5), { t: "60 min", obs: "Dose sem fonte para o esquema combinado: null [VERIFICAR]; dias a conferir." }),
    qt("Topotecana", null, "m2", R(1, 5), { t: "30 min", obs: "Dose sem fonte para o esquema combinado: null (monoterapia SOnHe colo p. 54: 1,5 mg/m² D1-D5 q21, não transposta) [VERIFICAR]; dias a conferir." }),
    ...MESNA3(null, R(1, 5), "Dose do 0 h e 4 h sem fonte para o esquema combinado: null [VERIFICAR].")] });
F({ tumor: MAMA, nome: "AC-TH (fase AC)", cenario: NEO, intervalo: 21, ciclos: 4, altoRisco: true, sonhe: [[MAMA, "Esquema AC convencional"]],
  fonteExtra: "SBOC 2026 mama (docs/referencias/evidencias/SBOC-2026-MAMA-NEOADJUVANCIA-RESUMO.md): ACTH(P) como alternativa HER2+",
  itens: [qt("Doxorrubicina", 60, "m2", D(1), { t: "10 min", obs: "Seguido da fase TH (paclitaxel semanal + trastuzumabe) após 4 ciclos." }), qt("Ciclofosfamida", 600, "m2", D(1), { t: "30 min" })] });
F({ tumor: MAMA, nome: "AC-TH (fase TH — paclitaxel semanal + trastuzumabe)", cenario: NEO, intervalo: 21, ciclos: 4, premedDias: D(1, 8, 15), sonhe: [[MAMA, "Esquema TH"]],
  fonteExtra: "SBOC 2026 mama (docs/referencias/evidencias/SBOC-2026-MAMA-NEOADJUVANCIA-RESUMO.md): trastuzumabe ataque 8 mg/kg, depois 6 mg/kg",
  div: ["Ciclo de 21 d com paclitaxel semanal (D1, D8, D15 = 12 semanas) para casar com o trastuzumabe q21d do SOnHe; o SOnHe mantém o trastuzumabe até completar 1 ano (fora desta ficha)."],
  itens: [qt("Paclitaxel", 80, "m2", D(1, 8, 15), { t: "60 min", obs: "Semanal por 12 semanas (SOnHe TH p. 21)." }),
    qt("Trastuzumabe (ataque, somente ciclo 1)", 8, "mgkg", D(1), { obs: "Dose de ataque 8 mg/kg no C1 (SOnHe TH p. 21; SBOC 2026). Tempo de infusão sem fonte: null. Usar apenas no ciclo 1." }),
    qt("Trastuzumabe (manutenção)", 6, "mgkg", D(1), { obs: "6 mg/kg a cada 21 d, a partir do ciclo 2 (no C1 vale o ataque de 8 mg/kg); completar 1 ano de anti-HER2 (SOnHe TH p. 21; SBOC 2026). Tempo de infusão sem fonte: null." })] });
F({ tumor: CR, nome: "FOLFIRI + Bevacizumabe", cenario: PAL, intervalo: 14, ciclos: null, atropina: true, sonhe: [["Cólon", "Esquema FOLFIRI"], ["Cólon", "Bevacizumabe (isolado ou em combinação)"]],
  div: ["5-FU: ficha de 46 h sem bolus, total 2.400 mg/m² (D-W9-23a/50); o SOnHe do FOLFIRI traz bolus, que NÃO entra.", "Bevacizumabe 5 mg/kg q14d: SOnHe 'isolado ou em combinação' (p. 104); sem linha específica FOLFIRI + bevacizumabe."],
  itens: [qt("Bevacizumabe", 5, "mgkg", D(1), { obs: "5 mg/kg a cada 14 d (SOnHe p. 104, 'isolado ou em combinação'). Tempo de infusão sem fonte: null." }),
    qt("Irinotecano", 180, "m2", D(1), { t: "90 min" }), qt("Folinato de cálcio (leucovorina)", 400, "m2", D(1), { t: "2 h" }),
    FU46(2400, "Total 2.400 mg/m² em 46 h, sem bolus (D-W9-23a); mesmo 5-FU do FOLFIRI da ficha.")] });
F({ tumor: "Gliomas", nome: "Temozolomida monoterapia (ciclo 1)", cenario: ADJ, intervalo: 28, ciclos: 1, semPremed: true, sonhe: [["Gliomas", "Temozolamida monoterapia 200"]],
  div: ["D-W9-62: ciclo 1 com 150 mg/m²; a partir do ciclo 2, 200 mg/m² (ficha separada). Sem pré-medicação EV: antiemético oral a critério [VERIFICAR]."],
  itens: [qt("Temozolomida", 150, "m2", R(1, 5), { route: "VO", obs: "1x/dia, D1 a D5. Ciclo 1 = 150 mg/m² (D-W9-62); depois usar a ficha 'ciclos 2 em diante' (200 mg/m²)." })] });
F({ tumor: "Gliomas", nome: "Temozolomida monoterapia (ciclos 2 em diante)", cenario: ADJ, intervalo: 28, ciclos: 5, semPremed: true, sonhe: [["Gliomas", "Temozolamida monoterapia 200"]],
  div: ["SOnHe p. 369: 200 mg/m² VO D1-D5 q28 (6 ciclos adjuvante no total, contando o ciclo 1 de 150). Sem pré-medicação EV: antiemético oral a critério [VERIFICAR]."],
  itens: [qt("Temozolomida", 200, "m2", R(1, 5), { route: "VO", obs: "1x/dia, D1 a D5 a cada 28 d, a partir do ciclo 2 (D-W9-62)." })] });
F({ tumor: "Colo do útero", nome: "Cisplatina semanal + RxT", cenario: RT, intervalo: 7, ciclos: null, sonhe: [["Colo de útero", "CDDP semanal"]],
  div: ["Ciclos: SOnHe 6 a 8 semanas (null)."],
  itens: [CIS(40, D(1), { obs: "Semanal, 6 a 8 semanas, concomitante à RxT (SOnHe colo p. 51)." })] });

// ---------- saída ----------
rmSync(SAIDA, { recursive: true, force: true });
const ids = new Set();
const resumo = [];
for (const s of FICHAS) {
  const { t, tumorSlug, arquivo, div } = montar(s);
  if (ids.has(t.templateId)) throw new Error(`id duplicado: ${t.templateId}`);
  ids.add(t.templateId);
  mkdirSync(join(SAIDA, tumorSlug), { recursive: true });
  writeFileSync(join(SAIDA, tumorSlug, arquivo), JSON.stringify(t, null, 2) + "\n", "utf8");
  const nulos = t.itens.filter((i) => i.standardDose === null).map((i) => i.drug);
  resumo.push({ tumor: t.tumor, nome: t.nome, cenario: t.cenario, codigo: t.codigoInstitucional, div, nulos, ciclosNull: t.ciclos === null, dir: tumorSlug });
}
if (process.env.RESUMO_OUT) writeFileSync(process.env.RESUMO_OUT, JSON.stringify(resumo, null, 1), "utf8");
console.log(`${FICHAS.length} fichas gravadas em corpus/fichas`);
