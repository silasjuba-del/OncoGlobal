// RT-05 · Laudo de imagem e RADS (S0/S1) — FALHAS reais e lacunas.
// 1) SEM cadeia de elos: o catálogo de 30 emergências (D-W9-51) nunca é varrido elo a elo —
//    avaliarRadAlerts casa termo solto; elos fora de ordem/negados em exame antigo passam.
// 2) Negador incompleto: "não observamos"/"não há" não estão em radAlerts.negado() ⇒
//    falso positivo no PT08 crânio (laudo NEGATIVO) com termo ativo.
// 3) G-07: nenhum gate confronta lateralidade achado × conclusão.
// 4) O ruleset do corpus (rad-emergencia.v1.json) não é consumível por avaliarRadAlerts.
// Dono provável: src/rules/radAlerts.ts + corpus/rulesets (Grok); harness gates (tech lead).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { avaliarRadAlerts } from "../../src/rules/radAlerts.js";
import type { RadRuleset } from "../../src/rules/tipos-w3.js";
import { detectarEmergencias, lerRadsEmergencias } from "../../src/rules/radsEmergencias.js";

const corpusCadeias = JSON.parse(readFileSync(join(process.cwd(), "corpus", "rulesets", "rads-emergencias.v1.json"), "utf8"));
const rsCadeias = lerRadsEmergencias(corpusCadeias);

const rsAtivo: RadRuleset = {
  id: "rad-emergencia", versao: "1.0.0", ativo: true,
  termosEmergencia: [
    { codigo: "massa-epidural", termo: "massa epidural", regraId: "R-COMPRESSAO" },
    { codigo: "apagamento-saco-dural", termo: "apagamento do saco dural", regraId: "R-COMPRESSAO" },
    { codigo: "compressao-medular", termo: "compressão medular", regraId: "R-COMPRESSAO" },
    { codigo: "formacoes-expansivas", termo: "formações expansivas", regraId: "R-CRANIO" },
    { codigo: "hidronefrose", termo: "hidronefrose", regraId: "R-UROPATIA" },
  ],
};

const input = (texto: string) => ({ tipoFonte: "TRANSCRIPTION" as const, texto, data: "2030-01-01" });

async function avaliadorDeCadeia(): Promise<((entrada: unknown) => unknown) | null> {
  // Test the actual chain consumer, not a guessed export name on the legacy scanner.
  return typeof detectarEmergencias === "function"
    ? (entrada) => detectarEmergencias((entrada as { texto: string }).texto, rsCadeias) : null;
}

describe("RT-05 · cadeias das 30 emergências", () => {
  it("avaliador real de CADEIA (elo a elo) das 30 emergências existe", async () => {
    const fn = await avaliadorDeCadeia();
    expect(fn,
      "D-W9-51 define o alerta RADS por CADEIA (massa epidural → apagamento do saco dural → " +
      "compressão → mielopatia); o código casa apenas termo solto (radAlerts). Elos fora de ordem, " +
      "elo negado em exame antigo ou em outro paciente não são confrontados. " +
      "Dono provável: src/rules/radAlerts.ts + corpus/rulesets (Grok).")
      .toBeTypeOf("function");
  });

  it("cadeia válida dispara alerta com todos os elos; cadeia com elo negado não dispara", async () => {
    const fn = await avaliadorDeCadeia();
    if (!fn) return;
    const ok = fn({ tipoFonte: "TRANSCRIPTION", data: "2030-01-01",
      texto: "massa epidural em T7 com apagamento do saco dural, compressão medular e mielopatia." }) as { alertas: unknown[] };
    expect(ok.alertas.length).toBeGreaterThan(0);
    const negada = fn({ tipoFonte: "TRANSCRIPTION", data: "2030-01-01",
      texto: "sem massa epidural; saco dural preservado, sem compressão." }) as { alertas: unknown[] };
    expect(negada.alertas).toEqual([]);
  });

  it("PROVA DE FALHA (S1): negador não cobre 'não observamos' — PT08 crânio NEGATIVO dispara alerta", () => {
    const texto = readFileSync(join(process.cwd(), "docs", "referencias", "modelos",
      "laudos-sinteticos", "PT08-tc-cranio.txt"), "utf8");
    const saida = avaliarRadAlerts(input(texto), rsAtivo);
    expect(saida.alerts,
      `PT08 crânio é um laudo NEGATIVO ("Não observamos formações expansivas intra-axiais...") e o ` +
      `avaliador disparou ${saida.alerts.length} alerta(s) com termo ativo: a função negado() de radAlerts.ts ` +
      `só cobre "sem|nega|negativo para|ausencia de|ausente" — não cobre "não observamos"/"não há"/` +
      `"não se observa". Falso positivo S1 (alerta clínico errado sem negação).`)
      .toEqual([]);
  });

  it("PROVA DE FALHA (S0/S1): lateralidade divergente entre achado e conclusão não gera alerta (G-07)", () => {
    const texto = "USG de rim: hidronefrose acentuada à direita.\nCONCLUSÃO: hidronefrose à esquerda com afilamento do parênquima.";
    const saida = avaliarRadAlerts(input(texto), rsAtivo);
    const comLateralidadeDivergente = saida.alerts.some((a) =>
      (a as { achado?: { motivo?: string } }).achado?.motivo?.match(/lateralidade/iu) !== undefined);
    expect(comLateralidadeDivergente,
      "D-W9-05 (G-07): lateralidade é obrigatória em rim; achado 'à direita' × conclusão 'à esquerda' " +
      "deveria gerar alerta de divergência. Nenhum confronto existe em radAlerts (nem gate G-07 no harness).")
      .toBe(true);
  });

  it("SEM_IMPLEMENTACAO: gate G-07 de lateralidade existe no harness", async () => {
    const mod = (await import("../../src/kernel/harness/gates.js")) as Record<string, unknown>;
    const fn = mod["g07Lateralidade"] ?? mod["g07"];
    expect(fn,
      "Kimi já registrou esta lacuna (tests/adv-w8/g07-t49-lateralidade.adv.ts); nenhum confronto " +
      "PATH×RADS×procedimento×diagnóstico existe em src/kernel/harness/gates.ts. " +
      "Dono provável: kernel/harness (tech lead).")
      .toBeTypeOf("function");
  });

  it("corpus das 30 cadeias é consumível e a capacidade aponta a autoridade atual", () => {
    expect(rsCadeias.id).toBe("rads-emergencias");
    // D-W9-68 (Dr. Silas, 2026-10-07): rads-emergencias 1.1.0 tem 31 linhas.
    expect(rsCadeias.emergencias).toHaveLength(31);
    expect(rsCadeias.negacoes).toEqual(expect.arrayContaining(["sem sinais de", "não há", "ausência de"]));
    const capabilities = JSON.parse(readFileSync(join(process.cwd(), "corpus", "capabilities.v1.json"), "utf8"));
    expect(capabilities.metadados["AG-04"].planejado.ruleset).toBe("rads-emergencias.v1.json");
  });
});
