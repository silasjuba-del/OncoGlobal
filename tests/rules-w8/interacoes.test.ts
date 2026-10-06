import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  avaliarInteracaoMedicamentosa,
  type RulesetInteracoes,
} from "../../src/rules/w8/interacoes.js";

// Carrega o ruleset real do corpus para provar o estado do corpus hoje
const CAMINHO_RULESET = join(process.cwd(), "corpus", "rulesets", "interacoes.v1.json");
const rulesetReal: RulesetInteracoes = JSON.parse(readFileSync(CAMINHO_RULESET, "utf8"));

describe("AG-09 · Interações medicamentosas sem fonte = PENDENTE (norma G-09)", () => {
  it("com o ruleset real interacoes.v1.json (todas inativas), qualquer par avaliado sai PENDENTE", () => {
    // Par presente no corpus mas com ativo: false
    const res1 = avaliarInteracaoMedicamentosa("capecitabina", "varfarina", rulesetReal);
    expect(res1.estado).toBe("PENDENTE");
    expect(res1.severidade).toBeNull();
    expect(res1.regraAtiva).toBe(false);
    expect(res1.motivo).toContain("não verificado");
    expect(res1.motivo).not.toContain("sem interação");

    // Outro par presente no corpus
    const res2 = avaliarInteracaoMedicamentosa("ribociclibe", "ondansetrona", rulesetReal);
    expect(res2.estado).toBe("PENDENTE");
    expect(res2.regraAtiva).toBe(false);

    // Par sequer presente na tabela
    const res3 = avaliarInteracaoMedicamentosa("cisplatina", "fluorouracil", rulesetReal);
    expect(res3.estado).toBe("PENDENTE");
    expect(res3.regraAtiva).toBe(false);
  });

  it("G-09: NUNCA retorna VERDE nem 'sem interação' na ausência de regra ativa curada", () => {
    const pares = [
      ["capecitabina", "varfarina"],
      ["paracetamol", "dipirona"],
      ["pembrolizumabe", "prednisona"],
    ];

    for (const par of pares) {
      const [dA, dB] = par;
      const res = avaliarInteracaoMedicamentosa(dA!, dB!, rulesetReal);
      expect(res.estado).not.toBe("VERDE");
      expect(res.estado).toBe("PENDENTE");
      expect(res.motivo).toContain("não verificado");
    }
  });

  it("quando regra for ativada com literatura médica comprovada, emite alerta com severidade", () => {
    const rulesetAtivo: RulesetInteracoes = {
      header: { id: "interacoes-teste", versao: "1.0.0" },
      interacoes: [
        {
          drogaA: "capecitabina",
          drogaBouClasse: "varfarina",
          mecanismo: "Inibição de CYP2C9 aumentando níveis e RNI de varfarina",
          severidade: "GRAVE",
          monitorizacao: "Monitorar RNI estreitamente",
          notaManejo: "Considerar heparina de baixo peso",
          fonte: {
            tipo: "LITERATURA",
            referencia: "Bula profissional Capecitabina / NCCN Guidelines 2026",
            trecho: "Aumento acentuado de coagulopatia",
            edicao: "2026",
          },
          ativo: true, // Formalmente ativada!
        },
      ],
    };

    const res = avaliarInteracaoMedicamentosa("varfarina", "capecitabina", rulesetAtivo);
    expect(res.estado).toBe("VERMELHO");
    expect(res.severidade).toBe("GRAVE");
    expect(res.regraAtiva).toBe(true);
    expect(res.fonteReferencia).toContain("NCCN Guidelines 2026");
    expect(res.motivo).toContain("interação ativa detectada");
  });
});
