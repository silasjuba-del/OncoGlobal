// F1-B2 · Jornadas das fichas novas (D-F1-49) — para CADA ficha do manifesto:
// (1) carregada pelo loader real do servidor; (2) RASCUNHO recusada com TEMPLATE_NAO_CONFERIDO
// (incompletude/falta de aprovação VISÍVEL, com templateId+status); (3) em fixture isolada de teste
// (status promovido SÓ EM MEMÓRIA, nunca gravado), o cálculo executa na variante correta e campos
// NAO_LOCALIZADO ficam PENDENTE (nunca 0); (4) versão/hash do manifesto = versão/hash da ficha.
// O caminho HTTP da rota /consulta/prescricao/rascunho (mesmo contrato) já é coberto por
// tests/server/leituras-http.test.ts; aqui exercitamos as regras reais para as 22 fichas B2.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProtocolTemplate } from "../../../src/contracts/w10/prescricao.js";
import { instanciarProtocolo, arredondaMeioParaCima, type DadosCorporais } from "../../../src/rules/prescricao/instanciarProtocolo.js";
import { doseRuleset } from "../../fixtures/rulesets.js";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(RAIZ, "corpus/manifesto/b2-fichas.v1.json"), "utf8"));
const rs = { header: doseRuleset.header, reducoesPct: [0, 20, 30, 40], semPesoConsecutivosVermelho: 2, AC: { ciclosComMedico: [] } } as const;
const dados: DadosCorporais = { pesoKg: 70, alturaCm: 170, bsaM2: 1.8, clcr: 80, medidoEm: "2026-10-14T08:00:00-03:00" };

// loader real do servidor (varre corpus/fichas recursivamente — pastas novas entram sozinhas)
const { carregarCorpusServidor } = await import("../../../src/server/corpus.js");
const templates = carregarCorpusServidor().templatesProtocolo;
const ids = new Set(templates.map((t: any) => t.templateId));

describe("F1-B2 · jornadas das 22 fichas novas (D-F1-49)", () => {
  it("todas carregam pelo loader real do servidor no lugar correto (corpus/fichas/<tumor>)", () => {
    for (const f of manifest.fichasNovas) expect(ids.has(f.templateId), f.arquivo).toBe(true);
    expect(templates.length).toBeGreaterThanOrEqual(96);
  });

  it("RASCUNHO é recusada com TEMPLATE_NAO_CONFERIDO carregando templateId (com versão) e status — aprovação visível", () => {
    for (const f of manifest.fichasNovas) {
      const json = ProtocolTemplate.parse(JSON.parse(readFileSync(join(RAIZ, f.arquivo), "utf8")));
      expect(json.versao, f.arquivo).toBe(f.versao);
      expect(json.hash, f.arquivo).toBe(f.hash); // hash do manifesto = hash canônico da ficha
      const r = instanciarProtocolo(json as any, dados, [] as any);
      expect(r.ok, f.arquivo).toBe(false);
      if (r.ok) continue;
      expect(r.recusa.codigo, f.arquivo).toBe("TEMPLATE_NAO_CONFERIDO");
      expect(r.recusa.templateId, f.arquivo).toContain(`@${f.versao}`);
      expect(r.recusa.status, f.arquivo).toBe("RASCUNHO");
    }
  });

  it("em fixture isolada (promoção EM MEMÓRIA, nunca gravada): doses computam na variante correta e NAO_LOCALIZADO fica PENDENTE", () => {
    for (const f of manifest.fichasNovas) {
      const base = JSON.parse(readFileSync(join(RAIZ, f.arquivo), "utf8"));
      const promovida = ProtocolTemplate.parse({ ...base, status: "CONFERIDA_MEDICO" }); // só neste processo de teste
      const r = instanciarProtocolo(promovida as any, dados, [] as any);
      expect(r.ok, f.arquivo).toBe(true);
      if (!r.ok) continue;
      const pendentesEsperados = manifest.fichasNovas.find((x: any) => x.templateId === f.templateId)!.campos.filter((c: any) => c.situacao === "NAO_LOCALIZADO").length;
      if (pendentesEsperados > 0) {
        expect(r.pendentes, f.arquivo).toBeGreaterThanOrEqual(pendentesEsperados); // lacuna visível, nunca 0
        for (const i of r.itens) if (i.estado !== "PRONTO") expect(i.item.calculatedDose ?? null, `${f.arquivo} ${i.item.drug}`).toBeNull();
      }
      for (const i of r.itens.filter((x) => x.estado === "PRONTO" && x.item.classe === "QT" && x.item.standardDose !== null && !/^Manitol/.test(x.item.drug))) {
        const esperado = i.item.doseBasis === "MG_M2" ? arredondaMeioParaCima(i.item.standardDose! * 1.8)
          : i.item.doseBasis === "AUC" ? arredondaMeioParaCima(i.item.standardDose! * (Math.min(80, 125) + 25))
          : i.item.standardDose;
        expect(i.item.calculatedDose, `${f.arquivo} ${i.item.drug}`).toBe(esperado);
      }
    }
    // Conferência dirigida (variantes centrais):
    const cupDoc = JSON.parse(readFileSync(join(RAIZ, "corpus/fichas/primario-desconhecido-cup/cisplatina-docetaxel__nao-especificado.json"), "utf8"));
    const rDoc = instanciarProtocolo({ ...cupDoc, status: "CONFERIDA_MEDICO" } as any, dados, [] as any);
    if (rDoc.ok) expect(rDoc.itens.find((i) => i.item.drug === "Docetaxel")!.item.calculatedDose).toBe(135); // Greco 75 × 1,8
    const cupCarbo = JSON.parse(readFileSync(join(RAIZ, "corpus/fichas/primario-desconhecido-cup/carboplatina-paclitaxel-21-21-dias__nao-especificado.json"), "utf8"));
    const rCarbo = instanciarProtocolo({ ...cupCarbo, status: "CONFERIDA_MEDICO" } as any, dados, [] as any);
    if (rCarbo.ok) expect(rCarbo.itens.find((i) => i.item.drug === "Carboplatina")!.item.calculatedDose).toBe(630); // AUC 6 × (80+25)
    const map14 = JSON.parse(readFileSync(join(RAIZ, "corpus/fichas/osteossarcoma/map-ciclos-1-4__nao-especificado.json"), "utf8"));
    const rMap = instanciarProtocolo({ ...map14, status: "CONFERIDA_MEDICO" } as any, dados, [] as any);
    if (rMap.ok) expect(rMap.itens.find((i) => i.item.drug === "Metotrexato")!.item.calculatedDose).toBe(21600); // 12.000 × 1,8
    const p1577 = JSON.parse(readFileSync(join(RAIZ, "corpus/fichas/nao-informado-ficha-institucional/folinato-5-fu-semanal-p1577__nao-especificado.json"), "utf8"));
    const r1577 = instanciarProtocolo({ ...p1577, status: "CONFERIDA_MEDICO" } as any, dados, [] as any);
    if (r1577.ok) expect(r1577.itens.find((i) => /Fluoruracila/.test(i.item.drug))!.item.calculatedDose).toBe(765); // D-F1-50: 425 × 1,8 (NHS CR004)
  });
});
