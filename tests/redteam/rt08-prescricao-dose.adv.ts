// RT-08 · Prescrição e dose (S0) — LACUNAS: não existe engine de dose por DoseBasis
// (AUC/mg/m²/mg/kg), biblioteca de fichas versionadas, regras de infusão (5-FU 46 h × 8 h,
// bolus proibido) nem antiemese padrão local (sem NK1). Contratos existem sem consumidor.
// Dono provável: src/rules/prescricao/** (equipe interna) + biblioteca (curadoria Dr. Silas).
import { describe, expect, it } from "vitest";
import { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";

async function probe(mods: readonly string[], nomes: readonly string[]): Promise<unknown> {
  for (const caminho of mods) {
    try {
      const mod = (await import(caminho)) as Record<string, unknown>;
      for (const nome of nomes) if (typeof mod[nome] === "function") return mod[nome];
    } catch {
      // módulo inexistente: continua a sonda
    }
  }
  return null;
}

const MODULOS_PRESCRICAO = [
  "../../src/rules/prescricao/index.js",
  "../../src/rules/prescricao.js",
  "../../src/kernel/prescricao.js",
] as const;

const itemMinimo = {
  drug: "gemcitabina", classe: "QT" as const, sequence: 1, standardDose: 1000, doseBasis: "MG_M2" as const,
  calculatedDose: 1750, prescribedDose: 1750, unit: "mg", adjustmentPercent: null, adjustmentReason: null,
  route: "EV", diluent: "SF 0,9%", finalVolumeMl: 250, infusionTime: "30 min", days: ["d1", "d8"],
  observacao: null, source: "PROTOCOL" as const, overrideMotivo: null,
};

const ficha = (extra: Partial<Record<string, unknown>> = {}) => ({
  templateId: "GC-bexiga", tumor: "bexiga", nome: "GC", cenario: "metastatico",
  versao: "1", hash: "hash-sintetico", codigoInstitucional: "P1456", intervaloDias: 28,
  ciclos: 6, itens: [itemMinimo], limiaresBula: null, fonte: "planilha revisada D-W9-23",
  status: "CONFERIDA_MEDICO", ...extra,
});

describe("RT-08 · biblioteca de fichas versionadas (D-W9-22b / K-26)", () => {
  it("SEM_IMPLEMENTACAO: carregador de ficha inteira por templateId+tumor+cenário+versão existe", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["carregarFicha", "carregarProtocolTemplate", "fichaUsavel"]);
    expect(fn,
      "ProtocolTemplate é só schema: nada carrega UMA ficha inteira identificada por " +
      "templateId+tumor+cenário+versão, nada recusa versão inexistente com erro tipado e nada " +
      "impede misturar itens de duas versões. D-W9-22b: GC bexiga ≠ GC vias biliares. " +
      "Dono provável: src/rules/prescricao/** (equipe interna) + curadoria (~50 fichas).")
      .toBeTypeOf("function");
  });

  it("duas fichas homônimas (GC bexiga × GC vias biliares) carregam SEPARADAS por identidade completa", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["carregarFicha", "carregarProtocolTemplate"]);
    if (typeof fn !== "function") return;
    const bexiga = ProtocolTemplate.parse(ficha());
    const vias = ProtocolTemplate.parse(ficha({ templateId: "GC-vias-biliares", tumor: "vias biliares" }));
    const carregada = await fn("GC", "vias biliares", "metastatico", "1") as { templateId?: string };
    expect(carregada.templateId).toBe(vias.templateId);
    expect(carregada.templateId).not.toBe(bexiga.templateId);
  });

  it("versão inexistente ⇒ erro TIPADO (nunca ficha vazia, nunca mistura versões)", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["carregarFicha", "carregarProtocolTemplate"]);
    if (typeof fn !== "function") return;
    await expect(async () => fn("GC", "bexiga", "metastatico", "9.9")).rejects.toThrow(/FICHA_VERSAO/);
  });
});

describe("RT-08 · engine de dose por base (DoseBasis)", () => {
  it("SEM_IMPLEMENTACAO: cálculo AUC (Calvert) / mg/m² / mg/kg existe como código (G-10: nunca LLM)", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["calcularDosePorBase", "calcularDoseBasis"]);
    expect(fn,
      "DoseBasis enumera AUC/MG_M2/MG_KG mas nenhum código calcula: AUC sem clearance e mg/m² sem " +
      "peso/altura não viram PENDENTE — simplesmente não há engine. CANONICA §6: Calvert é código, " +
      "nunca LLM. Dono provável: src/rules/prescricao/** (equipe interna).")
      .toBeTypeOf("function");
  });

  it("AUC sem clearance e mg/m² sem peso/altura ⇒ PENDENTE com campo faltante nomeado", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["calcularDosePorBase", "calcularDoseBasis"]);
    if (typeof fn !== "function") return;
    const auc = await fn({ basis: "AUC", auc: 5, clearance: null }) as { estado?: string; pendente?: string };
    expect(auc.estado).toBe("PENDENTE");
    expect(auc.pendente).toMatch(/clearance/iu);
    const m2 = await fn({ basis: "MG_M2", mgM2: 75, pesoKg: null, alturaCm: null }) as { estado?: string };
    expect(m2.estado).toBe("PENDENTE");
  });

  it("SEM_IMPLEMENTACAO: dado reutilizado mostra fonte e idade do peso (peso de 60 dias atrás)", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["idadeDoDado", "idadePeso"]);
    expect(fn,
      "Patch D-W9-24: dado reutilizado mostra fonte e idade. Peso de 60 dias entra na dose sem " +
      "nenhum sinal de idade/fonte. Dono provável: src/rules/prescricao/** + UI (Cursor).")
      .toBeTypeOf("function");
  });
});

describe("RT-08 · regras de infusão e antiemese do serviço (D-W9-23/34c)", () => {
  it("SEM_IMPLEMENTACAO: validador de infusão (5-FU 46 h; '8 h sem bomba' proibido; bolus não entra)", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["validarInfusao", "validarTempoInfusao"]);
    expect(fn,
      "D-W9-23a/D-W9-50: FOLFOX/FOLFIRI = 5-FU em infusão contínua de 46 h; 'D1 e D2 8 h sem bomba' " +
      "NÃO vira ficha; bolus 5-FU 400 mg/m² não entra. Nenhum validador existe: PrescriptionItem " +
      "aceita infusionTime '8 h' para 5-FU sem alerta. Dono: src/rules/prescricao/** + curadoria.")
      .toBeTypeOf("function");
  });

  it("5-FU com infusionTime '8 h' sem bomba é recusado/bloqueia artefato com motivo", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["validarInfusao", "validarTempoInfusao"]);
    if (typeof fn !== "function") return;
    const saida = await fn({ drug: "5-fluorouracil", infusionTime: "8 h", bomba: false }) as {
      veredito?: string; motivo?: string;
    };
    expect(saida.veredito).toMatch(/BLOCK_ARTEFATO|PROIBIDO/);
    expect(saida.motivo).toMatch(/46/iu);
  });

  it("antiemese com NK1 (aprepitanto) gera alerta — padrão local é sem NK1 (D-W9-23c/34c)", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["validarAntiemese"]);
    if (typeof fn !== "function") return;
    const saida = await fn({ itens: ["aprepitanto", "ondansetrona", "dexametasona"] }) as { alerta?: boolean };
    expect(saida.alerta).toBe(true);
  });

  it("SEM_IMPLEMENTACAO: validador de antiemese existe", async () => {
    const fn = await probe(MODULOS_PRESCRICAO, ["validarAntiemese"]);
    expect(fn,
      "Antiemese padrão: ondansetrona + dexametasona + prometazina VO, cimetidina em taxano, " +
      "olanzapina opcional — nada disso é checado em código. Dono: src/rules/prescricao/**.")
      .toBeTypeOf("function");
  });
});

describe("RT-08 · ficha = identidade + hash (schema)", () => {
  it("schema aceita RASCUNHO/INATIVA — a restrição de uso ('só CONFERIDA_MEDICO') não tem enforcement", async () => {
    const rascunho = ProtocolTemplate.safeParse(ficha({ status: "RASCUNHO" }));
    expect(rascunho.success).toBe(true); // schema deixa passar; o USO é que teria que recusar
    const inativa = ProtocolTemplate.safeParse(ficha({ status: "INATIVA" }));
    expect(inativa.success).toBe(true);
    const fn = await probe(MODULOS_PRESCRICAO, ["carregarFicha", "fichaUsavel", "prescreverDeFicha"]);
    expect(fn,
      "Nada no código impede prescrever de ficha RASCUNHO/INATIVA (o comentário do schema diz " +
      "'só CONFERIDA_MEDICO é usável', mas não há função que imponha). Falha S0 potencial: " +
      "dose de ficha não conferida vira ordem. Dono: src/rules/prescricao/**.")
      .toBeTypeOf("function");
  });
});
