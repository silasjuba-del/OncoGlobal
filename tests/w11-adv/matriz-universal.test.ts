// W11-H17 · matriz universal canônica (PLN-012): carga, validação, subconjunto do cluster e item manual OUTROS [+].
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adicionarOutro, lerMatrizUniversal, subconjunto, validarMatrizUniversal, type MatrizUniversal } from "../../src/rules/matrizUniversal.js";

const ler = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
const bruto = ler("../../corpus/matriz/matriz-universal.v1.json");
const matriz: MatrizUniversal = lerMatrizUniversal(bruto);

const um = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error("nó ausente na matriz de teste");
  return v;
};
type Nó = { id: string; outros: boolean; [k: string]: unknown };
const niveis = (no: Nó): Nó[] => ["classes", "secoes", "topicos"].flatMap((k) => (no[k] as Nó[] | undefined) ?? []);
const todosNos = (): Nó[] => {
  const saida: Nó[] = [];
  const percorre = (nos: Nó[]): void => { for (const n of nos) { saida.push(n); percorre(niveis(n)); } };
  percorre(matriz.categorias as unknown as Nó[]);
  return saida;
};

describe("matriz universal canônica (PLN-012)", () => {
  it("carrega e valida o corpus", () => {
    expect(validarMatrizUniversal(bruto).ok).toBe(true);
    expect(matriz.status).toBe("RASCUNHO");
    expect(matriz.consumivel).toBe(false);
  });

  it("tem exatamente 8 categorias na ordem do texto", () => {
    expect(matriz.categorias).toHaveLength(8);
    expect(matriz.categorias.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(matriz.categorias.map((c) => c.nome)).toEqual([
      "PROBLEMA / EVENTO", "PRIORIDADE", "INVESTIGAÇÃO", "TRATAMENTO",
      "ENCAMINHAMENTO", "SUPORTE / SEGURANÇA", "RETORNO", "SAÍDA / DOCUMENTO",
    ]);
  });

  it("todo nível (categoria, classe, seção, tópico) tem OUTROS", () => {
    const nos = todosNos();
    expect(nos.length).toBeGreaterThan(100);
    for (const no of nos) expect(no.outros, `nó ${no.id} sem outros`).toBe(true);
  });

  it("prioridade tem os 4 níveis Eletiva, Prioritária, Urgente, Emergência", () => {
    const prioridade = matriz.categorias.find((c) => c.numero === 2);
    expect(prioridade?.classes.map((c) => c.nome)).toEqual(["Eletiva", "Prioritária", "Urgente", "Emergência"]);
  });

  it("eixo e verbo de cada categoria seguem PLN-014 e PLN-016", () => {
    const eixos = Object.fromEntries(matriz.categorias.map((c) => [c.numero, [c.eixo, c.verbo]]));
    expect(eixos[1]).toEqual(["Y", null]);
    expect(eixos[2]).toEqual(["Y", null]);
    expect(eixos[3]).toEqual(["Z", "INVESTIGAR"]);
    expect(eixos[4]).toEqual(["Z", "TRATAR"]);
    expect(eixos[5]).toEqual(["Z", "ENCAMINHAR"]);
    expect(eixos[7]).toEqual(["Z", "SEGUIR"]);
    expect(eixos[8]).toEqual(["Z", null]);
    expect(matriz.categorias.find((c) => c.numero === 8)?.natureza).toBe("ARTEFATO");
  });

  it("subconjunto seleciona só o caminho pertinente e não muta a original", () => {
    const antes = JSON.stringify(matriz);
    const recorte = subconjunto(matriz, ["investigacao/lab"]);
    expect(JSON.stringify(matriz)).toBe(antes);
    expect(recorte.categorias.map((c) => c.id)).toEqual(["investigacao"]);
    expect(um(recorte.categorias[0]).classes.map((c) => c.id)).toEqual(["lab"]);
    expect(um(um(recorte.categorias[0]).classes[0]).secoes.length).toBeGreaterThan(0);
    expect(validarMatrizUniversal(recorte).ok).toBe(false);
  });

  it("subconjunto por chave de seção mantém só essa seção", () => {
    const recorte = subconjunto(matriz, ["investigacao/rad/rm"]);
    expect(um(um(recorte.categorias[0]).classes[0]).secoes.map((s) => s.id)).toEqual(["rm"]);
  });

  it("item manual é marcado MANUAL e não altera o canônico", () => {
    const antes = JSON.stringify(matriz);
    const com = adicionarOutro(matriz, ["investigacao", "lab"], "  Vitamina D  ");
    expect(JSON.stringify(matriz)).toBe(antes);
    const lab = um(um(com.categorias[2]).classes[0]);
    const labOriginal = um(um(matriz.categorias[2]).classes[0]);
    expect(lab.manuais).toEqual([{ nome: "Vitamina D", origem: "MANUAL" }]);
    expect(lab.secoes).toEqual(labOriginal.secoes);
    expect(lab.nome).toBe(labOriginal.nome);
  });

  it("rejeita item manual em caminho inexistente ou texto vazio", () => {
    expect(() => adicionarOutro(matriz, ["inexistente"], "x")).toThrow();
    expect(() => adicionarOutro(matriz, ["investigacao", "lab"], "   ")).toThrow();
  });

  it("rejeita matriz com nível sem outros", () => {
    const sem = structuredClone(bruto) as { categorias: { classes: { outros?: boolean }[] }[] };
    delete um(sem.categorias[2]?.classes[0]).outros;
    const r = validarMatrizUniversal(sem);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(" ")).toContain("outros");
    expect(() => lerMatrizUniversal(sem)).toThrow();
  });

  it("rejeita matriz com menos de 8 categorias", () => {
    const curta = structuredClone(bruto) as { categorias: unknown[] };
    curta.categorias = curta.categorias.slice(0, 7);
    expect(validarMatrizUniversal(curta).ok).toBe(false);
  });
});
