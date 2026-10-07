// W10-INT-PRESC-03..05 · RT-08a–e e RT-11b. Fixtures SINTÉTICAS.
import { describe, expect, it } from "vitest";
import {
  FichaErro, calcularDosePorBase, carregarFicha, criarBiblioteca, ehDoseDeEstudo, fichaUsavel, idadeDoDado,
  recusarDoseEstudo, registrarBiblioteca, validarAntiemese, validarInfusao,
} from "../../src/rules/prescricao/index.js";
import { instanciarProtocolo } from "../../src/rules/prescricao/instanciarProtocolo.js";
import { item, template } from "./_fixtures.js";

const base = template([item({ drug: "gemcitabina", standardDose: 1000, doseBasis: "MG_M2", unit: "mg/m²" })]);
const ficha = (o: Record<string, unknown>) => ({ ...base, ...o });
const bib = criarBiblioteca([
  ficha({ templateId: "GC-bexiga@1", nome: "GC", tumor: "bexiga", cenario: "metastático", versao: "1" }),
  ficha({ templateId: "GC-vias@1", nome: "GC", tumor: "vias biliares", cenario: "metastático", versao: "1" }),
  ficha({ templateId: "GC-vias@2", nome: "GC", tumor: "vias biliares", cenario: "metastático", versao: "2", status: "RASCUNHO" }),
]);

describe("RT-08a/b · biblioteca de fichas", () => {
  it("homônimas carregam separadas por identidade completa (acento/caixa irrelevantes)", () => {
    expect(bib.carregar("gc", "Vias Biliares", "metastatico", "1").templateId).toBe("GC-vias@1");
    expect(bib.carregar("GC", "bexiga", "metastatico", "1").templateId).toBe("GC-bexiga@1");
  });
  it("versão inexistente ⇒ FICHA_VERSAO_INEXISTENTE listando as existentes; identidade desconhecida idem", async () => {
    await expect(carregarFicha("GC", "bexiga", "metastatico", "9.9", bib)).rejects.toThrow(/FICHA_VERSAO_INEXISTENTE.*versões existentes: 1/u);
    await expect(carregarFicha("XX", "bexiga", "metastatico", "1", bib)).rejects.toBeInstanceOf(FichaErro);
  });
  it("RASCUNHO/INATIVA nunca carregam", () => {
    expect(() => bib.carregar("GC", "vias biliares", "metastatico", "2")).toThrow(/FICHA_NAO_CONFERIDA/u);
    expect(fichaUsavel({ templateId: "x", status: "INATIVA" }).usavel).toBe(false);
    expect(fichaUsavel({ templateId: "x", status: "CONFERIDA_MEDICO" })).toEqual({ usavel: true, motivo: null });
  });
  it("templateId duplicado ou ficha fora do schema recusa a biblioteca inteira", () => {
    const a = ficha({ templateId: "A@1" });
    expect(() => criarBiblioteca([a, a])).toThrow(/FICHA_AMBIGUA/u);
    expect(() => criarBiblioteca([{ templateId: "x" }])).toThrow(/FICHA_INVALIDA/u);
  });
  it("identidade duplicada com templateIds distintos ⇒ FICHA_AMBIGUA ao carregar", () => {
    const dup = criarBiblioteca([ficha({ templateId: "A@1" }), ficha({ templateId: "B@1" })]);
    expect(() => dup.carregar(base.nome, base.tumor, base.cenario, base.versao)).toThrow(/FICHA_AMBIGUA/u);
  });
  it("biblioteca padrão vazia ⇒ erro tipado; registrar habilita", async () => {
    await expect(carregarFicha("GC", "bexiga", "metastatico", "1")).rejects.toThrow(/FICHA_VERSAO_INEXISTENTE/u);
    registrarBiblioteca([ficha({ templateId: "GC-bexiga@1", nome: "GC", tumor: "bexiga", cenario: "metastatico", versao: "1" })]);
    expect((await carregarFicha("GC", "bexiga", "metastatico", "1")).templateId).toBe("GC-bexiga@1");
    registrarBiblioteca([]);
  });
});

describe("RT-08c · calcularDosePorBase", () => {
  it("AUC sem clearance e mg/m² sem peso/altura ⇒ PENDENTE nomeando o campo", () => {
    expect(calcularDosePorBase({ basis: "AUC", auc: 5, clearance: null })).toMatchObject({ estado: "PENDENTE", pendente: "clearance", doseMg: null });
    expect(calcularDosePorBase({ basis: "MG_M2", mgM2: 75, pesoKg: null, alturaCm: null })).toMatchObject({ estado: "PENDENTE", pendente: "pesoKg, alturaCm" });
    expect(calcularDosePorBase({ basis: "MG_KG", mgKg: 5, pesoKg: null }).pendente).toBe("pesoKg");
    expect(calcularDosePorBase({ basis: "OTHER" }).estado).toBe("PENDENTE");
  });
  it("equivale a instanciarProtocolo (Calvert, BSA e limites)", () => {
    const sem = { pesoKg: null, alturaCm: null, bsaM2: null, clcr: null, medidoEm: null };
    const casos: Array<[Parameters<typeof calcularDosePorBase>[0], ReturnType<typeof item>, Parameters<typeof instanciarProtocolo>[1]]> = [
      [{ basis: "AUC", auc: 5, clearance: 140 }, item({ drug: "carboplatina", standardDose: 5, doseBasis: "AUC" }), { ...sem, clcr: 140 }],
      [{ basis: "AUC", auc: 5, clearance: 80 }, item({ drug: "carboplatina", standardDose: 5, doseBasis: "AUC" }), { ...sem, clcr: 80 }],
      [{ basis: "MG_M2", mgM2: 75, pesoKg: 70, alturaCm: 170 }, item({ drug: "x", standardDose: 75, doseBasis: "MG_M2" }), { ...sem, pesoKg: 70, alturaCm: 170 }],
      [{ basis: "MG_M2", mgM2: 75, pesoKg: 130, alturaCm: 190 }, item({ drug: "x", standardDose: 75, doseBasis: "MG_M2" }), { ...sem, pesoKg: 130, alturaCm: 190 }],
      [{ basis: "MG_KG", mgKg: 6.5, pesoKg: 61.3 }, item({ drug: "x", standardDose: 6.5, doseBasis: "MG_KG" }), { ...sem, pesoKg: 61.3 }],
    ];
    for (const [entrada, it, dados] of casos) {
      const r = instanciarProtocolo(template([it]), dados);
      if (!r.ok) throw new Error("template deveria instanciar");
      const novo = calcularDosePorBase(entrada);
      expect(novo.doseMg).toBe(r.itens[0]!.item.calculatedDose);
      expect(novo.aviso).toBe(r.itens[0]!.aviso);
    }
  });
});

describe("RT-08e · idade do dado", () => {
  it("peso de 60 dias mostra fonte e idade; limite marca desatualizado; sem data nunca presume fresco", () => {
    const d = { valor: 62, unidade: "kg", fonte: "triagem", medidoEm: "2026-08-08T10:00:00Z" };
    const r = idadeDoDado(d, "2026-10-07T10:00:00Z", 30);
    expect(r).toMatchObject({ idadeDias: 60, desatualizado: true });
    expect(r.texto).toBe("62 kg · fonte triagem · há 60 dia(s)");
    expect(idadeDoDado(d, "2026-10-07T10:00:00Z").desatualizado).toBeNull();
    expect(idadeDoDado({ ...d, medidoEm: null }, "2026-10-07T10:00:00Z", 30)).toMatchObject({ idadeDias: null, desatualizado: null });
  });
});

describe("RT-08d · infusão e antiemese", () => {
  it("5-FU 8 h sem bomba e bolus ⇒ BLOCK_ARTEFATO citando 46 h", () => {
    expect(validarInfusao({ drug: "5-fluorouracil", infusionTime: "8 h", bomba: false })).toMatchObject({ veredito: "BLOCK_ARTEFATO" });
    expect(validarInfusao({ drug: "5-FU", infusionTime: "8 h", bomba: false }).motivo).toMatch(/46/u);
    expect(validarInfusao({ drug: "Fluorouracila", infusionTime: "15 min", bolus: true }).veredito).toBe("BLOCK_ARTEFATO");
  });
  it("46 h com bomba passa; 46 h sem informar bomba avisa; ausente = NOT_EVALUABLE; outra droga não se aplica", () => {
    expect(validarInfusao({ drug: "5-FU", infusionTime: "46 h", bomba: true }).veredito).toBe("PASS");
    expect(validarInfusao({ drug: "5-FU", infusionTime: "46 h" }).veredito).toBe("WARNING");
    expect(validarInfusao({ drug: "5-FU", infusionTime: null, bomba: true }).veredito).toBe("NOT_EVALUABLE");
    expect(validarInfusao({ drug: "5-FU", infusionTime: "24 h", bomba: true }).veredito).toBe("WARNING");
    expect(validarInfusao({ drug: "oxaliplatina", infusionTime: "2 h" }).veredito).toBe("PASS");
  });
  it("NK1 gera alerta; padrão local completo não; cimetidina exigida com taxano", () => {
    expect(validarAntiemese({ itens: ["aprepitanto", "ondansetrona", "dexametasona"] })).toMatchObject({ alerta: true, nk1: ["aprepitanto"] });
    const ok = validarAntiemese({ itens: ["Ondansetrona", "Dexametasona", "Prometazina VO"] });
    expect(ok).toMatchObject({ alerta: false, ausentesPadrao: [] });
    expect(validarAntiemese({ itens: ["ondansetrona", "dexametasona", "prometazina", "paclitaxel"] }).ausentesPadrao).toEqual(["cimetidina"]);
  });
});

describe("RT-11b · dose de estudo nunca vira ficha", () => {
  it("braço de estudo, aula, trial/regime do grafo, TPF/ddMVAC e dose literal sem origem conferida ⇒ recusado", () => {
    for (const c of [
      { origem: "BRACO_ESTUDO" as const }, { origem: "AULA_NAO_VERIFICADA" as const }, { noTipo: "trial" },
      { noTipo: "regime", doseLiteral: "Carboplatina AUC 2 + paclitaxel 50 mg/m²" }, { esquema: "TPF" }, { esquema: "ddMVAC" },
      { doseLiteral: "75 mg/m²" },
    ]) {
      expect(ehDoseDeEstudo(c), JSON.stringify(c)).toBe(true);
      expect(recusarDoseEstudo(c)).toMatchObject({ recusado: true, codigo: "DOSE_ESTUDO_SEM_REVISAO" });
    }
  });
  it("ficha conferida e manual passam; revisão explícita libera; revisão vazia não", () => {
    expect(recusarDoseEstudo({ origem: "FICHA_CONFERIDA", doseLiteral: "1000 mg/m²" })).toEqual({ recusado: false });
    expect(recusarDoseEstudo({ origem: "MANUAL" })).toEqual({ recusado: false });
    expect(recusarDoseEstudo({ esquema: "TPF", revisao: { revisadoPor: "Dr. Silas", em: "2026-10-07" } })).toEqual({ recusado: false });
    expect(recusarDoseEstudo({ esquema: "TPF", revisao: { revisadoPor: " ", em: "2026-10-07" } }).recusado).toBe(true);
    expect(recusarDoseEstudo({ esquema: "FOLFOX" })).toEqual({ recusado: false });
  });
});
