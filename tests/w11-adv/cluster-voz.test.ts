// W11-H25 · clusters por voz/texto (PLN-013): descrição abre sem marcar; ordem marca só o dito (DRAFT); negação não abre nem marca.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { interpretarFrase, type CorpusClustersVoz, type ResultadoVoz } from "../../src/rules/clusterVoz.js";

const ler = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
const corpus = ler("../../corpus/clusters/clusters-voz.v1.json") as CorpusClustersVoz;
const matriz = ler("../../corpus/matriz/matriz-universal.v1.json") as { categorias: Nó[] };

type Nó = { id: string; classes?: Nó[]; secoes?: Nó[]; topicos?: Nó[] };
const chavesDaMatriz = (): Set<string> => {
  const saida = new Set<string>();
  const percorre = (nos: Nó[], prefixo: string | null): void => {
    for (const n of nos) {
      const chave = prefixo === null ? n.id : `${prefixo}/${n.id}`;
      saida.add(chave);
      percorre([...(n.classes ?? []), ...(n.secoes ?? []), ...(n.topicos ?? [])], chave);
    }
  };
  percorre(matriz.categorias, null);
  return saida;
};

const um0 = (r: ResultadoVoz[]): ResultadoVoz => {
  const primeiro = r[0];
  if (!primeiro) throw new Error("resultado vazio");
  return primeiro;
};
const um = (frase: string, contexto?: Parameters<typeof interpretarFrase>[2]): ResultadoVoz => {
  const r = interpretarFrase(frase, corpus, contexto);
  expect(r).toHaveLength(1);
  return um0(r);
};
const porCluster = (r: ResultadoVoz[], id: string): ResultadoVoz => {
  const achado = r.find((x) => x.cluster === id);
  if (!achado) throw new Error(`cluster ausente no resultado: ${id}`);
  return achado;
};
const idsMarcados = (r: ResultadoVoz): string[] => r.itensMarcados.map((i) => i.id);

describe("clusters por voz/texto (PLN-013)", () => {
  it("corpus é RASCUNHO, não consumível e todas as chaves de matriz existem", () => {
    expect(corpus.status).toBe("RASCUNHO");
    expect(corpus.consumivel).toBe(false);
    const chaves = chavesDaMatriz();
    for (const cl of corpus.clusters) {
      for (const k of cl.chavesMatriz) expect(chaves.has(k), k).toBe(true);
      for (const it of cl.itens) if (it.chaveMatriz !== null) expect(chaves.has(it.chaveMatriz), it.chaveMatriz).toBe(true);
    }
  });

  it("descrição abre o cluster sem marcar nenhum item", () => {
    const r = um("Vejo aqui que a senhora está com anemia. Vamos ter que investigar isso.");
    expect(r.intencao).toBe("DESCRICAO");
    expect(r.cluster).toBe("ANEMIA");
    expect(r.itensMarcados).toEqual([]);
    expect(r.pendencias).toContain("confirmar Hb e data");
    expect(r.pendencias).toContain("classificar gravidade");
    expect(r.evidencia).toBe("Vejo aqui que a senhora está com anemia");
  });

  it("ordem explícita marca só os itens ditos, com status DRAFT, e remove as pendências cobertas", () => {
    const r = um("Vou pedir ferritina e vitamina B12.");
    expect(r.intencao).toBe("ORDEM");
    expect(idsMarcados(r)).toEqual(["ferritina", "b12"]);
    expect(r.itensMarcados.every((i) => i.status === "DRAFT")).toBe(true);
    expect(r.pendencias).not.toContain("avaliar ferro / ferritina / TSAT");
    expect(r.pendencias).not.toContain("avaliar B12");
    expect(r.pendencias).toContain("confirmar Hb e data");
    expect(r.pendencias).toContain("avaliar folato");
  });

  it("enumeração com vírgulas mantém a ordem nos itens seguintes", () => {
    const r = um("Vou pedir hemograma, ferritina e B12.");
    expect(idsMarcados(r)).toEqual(["hmg", "ferritina", "b12"]);
    expect(r.pendencias).not.toContain("confirmar Hb e data");
  });

  it("negação não abre cluster por descrição", () => {
    const r = um("Não tem anemia.");
    expect(r.intencao).toBe("NENHUMA");
    expect(r.cluster).toBeNull();
    expect(um("Sem anemia no exame de hoje.").intencao).toBe("NENHUMA");
  });

  it("negação não marca item por ordem", () => {
    const r = um("Não vou pedir ferritina.");
    expect(r.intencao).toBe("NENHUMA");
    expect(r.itensMarcados).toEqual([]);
  });

  it("negação parcial: marca só o item afirmado", () => {
    const r = um("Vou pedir hemograma, mas não ferritina.");
    expect(idsMarcados(r)).toEqual(["hmg"]);
  });

  it("negação de ordem interrompe a enumeração seguinte", () => {
    const r = um("Não vou pedir ferritina, B12 também não.");
    expect(r.itensMarcados).toEqual([]);
  });

  it("mistura: abre clusters diferentes na mesma fala, cada um com seu resultado", () => {
    const r = interpretarFrase("Tem anemia e neutropenia, vou pedir hemograma e tomografia do pulmão.", corpus);
    expect(r.map((x) => x.cluster)).toEqual(["ANEMIA", "NEUTROPENIA", "IMAGEM"]);
    expect(porCluster(r, "ANEMIA").intencao).toBe("ORDEM");
    expect(idsMarcados(porCluster(r, "ANEMIA"))).toEqual(["hmg"]);
    expect(porCluster(r, "NEUTROPENIA").intencao).toBe("DESCRICAO");
    expect(porCluster(r, "NEUTROPENIA").itensMarcados).toEqual([]);
    expect(idsMarcados(porCluster(r, "IMAGEM"))).toEqual(["tc"]);
  });

  it("imagem: indicação genérica abre o cluster; tomografia pedida marca o item e tira a pendência de sítio", () => {
    const aberto = um("Está na hora de fazer um exame de imagem.");
    expect(aberto.cluster).toBe("IMAGEM");
    expect(aberto.intencao).toBe("DESCRICAO");
    expect(aberto.pendencias).toContain("definir sítio");

    const pedido = um("Vou pedir uma tomografia do pulmão.");
    expect(pedido.intencao).toBe("ORDEM");
    expect(idsMarcados(pedido)).toEqual(["tc"]);
    expect(pedido.pendencias).not.toContain("definir sítio");
    expect(pedido.chavesMatriz).toEqual(["investigacao/rad"]);
  });

  it("retorno e diarreia: descrição, depois ordem na frase seguinte", () => {
    const r = interpretarFrase("Paciente com diarreia grau 2. Vou pedir hidratação.", corpus);
    expect(porCluster(r, "DIARREIA").intencao).toBe("ORDEM");
    expect(idsMarcados(porCluster(r, "DIARREIA"))).toEqual(["hidratacao"]);

    const retorno = um("Vou marcar retorno em 21 dias.");
    expect(retorno.cluster).toBe("RETORNO");
    expect(idsMarcados(retorno)).toEqual(["21-dias"]);
  });

  it("nenhum fármaco ou dose é deduzido nem marcado", () => {
    const r = um("Vou pedir ferro endovenoso 500 mg.");
    expect(r.intencao).toBe("NENHUMA");
    const serializado = JSON.stringify(interpretarFrase("Tem anemia. Vou pedir ferritina.", corpus));
    expect(serializado).not.toMatch(/\d+\s?(mg|mcg|ml)\b/i);
    expect(serializado).not.toContain("CONFIRMADO");
  });

  it("frase vazia ou sem assunto clínico devolve NENHUMA", () => {
    expect(um("").intencao).toBe("NENHUMA");
    expect(um("Bom dia, como está o tempo hoje?").intencao).toBe("NENHUMA");
  });

  it("item citado por dois clusters só é atribuído ao cluster aberto no contexto; sem contexto vira pendência", () => {
    const duplo: CorpusClustersVoz = {
      ...corpus,
      clusters: corpus.clusters.map((cl) =>
        cl.id === "ANEMIA"
          ? { ...cl, itens: [...cl.itens, { id: "hidr-anemia", nome: "Hidratação", chaveMatriz: null, termos: ["hidratacao"] }] }
          : cl),
    };
    const semContexto = interpretarFrase("Vou pedir hidratação.", duplo);
    expect(semContexto).toHaveLength(1);
    expect(um0(semContexto).intencao).toBe("NENHUMA");
    expect(um0(semContexto).pendencias[0]).toContain("item ambíguo");

    const comContexto = interpretarFrase("Vou pedir hidratação.", duplo, { clustersAbertos: ["DIARREIA"] });
    expect(comContexto).toHaveLength(1);
    expect(um0(comContexto).cluster).toBe("DIARREIA");
    expect(idsMarcados(um0(comContexto))).toEqual(["hidratacao"]);
  });

  it("determinismo: mesma entrada, mesma saída", () => {
    const frase = "Tem anemia, vou pedir ferritina e B12. Não tem neutropenia.";
    expect(JSON.stringify(interpretarFrase(frase, corpus))).toBe(JSON.stringify(interpretarFrase(frase, corpus)));
  });

  it("não muta o corpus de entrada", () => {
    const antes = JSON.stringify(corpus);
    interpretarFrase("Vou pedir ferritina, tem anemia e exame de imagem.", corpus, { clustersAbertos: ["ANEMIA"] });
    expect(JSON.stringify(corpus)).toBe(antes);
  });

  it("entrada que não é texto falha de forma explícita", () => {
    expect(() => interpretarFrase(42 as unknown as string, corpus)).toThrow(TypeError);
  });

  it("gatilhos de ordem: vou pedir / vou solicitar / renovar", () => {
    const tc = um("Vou pedir uma tomografia pra senhora.");
    expect(tc.intencao).toBe("ORDEM");
    expect(tc.cluster).toBe("IMAGEM");
    expect(idsMarcados(tc)).toEqual(["tc"]);

    const fer = um("Tá na hora de renovar a ferritina.");
    expect(fer.intencao).toBe("ORDEM");
    expect(fer.cluster).toBe("ANEMIA");
    expect(idsMarcados(fer)).toEqual(["ferritina"]);
    expect(idsMarcados(um("Ta na hora de renovar a ferritina."))).toEqual(["ferritina"]);

    const b = um("Vou solicitar b12 e acido folico.");
    expect(b.intencao).toBe("ORDEM");
    expect(idsMarcados(b)).toEqual(["b12", "folato"]);
  });

  it("itens do pack de anemia têm id próprio; IST não se confunde com transferrina nem ferro sérico", () => {
    expect(idsMarcados(um("Vou pedir IST."))).toEqual(["ist"]);
    expect(idsMarcados(um("Vou pedir tsat."))).toEqual(["ist"]);
    expect(idsMarcados(um("Vou pedir saturação de transferrina."))).toEqual(["ist"]);
    expect(idsMarcados(um("Vou pedir transferrina."))).toEqual(["transferrina"]);
    expect(idsMarcados(um("Vou pedir ferro sérico."))).toEqual(["ferro-serico"]);
    expect(idsMarcados(um("Vou pedir PSOF, ureia e creatinina, EDA e colono."))).toEqual(["sangue-oculto", "funcao-renal", "eda", "colonoscopia"]);
    expect(idsMarcados(um("Vou pedir pesquisa de sangue oculto e endoscopia."))).toEqual(["sangue-oculto", "eda"]);
  });

  it("pack de anemia em ordem marca todos os itens do pack como DRAFT; descrição ou negação não marcam", () => {
    const todos = ["transferrina", "ist", "ferritina", "ferro-serico", "sangue-oculto", "funcao-renal", "b12", "folato", "eda", "colonoscopia"];
    for (const frase of ["Vou pedir o pack de anemia.", "Vou solicitar o pacote de anemia.", "Tá na hora de renovar os exames de anemia."]) {
      const r = um(frase);
      expect(r.intencao).toBe("ORDEM");
      expect(idsMarcados(r)).toEqual(todos);
      expect(r.itensMarcados.every((i) => i.status === "DRAFT")).toBe(true);
    }
    expect(um("A paciente está com anemia.").itensMarcados).toEqual([]);
    expect(um("Não vou pedir o pack de anemia.").itensMarcados).toEqual([]);
  });

  it("ferro isolado não é termo de item (sem dedução de tratamento)", () => {
    const termos = corpus.clusters.flatMap((c) => c.itens.flatMap((i) => i.termos));
    expect(termos).not.toContain("ferro");
  });
});
