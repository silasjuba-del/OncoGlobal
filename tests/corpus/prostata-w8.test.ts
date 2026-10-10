// W8/GLM-18 · pack próstata: estrutura de estadiamento/marcadores; kit baseline D-W9-67; nenhum TNM automático.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";
import { completudeKitTumorLot } from "../../src/rules/kitTumorLot.js";

interface Elemento { id: string; rotulo: string; comoExibir: string; criterioClinico: string; ativo: boolean; fonte: unknown }
interface Marcador { id: string; rotulo: string; origem?: { opcoes: string[]; regra: string }; regra?: string; ativo: boolean; fonte: unknown }
const pack = JSON.parse(readFileSync(fileURLToPath(new URL("../../corpus/packs/prostata.v1.json", import.meta.url)), "utf8")) as {
  header: { id: string; versao: string };
  elementosEstadiamento: Elemento[];
  marcadores: Marcador[];
  proibicoes: string[];
  labsBaseline: { id: string }[];
  imagem: { baseline: { id: string }[] };
  completudeKit: { limiarIncompleto: number; bloqueiaApacSeIncompleto: boolean };
};

/** Varredura recursiva: pares [chave, valor] de todo objeto aninhado. */
function* entradas(valor: unknown): Generator<[string, unknown]> {
  if (Array.isArray(valor)) { for (const v of valor) yield* entradas(v); return; }
  if (typeof valor === "object" && valor !== null) {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      yield [k, v];
      yield* entradas(v);
    }
  }
}

describe("prostata.v1.json · estrutura W8 + kit D-W9-67", () => {
  it("header válido (G-17), versão 1.2.0 do kit baseline", () => {
    const r = validarRuleset(pack);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.header.id).toBe("prostata");
    expect(pack.header.versao).toBe("1.2.0");
  });

  it("cinco elementos de estadiamento mostrados com fonte; critério clínico [VERIFICAR]; nada ativo", () => {
    const ids = pack.elementosEstadiamento.map((e) => e.id);
    expect(ids).toEqual(["extensao-extracapsular", "vesiculas-seminais", "feixes-neurovasculares", "linfonodos", "osso"]);
    for (const e of pack.elementosEstadiamento) {
      expect(e.comoExibir, e.id).toContain("com fonte");
      expect(e.comoExibir, e.id).toContain("não fecha estádio");
      expect(e.criterioClinico, e.id).toBe("[VERIFICAR]");
      expect(e.ativo, e.id).toBe(false);
    }
  });

  it("PSA com origem laudo primário × mencionado em fonte secundária (E2); ativo no kit", () => {
    const psa = pack.marcadores.find((m) => m.id === "psa");
    expect(psa).toBeDefined();
    expect(psa!.ativo).toBe(true);
    expect(psa!.origem!.opcoes).toEqual(["LAUDO_PRIMARIO", "MENCIONADO_EM_FONTE_SECUNDARIA"]);
    expect(psa!.origem!.regra).toContain("mencionado sem laudo primário");
    expect(psa!.origem!.regra).toContain("nunca como resultado confirmado");
  });

  it("PIRADS null quando não numerado, nunca inferido do texto (E3); Gleason/ISUP por sítio (P1/P2)", () => {
    const pirads = pack.marcadores.find((m) => m.id === "pirads");
    expect(pirads!.regra).toContain("null quando não numerado");
    expect(pirads!.regra).toContain("nunca inferir");
    const gleason = pack.marcadores.find((m) => m.id === "gleason-isup-por-sitio");
    expect(gleason!.regra).toContain("PATH@1.1.0");
    expect(gleason!.regra).toContain("patologia-agregacao.v1.json");
    expect(gleason!.regra).toContain("nunca pelo LLM");
  });

  it("kit baseline: 4 labs + 2 imagens; completude < 0,6 bloqueia APAC", () => {
    expect(pack.labsBaseline.map((l) => l.id)).toEqual(["psat", "fosfatase-alcalina", "calcio", "testosterona"]);
    expect(pack.imagem.baseline.map((i) => i.id)).toEqual(["cintilografia-ossea", "rmn-pelve"]);
    const incompleto = completudeKitTumorLot(pack, ["psat", "calcio"]);
    expect(incompleto.kitIncompleto).toBe(true);
    expect(incompleto.bloqueiaApac).toBe(true);
    expect(incompleto.ausentes).toEqual(["fosfatase-alcalina", "testosterona", "cintilografia-ossea", "rmn-pelve"]);
    const completo = completudeKitTumorLot(pack, [
      "psat", "fosfatase-alcalina", "calcio", "testosterona", "cintilografia-ossea", "rmn-pelve",
    ]);
    expect(completo.kitIncompleto).toBe(false);
    expect(completo.bloqueiaApac).toBe(false);
    expect(completo.score).toBe(1);
  });

  it("nenhum campo dose numérico e nenhum TNM derivado (S1)", () => {
    for (const [chave, valor] of entradas(pack)) {
      if (/^dose/i.test(chave)) expect(typeof valor, chave).not.toBe("number");
      if (/tnm/i.test(chave)) expect(valor, chave).toBe("[VERIFICAR]");
    }
    const proib = pack.proibicoes.join(" | ");
    expect(proib).toContain("nenhum TNM derivado automaticamente");
    expect(proib).toContain("TNM é do médico");
    expect(proib).toContain("não vira lesão óssea oncológica");
  });
});
