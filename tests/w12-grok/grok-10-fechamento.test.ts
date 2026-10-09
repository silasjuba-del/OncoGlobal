// W12-GROK-10 · fechamento. O barrel exporta as regras da onda.
// As regras novas não leem relógio, rede nem arquivo. A mesma entrada dá a mesma saída.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  alertarVertigemNova,
  avaliarCanalRedflags,
  avaliarIntervaloDaUltimaQt,
  avaliarIntervaloPosQt,
  avaliarRetornoToxicidade,
  avaliarTextoCtcae,
  extrairCriteriosCtcae,
  lerAlertaVertigem,
  lerCanalRedflags,
  lerIntervalos,
  sugerirGrauCtcae,
  valorAtual,
} from "../../src/rules/index.js";

const PROIBIDO = /\b(liberado|aprovado|apto)\b/i;
const IMPURO = /node:fs|Date\.now|new Date|Math\.random|\bfetch\b|from ["']node:|from ["']https?:/;
const NOVOS = [
  "src/rules/ctcaeTexto.ts",
  "src/rules/ctcaeClinico.ts",
  "src/rules/retornoToxicidade.ts",
  "src/rules/tontura.ts",
  "src/rules/intervaloPosQt.ts",
  "src/rules/canalRedflags.ts",
  "src/rules/valorAtual.ts",
  "src/rules/index.ts",
];

const triagem = JSON.parse(readFileSync("corpus/rulesets/salao-triagem.v1.json", "utf8"));
const ctcae = JSON.parse(readFileSync("corpus/rulesets/salao-ctcae.v1.json", "utf8"));
const suporte = JSON.parse(readFileSync("corpus/rulesets/salao-suporte.v1.json", "utf8"));
const lab = JSON.parse(readFileSync("corpus/rulesets/lab-thresholds.v1.json", "utf8"));
const intervalos = JSON.parse(readFileSync("corpus/rulesets/intervalos.v1.json", "utf8"));
const canal = JSON.parse(readFileSync("corpus/rulesets/canal-redflags.v1.json", "utf8"));

function igual(entrada: unknown, rodar: () => unknown): void {
  const antes = JSON.stringify(entrada);
  const a = rodar();
  const b = rodar();
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(JSON.stringify(entrada)).toBe(antes);
  const texto = JSON.stringify(a);
  expect(texto).not.toMatch(PROIBIDO);
  expect(texto).not.toMatch(/"bloqueiaSalvar":true/);
}

describe("W12-GROK-10 fechamento", () => {
  it("o barrel exporta as regras da onda", () => {
    for (const fn of [
      extrairCriteriosCtcae,
      sugerirGrauCtcae,
      avaliarTextoCtcae,
      avaliarRetornoToxicidade,
      alertarVertigemNova,
      lerAlertaVertigem,
      avaliarIntervaloPosQt,
      lerIntervalos,
      avaliarIntervaloDaUltimaQt,
      avaliarCanalRedflags,
      lerCanalRedflags,
      valorAtual,
    ]) {
      expect(typeof fn).toBe("function");
    }
  });

  it("as regras novas não importam relógio, rede nem arquivo", () => {
    const fonte = NOVOS.map((caminho) => readFileSync(caminho, "utf8")).join("\n");
    expect(fonte).not.toMatch(IMPURO);
  });

  it("a mesma entrada dá a mesma saída e a entrada congelada não muda", () => {
    const texto = "Paciente Teste 94 teve 6 episódios de vômito por 3 dias.";
    igual({ texto, ctcae }, () => avaliarTextoCtcae(texto, ctcae));

    const criterios = extrairCriteriosCtcae(texto);
    igual({ criterios, ctcae }, () => sugerirGrauCtcae(criterios, ctcae));

    const retorno = {
      pacienteId: "Paciente Teste 94",
      grau: 3,
      plaquetas: 20_000,
      dataPlaquetas: "2026-10-08",
      horasDiarreia: 25,
      vomito: true,
      medicamentos: [{ nome: "HAS", classe: "NAO_ONCOLOGICA" as const }],
      dm2: false,
      tempDecimos: 365,
    };
    igual({ retorno, suporte, lab, triagem, ctcae }, () => avaliarRetornoToxicidade(retorno, suporte, lab, triagem, ctcae));

    const vertigem = { tontura: true, historicoAnterior: false, inicioNovo: true };
    const frase = lerAlertaVertigem(triagem);
    igual({ vertigem, frase }, () => alertarVertigemNova(vertigem, frase));

    const intervalo = { ultimaQt: "2026-09-08", dataAlvo: "2026-10-08", alvo: "CIRURGIA", offset: "-03:00" };
    igual({ intervalo, intervalos }, () => avaliarIntervaloDaUltimaQt(intervalo, intervalos));

    const limites = lerIntervalos(intervalos);
    const civil = { ultimaQt: "2026-09-08", dataAlvo: "2026-10-07", alvo: "RT_SEQUENCIAL" };
    igual({ civil, limites }, () => avaliarIntervaloPosQt(civil, limites));

    const lido = lerCanalRedflags(canal);
    const relato = "Paciente Teste 94 está com diarreia e tosse";
    igual({ relato, lido }, () => avaliarCanalRedflags(relato, lido));

    const serie = {
      hoje: "2026-08-04",
      validadeDias: 7,
      leituras: [
        { valor: 180_000, data: "2026-07-21", hora: "08:00" },
        { valor: 20_000, data: "2026-08-04", hora: "08:00" },
      ],
    };
    igual(serie, () => valorAtual(serie));
  });
});
