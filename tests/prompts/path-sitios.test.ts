// W8/GLM-12 · PATH@1.1.0: extração por sítio e proibição de agregar o caso (caso real 01 §2, P1–P3).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const prompt = readFileSync(fileURLToPath(new URL("../../corpus/prompts/PATH@1.1.0.md", import.meta.url)), "utf8");

// Laudo sintético (Paciente Teste 07, desidentificado): 6 sítios, graus mistos, cribriforme em exatamente 1.
const LAUDO_SINTETICO = `
Paciente: ⟨NOME_1⟩ — Material: biópsia de próstata, 6 fragmentos.
Sítio 1 — base direita: adenocarcinoma acinar, Gleason 3+3, grupo de grau 1, sem padrão cribriforme.
Sítio 2 — terço médio direito: adenocarcinoma acinar, Gleason 3+4, grupo de grau 2, sem padrão cribriforme.
Sítio 3 — ápice direito: adenocarcinoma acinar, Gleason 3+4, grupo de grau 2, sem padrão cribriforme.
Sítio 4 — base esquerda: adenocarcinoma acinar, Gleason 3+4, grupo de grau 2, sem padrão cribriforme.
Sítio 5 — terço médio esquerdo: adenocarcinoma acinar, Gleason 3+4, grupo de grau 2, PADRÃO CRIBRIFORME PRESENTE.
Sítio 6 — ápice esquerdo: adenocarcinoma acinar, Gleason 3+3, grupo de grau 1, sem padrão cribriforme.
`;

describe("PATH@1.1.0 (W8/GLM-12)", () => {
  it("laudo sintético de referência: 6 sítios, cribriforme em exatamente 1 (P1)", () => {
    const sitios = LAUDO_SINTETICO.trim().split("\n").filter((l) => l.startsWith("Sítio"));
    expect(sitios).toHaveLength(6);
    expect(sitios.filter((s) => /CRIBRIFORME PRESENTE/.test(s))).toHaveLength(1);
    expect(sitios.filter((s) => /sem padrão cribriforme/.test(s))).toHaveLength(5);
  });

  it("instrui extração por sítio com os 13 campos de sitios[]", () => {
    expect(prompt).toContain("um elemento por sítio descrito no laudo");
    for (const campo of ["sitio", "lateralidade", "posicao", "fragmentosComprometidos", "fragmentosAvaliados", "percentuais[]", "gleasonPrimario", "gleasonSecundario", "grupoGrau", "cribriforme", "intraductal", "invasaoPerineural", "invasaoVascular"])
      expect(prompt).toContain(campo);
    expect(prompt).toContain("base, terço médio, ápice");
  });

  it("proíbe agregação do caso: 'grau do caso' é regra, nunca LLM (P2)", () => {
    expect(prompt).toContain("Proibido agregar o caso");
    expect(prompt).toContain('"grau do caso"');
    expect(prompt).toContain("agregação por regra");
    expect(prompt).toContain("nunca tarefa do modelo");
    expect(prompt).toContain('não responde, resume ou comenta');
  });

  it("negação e valores por sítio: cribriforme presente|ausente|null; grupoGrau nunca derivado", () => {
    expect(prompt).toContain('`"presente"` | `"ausente"` | `null`');
    expect(prompt).toContain("sem padrão cribriforme");
    expect(prompt).toContain("naquele sítio");
    expect(prompt).toContain("nao_descrito ≠ ausente");
    expect(prompt).toContain("nunca derivado do escore de Gleason");
  });

  it("IHQ é tabela literal linha a linha (P3)", () => {
    expect(prompt).toContain("ihq[] { anticorpo, clone, interpretacao }");
    expect(prompt).toContain("uma entrada por linha");
    expect(prompt).toContain("sem sinonímia, graduação ou conclusão do modelo");
  });

  it("espécimes distintos não são fundidos; universal BASE §47 presente", () => {
    expect(prompt).toContain("não fundir espécimes");
    expect(prompt).toContain("Espécimes distintos");
    for (const frase of ["não inventar", "null quando ausente", "desidentificada", "Saída só JSON", "não escolher entre fontes", "negações", "lateralidade"])
      expect(prompt).toContain(frase);
  });
});
