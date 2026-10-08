// W12-GROK-04 · texto livre vira sugestão. Só casa frase literal da v6. Ambiguidade não elege grau.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarTextoCtcae, extrairCriteriosCtcae } from "../../src/rules/index.js";

const corpus = JSON.parse(readFileSync("corpus/rulesets/salao-ctcae.v1.json", "utf8")) as {
  header: { versao: string };
};
const PROIBIDO = /\b(liberado|aprovado|apto)\b/i;

function congelar(valor: unknown): void {
  if (typeof valor === "object" && valor !== null) {
    Object.freeze(valor);
    for (const item of Object.values(valor)) congelar(item);
  }
}

function um(texto: string, termo: string) {
  const achados = avaliarTextoCtcae(texto, corpus).filter((r) => r.termo === termo);
  const r = achados[0];
  if (achados.length !== 1 || r === undefined) throw new Error(`termo ${termo} ausente`);
  return r;
}

function literal(r: { criteriosUsados: { criterioLiteral: string; trecho: { texto: string } }[] }, indice = 0) {
  const item = r.criteriosUsados[indice];
  if (item === undefined) throw new Error("criterio ausente");
  return item;
}

function unico<T>(lista: readonly T[]): T {
  const item = lista[0];
  if (lista.length !== 1 || item === undefined) throw new Error("resultado ausente");
  return item;
}

function perguntaDe(r: { criteriosFaltantes: readonly { pergunta: string }[] }): string {
  const item = r.criteriosFaltantes[0];
  if (item === undefined) throw new Error("pergunta ausente");
  return item.pergunta;
}

function conferirTrechos(texto: string) {
  for (const c of extrairCriteriosCtcae(texto)) expect(texto.slice(c.inicio, c.fim)).toBe(c.texto);
  for (const r of avaliarTextoCtcae(texto, corpus)) {
    for (const usado of r.criteriosUsados) expect(texto.slice(usado.trecho.inicio, usado.trecho.fim)).toBe(usado.trecho.texto);
    for (const leitura of r.ambiguidades) expect(texto.slice(leitura.trecho.inicio, leitura.trecho.fim)).toBe(leitura.trecho.texto);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.sugestao).toBe(true);
    expect(r.confirmadoPeloMedico).toBe(false);
    expect(r.rulesetVersao).toBe(corpus.header.versao);
  }
}

describe("W12-GROK-04 texto para grau", () => {
  it("vômito com observação hospitalar sugere G3 e mostra as duas leituras da quantidade", () => {
    const texto = "Paciente Teste 91 teve 6 episódios de vômito por 3 dias, sendo necessária observação hospitalar.";
    const r = um(texto, "vomito");
    expect(r.grauSugerido).toBe(3);
    expect(r.status).toBe("SUGESTAO");
    expect(r.destino).toBeNull();
    expect(r.e1).toBe(false);
    const hospital = r.criteriosUsados.find((c) => c.tipo === "hospitalizacao");
    expect(hospital?.criterioLiteral).toContain("hospitalization indicated");
    expect(hospital?.trecho.texto.toLowerCase()).toContain("observação hospitalar");
    expect(hospital?.fonteTrecho).toContain("Vomiting");
    expect(r.ambiguidades.map((a) => a.leitura).sort()).toEqual(["NO_TOTAL", "POR_DIA"]);
    expect(r.ambiguidades.every((a) => a.grau === null && a.quantidade === 6 && a.periodoDias === 3)).toBe(true);
    conferirTrechos(texto);
  });

  it("hidratação EV ambulatorial de vômito casa a frase de G2", () => {
    const texto = "Paciente Teste 91 iniciou hidratação EV ambulatorial por vômitos.";
    const r = um(texto, "vomito");
    expect(r.grauSugerido).toBe(2);
    expect(literal(r).criterioLiteral).toContain("outpatient IV hydration");
    conferirTrechos(texto);
  });

  it("6 evacuações por dia a mais é G2; 4 passa no mesmo critério; 7 é G3", () => {
    const seis = um("Paciente Teste 92 com 6 evacuações por dia a mais que o habitual.", "diarreia");
    expect(seis.grauSugerido).toBe(2);
    expect(literal(seis).criterioLiteral).toContain("4 - 6 stools per day");
    const quatro = um("Paciente Teste 92 com 4 evacuações por dia a mais que o habitual.", "diarreia");
    expect(quatro.grauSugerido).toBe(2);
    const sete = um("Paciente Teste 93 com 7 evacuações por dia acima do basal.", "diarreia");
    expect(sete.grauSugerido).toBe(3);
    expect(literal(sete).criterioLiteral).toContain(">=7 stools per day");
    const tres = um("Paciente Teste 92 com 3 evacuações por dia a mais que o habitual.", "diarreia");
    expect(tres.grauSugerido).toBeNull();
    expect(tres.status).toBe("PENDENTE");
  });

  it("hidratação EV na diarreia casa o critério de G3 e não esconde a contagem G2", () => {
    const r = um("Paciente Teste 92 com 6 evacuações por dia a mais que o habitual e hidratação EV.", "diarreia");
    expect(r.grauSugerido).toBe(3);
    expect(r.criteriosUsados.map((c) => c.grau).sort()).toEqual([2, 3]);
    expect(r.criteriosUsados.some((c) => c.criterioLiteral.includes("requires IV intervention"))).toBe(true);
  });

  it("6 episódios de diarreia por 3 dias não elege grau", () => {
    const texto = "Paciente Teste 94 teve 6 episódios de diarreia por 3 dias a mais que o habitual.";
    const r = um(texto, "diarreia");
    expect(r.grauSugerido).toBeNull();
    expect(r.status).toBe("PENDENTE");
    const porDia = r.ambiguidades.find((a) => a.leitura === "POR_DIA");
    const total = r.ambiguidades.find((a) => a.leitura === "NO_TOTAL");
    expect(porDia?.grau).toBe(2);
    expect(porDia?.criterioLiteral).toContain("4 - 6 stools per day");
    expect(total?.grau).toBeNull();
    expect(r.criteriosFaltantes.some((f) => f.pergunta.includes("duas leituras"))).toBe(true);
    conferirTrechos(texto);
  });

  it("mucosite com dor intensa que interfere na alimentação sugere G3", () => {
    const r = um("Paciente Teste 95 com mucosite oral, dor intensa que interfere na alimentação.", "mucositeOral");
    expect(r.grauSugerido).toBe(3);
    expect(r.criteriosUsados.some((c) => c.criterioLiteral.includes("Severe pain"))).toBe(true);
    expect(r.criteriosUsados.some((c) => c.criterioLiteral.includes("interfering with oral intake"))).toBe(true);
  });

  it("febre usa a faixa literal: 38,5 e 39,0 são G1; 39,1 é G2; 37,9 não entra", () => {
    expect(um("Paciente Teste 96 com febre de 38,5 graus.", "febre").grauSugerido).toBe(1);
    expect(literal(um("Paciente Teste 96 com febre de 38,5 graus.", "febre")).criterioLiteral).toContain("38.0 - 39.0");
    expect(um("Paciente Teste 96 com febre de 39,0 graus.", "febre").grauSugerido).toBe(1);
    expect(um("Paciente Teste 96 com febre de 39,1 graus.", "febre").grauSugerido).toBe(2);
    const baixa = um("Paciente Teste 96 com febre de 37,9 graus.", "febre");
    expect(baixa.grauSugerido).toBeNull();
    expect(baixa.status).toBe("PENDENTE");
    expect(perguntaDe(baixa)).toContain("não entra em faixa");
  });

  it("febre acima de 40 sem duração fica PENDENTE; 24 h é G3 e 25 h é G4", () => {
    const semDuracao = um("Paciente Teste 96 com febre de 40,1 graus.", "febre");
    expect(semDuracao.grauSugerido).toBeNull();
    expect(perguntaDe(semDuracao)).toContain("24 horas");
    expect(um("Paciente Teste 96 com febre de 40,1 graus por 24 horas.", "febre").grauSugerido).toBe(3);
    expect(um("Paciente Teste 96 com febre de 40,1 graus por 25 horas.", "febre").grauSugerido).toBe(4);
  });

  it("negação não conta e a mesma frase sem critério fica PENDENTE", () => {
    const negada = "Paciente Teste 97 sem vômitos e não tem febre.";
    expect(extrairCriteriosCtcae(negada).filter((c) => c.termo === "vomito" || c.termo === "febre")).toHaveLength(0);
    const vazio = unico(avaliarTextoCtcae(negada, corpus));
    expect(vazio.termo).toBeNull();
    expect(vazio.grauSugerido).toBeNull();
    expect(vazio.status).toBe("PENDENTE");
    const parcial = unico(avaliarTextoCtcae("Paciente Teste 97 sem vômitos, com febre de 38,5 graus.", corpus));
    expect(parcial.termo).toBe("febre");
    expect(parcial.grauSugerido).toBe(1);
    const semCriterio = unico(avaliarTextoCtcae("Paciente Teste 99 dormiu a noite toda.", corpus));
    expect(semCriterio.termo).toBeNull();
    expect(semCriterio.status).toBe("PENDENTE");
    expect(perguntaDe(semCriterio)).toContain("Nenhum termo");
  });

  it("fadiga com autocuidado é G3 e formigamento com AVD instrumental é G2", () => {
    const fadiga = um("Paciente Teste 90 com fadiga que não alivia com o repouso e limita o autocuidado.", "fadiga");
    expect(fadiga.grauSugerido).toBe(3);
    expect(literal(fadiga).criterioLiteral).toContain("limiting self-care ADL");
    const neuro = um("Paciente Teste 89 com formigamento que limita as atividades instrumentais.", "neuropatiaPerifericaSensitiva");
    expect(neuro.grauSugerido).toBe(2);
    expect(literal(neuro).criterioLiteral).toContain("limiting instrumental ADL");
  });

  it("plaquetas 20.000 são G3 na fila do médico, sem E1; 10.000 continua G3; 9.999 é G4", () => {
    const g3 = um("Paciente Teste 91 com plaquetas 20.000.", "plaquetas");
    expect(g3.grauSugerido).toBe(3);
    expect(g3.destino).toBe("FILA_MEDICO");
    expect(g3.e1).toBe(false);
    expect(g3.status).toBe("SUGESTAO");
    expect(literal(g3).criterioLiteral).toContain("maxExclusivo 50000");
    expect(literal(g3).trecho.texto).toContain("20.000");
    const limite = um("Paciente Teste 91 com plaquetas 10000.", "plaquetas");
    expect(limite.grauSugerido).toBe(3);
    expect(limite.e1).toBe(false);
    const g4 = um("Paciente Teste 91 com plaquetas 9999.", "plaquetas");
    expect(g4.grauSugerido).toBe(4);
    expect(g4.e1).toBe(true);
    expect(g4.destino).toBe("FILA_MEDICO");
    expect(g4.bloqueiaSalvar).toBe(false);
    expect(literal(g4).criterioLiteral).toContain("maxExclusivo 10000");
    expect(um("Paciente Teste 91 com plaquetas 25000.", "plaquetas").grauSugerido).toBe(3);
    const fora = um("Paciente Teste 91 com plaquetas 180000.", "plaquetas");
    expect(fora.grauSugerido).toBeNull();
    expect(fora.status).toBe("PENDENTE");
    expect(fora.destino).toBeNull();
    const conflito = um("Paciente Teste 91 com plaquetas 180.000 e plaquetas 20.000.", "plaquetas");
    expect(conflito.grauSugerido).toBeNull();
    expect(perguntaDe(conflito)).toContain("180000");
    expect(perguntaDe(conflito)).toContain("20000");
  });

  it("termo inativo não usa o texto do grau", () => {
    const clone = JSON.parse(JSON.stringify(corpus)) as typeof corpus & {
      graus: { termosClinicos: { diarreia: { ativo: boolean; status: string } } };
    };
    clone.graus.termosClinicos.diarreia.ativo = false;
    clone.graus.termosClinicos.diarreia.status = "NAO_VERIFICADO";
    const r = unico(avaliarTextoCtcae("Paciente Teste 92 com 6 evacuações por dia a mais que o habitual.", clone));
    expect(r.termo).toBe("diarreia");
    expect(r.grauSugerido).toBeNull();
    expect(r.status).toBe("PENDENTE");
    expect(r.criteriosUsados).toHaveLength(0);
    expect(perguntaDe(r)).toContain("NAO_VERIFICADO");
  });

  it("o mesmo texto dá o mesmo resultado e não altera o corpus", () => {
    const texto = "Paciente Teste 91 teve 6 episódios de vômito por 3 dias, sendo necessária observação hospitalar.";
    const copia = JSON.parse(JSON.stringify(corpus)) as typeof corpus;
    congelar(copia);
    const antes = JSON.stringify(copia);
    const a = avaliarTextoCtcae(texto, copia);
    const b = avaliarTextoCtcae(texto, copia);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(copia)).toBe(antes);
    expect(texto).toBe("Paciente Teste 91 teve 6 episódios de vômito por 3 dias, sendo necessária observação hospitalar.");
  });

  it("as regras novas não leem arquivo, relógio nem rede", () => {
    const fonte = [
      readFileSync("src/rules/ctcaeTexto.ts", "utf8"),
      readFileSync("src/rules/ctcaeClinico.ts", "utf8"),
    ].join("\n");
    expect(fonte).not.toMatch(/node:fs|Date\.now|new Date|Math\.random|\bfetch\b/);
  });
});
