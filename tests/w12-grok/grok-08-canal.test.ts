// W12-GROK-08 · D-W9-75. Cada sinal tem orientação própria, em RASCUNHO.
// Febre estritamente acima de 37,8. Negação não dispara. Sem dose. Sempre alerta o médico.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarCanalRedflags, lerCanalRedflags } from "../../src/rules/canalRedflags.js";

const json = JSON.parse(readFileSync("corpus/rulesets/canal-redflags.v1.json", "utf8")) as {
  header: { versao: string };
  fraseFinal: string;
  redflags: { id: string; ativo: boolean; fonte: string; respostaFixaTemplateId: string | null }[];
  sinais: { id: string; orientacao: string; status: string; limiarDecimosExclusivo: number | null }[];
};
const canal = lerCanalRedflags(json);
const DOSE = /\b\d+\s*mg\b|\bgotas\b|\bcomprimidos?\b|\b8\/8\b|\bposologia\b|\bml\b/i;
const PROIBIDO = /\b(liberado|aprovado|apto)\b/i;

function avaliar(relato: string) {
  return avaliarCanalRedflags(relato, canal);
}

describe("W12-GROK-08 canal de red flags", () => {
  it("versão 1.1.0, 25 sinais em RASCUNHO e os 6 candidatos antigos continuam inativos", () => {
    expect(json.header.versao).toBe("1.1.0");
    expect(canal.sinais).toHaveLength(25);
    expect(canal.sinais.every((s) => s.status === "RASCUNHO")).toBe(true);
    expect(json.redflags).toHaveLength(6);
    expect(json.redflags.every((r) => r.ativo === false && r.fonte === "[VERIFICAR]" && r.respostaFixaTemplateId === null)).toBe(true);
    expect(canal.fraseFinal).toBe("Nada substitui a avaliação presencial do seu médico.");
  });

  it("nenhuma orientação traz dose, unidade ou posologia", () => {
    for (const sinal of canal.sinais) {
      expect(sinal.orientacao).not.toMatch(DOSE);
      expect(sinal.orientacao).not.toMatch(PROIBIDO);
    }
  });

  it("diarreia devolve a orientação geral do corpus e a frase final", () => {
    const r = avaliar("Paciente Teste 92 está com diarreia");
    const dia = r.respostas.find((item) => item.id === "redflag-10-diarreia");
    expect(dia).toBeDefined();
    expect(dia?.texto).toContain("Hidratação e dieta antidiarreica");
    expect(dia?.texto).toContain("Alimentos a evitar");
    expect(dia?.texto).toContain("Sinais de gravidade");
    expect(dia?.texto).toContain("anti-hipertensivos e diuréticos");
    expect(dia?.texto).toContain("Ir ao PS se houver sinal de gravidade");
    expect(dia?.texto.endsWith(canal.fraseFinal)).toBe(true);
    expect(dia?.alertaMedico).toBe(true);
    expect(dia?.bloqueiaSalvar).toBe(false);
    expect(dia?.defineDose).toBe(false);
    expect(r.alertaMedico).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("febre 37,8 não dispara, 37,9 dispara e a negação não dispara", () => {
    expect(avaliar("temperatura 37,8").respostas.map((item) => item.id)).not.toContain("redflag-01-febre");
    expect(avaliar("temperatura 37.8").estado).toBe("SEM_ALERTA");

    const acima = avaliar("temperatura 37,9");
    expect(acima.respostas.map((item) => item.id)).toContain("redflag-01-febre");
    expect(acima.alertaMedico).toBe(true);
    expect(acima.respostas.every((item) => item.bloqueiaSalvar === false && item.texto.endsWith(canal.fraseFinal))).toBe(true);

    const negado = avaliar("não tem febre");
    expect(negado.estado).toBe("SEM_ALERTA");
    expect(negado.respostas).toEqual([]);
    expect(negado.alertaMedico).toBe(false);
    expect(JSON.stringify(negado)).not.toMatch(PROIBIDO);
  });

  it("a mesma frase devolve a mesma saída e não altera o corpus lido", () => {
    const congelado = JSON.parse(JSON.stringify(canal));
    const a = avaliar("diarreia e tosse");
    const b = avaliar("diarreia e tosse");
    expect(b).toEqual(a);
    expect(a.respostas.map((item) => item.id)).toEqual(["redflag-10-diarreia", "redflag-21-imuno-respiratorio"]);
    expect(canal).toEqual(congelado);
  });
});
