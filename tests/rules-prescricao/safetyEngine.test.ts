import { describe, expect, it } from "vitest";
import { safetyEngine, type LabsEntrada, type ValidationRequirement } from "../../src/rules/prescricao/safetyEngine.js";
import { LimiaresBula, SafetyVerdict } from "../../src/contracts/w10/prescricao.js";
import { item } from "./_fixtures.js";

const hoje = "2026-10-07";
const m = (valor: number | null, medidoEm: string | null = "2026-10-06") => ({ valor, medidoEm });
const labsOk = (o: Partial<LabsEntrada> = {}): LabsEntrada => ({
  hoje, peso: m(70), altura: m(170), bsa: m(1.8), clcr: m(80), neutrofilos: m(2000), plaquetas: m(150000), feve: m(60), hepatico: m(0.8), ...o,
});
const lim = (o: Partial<LimiaresBula> = {}): LimiaresBula => LimiaresBula.parse({
  neutrofilosMin: 1500, plaquetasMin: 100000, clcrMinMlMin: 60, fevePctMin: 50, fonte: "bula sintética", ...o,
});
const docetaxel = () => item({ drug: "Docetaxel", doseBasis: "MG_M2", standardDose: 75, calculatedDose: 135, prescribedDose: 135, unit: "mg" });
const reqDoce: ValidationRequirement[] = [{ drug: "docetaxel", requiresWeight: true, requiresHeight: true, requiresBSA: true, hematologicRequirement: true, maximumDataAgeDays: 7 }];
const run = (...a: Parameters<typeof safetyEngine>) => { const v = safetyEngine(...a); expect(SafetyVerdict.safeParse(v).success).toBe(true); return v; };

describe("W10-INT-PRESC-06 · safetyEngine", () => {
  it("tudo declarado e presente ⇒ PASS", () => {
    expect(run([docetaxel()], reqDoce, labsOk(), lim())).toEqual({ resultado: "PASS", motivos: [] });
  });
  it("sem requisito declarado não exige nada (sem bloqueio universal)", () => {
    const v = run([item({ drug: "SF 0,9%", classe: "POS_QT", prescribedDose: 100, unit: "mL" })], [], { hoje }, null);
    expect(v.resultado).toBe("PASS");
  });
  it("dado faltante exigido ⇒ NOT_EVALUABLE (= PENDENTE), nunca PASS", () => {
    for (const [campo, cod] of [["peso", "PESO_AUSENTE"], ["altura", "ALTURA_AUSENTE"], ["bsa", "BSA_AUSENTE"]] as const) {
      const v = run([docetaxel()], reqDoce, labsOk({ [campo]: m(null) }), null);
      expect(v.resultado).toBe("NOT_EVALUABLE");
      expect(v.motivos.map((x) => x.codigo)).toContain(cod);
    }
    expect(run([docetaxel()], reqDoce, { hoje }, null).resultado).toBe("NOT_EVALUABLE");
  });
  it("dado antigo, sem data ou futuro ⇒ NOT_EVALUABLE só quando a idade máxima foi declarada", () => {
    expect(run([docetaxel()], reqDoce, labsOk({ peso: m(70, "2026-09-20") }), null).motivos.map((x) => x.codigo)).toContain("PESO_ANTIGO");
    expect(run([docetaxel()], reqDoce, labsOk({ peso: m(70, null) }), null).motivos.map((x) => x.codigo)).toContain("PESO_SEM_DATA");
    expect(run([docetaxel()], reqDoce, labsOk({ peso: m(70, "2026-10-09") }), null).motivos.map((x) => x.codigo)).toContain("PESO_DATA_FUTURA");
    const semIdade: ValidationRequirement[] = [{ drug: "Docetaxel", requiresWeight: true }];
    expect(run([docetaxel()], semIdade, labsOk({ peso: m(70, "2020-01-01") }), null).resultado).toBe("PASS");
    expect(run([docetaxel()], reqDoce, labsOk({ peso: m(70, "2026-09-30T10:00:00-03:00") }), null).resultado).toBe("PASS"); // 7 dias = limite
  });
  it("requisito de outro fármaco não se aplica; '*' aplica a todos", () => {
    const so: ValidationRequirement[] = [{ drug: "Carboplatina", renalRequirement: true }];
    expect(run([docetaxel()], so, { hoje }, null).resultado).toBe("PASS");
    expect(run([docetaxel()], [{ drug: "*", renalRequirement: true }], { hoje }, null).resultado).toBe("NOT_EVALUABLE");
  });
  it("exigências renal, hepática e cardíaca", () => {
    const rq: ValidationRequirement[] = [{ drug: "*", renalRequirement: true, hepaticRequirement: true, cardiacRequirement: true }];
    const v = run([docetaxel()], rq, { hoje }, null);
    expect(v.motivos.map((x) => x.codigo).sort()).toEqual(["CARDIACO_AUSENTE", "HEPATICO_AUSENTE", "RENAL_AUSENTE"]);
  });
  it("BLOCK_ARTEFATO só por limiar de bula da ficha; igual ao limiar passa", () => {
    const v = run([docetaxel()], [], labsOk({ neutrofilos: m(1499) }), lim());
    expect(v.resultado).toBe("BLOCK_ARTEFATO");
    expect(v.motivos[0]).toMatchObject({ codigo: "NEUTROFILOS_ABAIXO_BULA", fonte: "bula sintética" });
    expect(run([docetaxel()], [], labsOk({ neutrofilos: m(1500) }), lim()).resultado).toBe("PASS");
    expect(run([docetaxel()], [], labsOk({ plaquetas: m(99999) }), lim()).resultado).toBe("BLOCK_ARTEFATO");
    expect(run([docetaxel()], [], labsOk({ clcr: m(59) }), lim()).resultado).toBe("BLOCK_ARTEFATO");
    expect(run([docetaxel()], [], labsOk({ feve: m(49) }), lim()).resultado).toBe("BLOCK_ARTEFATO");
  });
  it("sem ficha de limiares nunca há BLOCK, mesmo com valores baixíssimos", () => {
    expect(run([docetaxel()], [], labsOk({ neutrofilos: m(10), plaquetas: m(1000), clcr: m(5), feve: m(10) }), null).resultado).toBe("PASS");
    expect(run([docetaxel()], [], labsOk({ neutrofilos: m(10) }), undefined).resultado).toBe("PASS");
  });
  it("limiar nulo é ignorado; dado ausente para limiar ⇒ NOT_EVALUABLE, não BLOCK", () => {
    expect(run([docetaxel()], [], labsOk({ neutrofilos: m(10) }), lim({ neutrofilosMin: null })).resultado).toBe("PASS");
    const v = run([docetaxel()], [], labsOk({ neutrofilos: null }), lim());
    expect(v.resultado).toBe("NOT_EVALUABLE");
  });
  it("limiar só vale para itens QT", () => {
    const pre = item({ drug: "Ondansetrona", classe: "PRE_QT", prescribedDose: 16 });
    expect(run([pre], [], labsOk({ neutrofilos: m(10) }), lim()).resultado).toBe("PASS");
  });
  it("BLOCK prevalece sobre NOT_EVALUABLE; NOT_EVALUABLE sobre WARNING", () => {
    const v = run([docetaxel()], [], labsOk({ neutrofilos: m(100), plaquetas: m(null) }), lim());
    expect(v.resultado).toBe("BLOCK_ARTEFATO");
    expect(v.motivos.map((x) => x.codigo)).toEqual(expect.arrayContaining(["NEUTROFILOS_ABAIXO_BULA", "PLAQUETAS_AUSENTE"]));
    const manual = item({ drug: "Droga X", source: "MANUAL", overrideMotivo: "decisão", prescribedDose: 10 });
    expect(run([manual], [{ drug: "*", requiresWeight: true }], { hoje }, null).resultado).toBe("NOT_EVALUABLE");
  });
  it("QT manual e dose divergente da calculada ⇒ WARNING (alerta, nunca bloqueio)", () => {
    const manual = item({ drug: "Droga X", source: "MANUAL", overrideMotivo: "decisão", prescribedDose: 10 });
    expect(run([manual], [], { hoje }, null).resultado).toBe("WARNING");
    const div = item({ drug: "Docetaxel", calculatedDose: 135, prescribedDose: 120 });
    const v = run([div], [], { hoje }, null);
    expect(v.resultado).toBe("WARNING");
    expect(v.motivos[0]?.codigo).toBe("DOSE_DIVERGE_CALCULADA");
    const ajustado = item({ drug: "Docetaxel", calculatedDose: 135, prescribedDose: 108, adjustmentPercent: -20, adjustmentReason: "m" });
    expect(run([ajustado], [], { hoje }, null).resultado).toBe("PASS");
  });
  it("dose prescrita ausente ⇒ NOT_EVALUABLE; ordem vazia ⇒ NOT_EVALUABLE", () => {
    expect(run([item({ drug: "X", prescribedDose: null })], [], { hoje }, null).resultado).toBe("NOT_EVALUABLE");
    expect(run([], [], { hoje }, null).resultado).toBe("NOT_EVALUABLE");
  });
  it("não muta as entradas e é determinístico", () => {
    const itens = [docetaxel()];
    const l = labsOk({ neutrofilos: m(100) });
    const a = JSON.stringify([itens, l]);
    const v1 = safetyEngine(itens, reqDoce, l, lim());
    const v2 = safetyEngine(itens, reqDoce, l, lim());
    expect(v1).toEqual(v2);
    expect(JSON.stringify([itens, l])).toBe(a);
  });
});
