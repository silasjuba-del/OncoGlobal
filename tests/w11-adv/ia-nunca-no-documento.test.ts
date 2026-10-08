// W11-H5 · Regra do Dr. Silas: "IA nunca aparece em nenhum documento".
// Renderiza TODOS os modelos de documento impresso com dados sintéticos e falha se o texto visível contiver
// qualquer termo de IA/algoritmo/origem automática. Também prova que documento não assinado segue com RASCUNHO.
// Escopo: src/impressao (kit + APAC) · src/modules/documentos (render) · corpus/templates/**.
// corpus/receitas não é impresso por nenhum renderizador (RASCUNHO, consumivel=false): fora deste escopo.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderizarKit, type EntradaKit, type KitTemplate } from "../../src/impressao/kit.js";
import { renderizarApacLaudo, type EntradaApac, type TemplateApac } from "../../src/impressao/apacLaudo.js";
import { renderizarDocumento, type EntradaRender, type TemplateDocumento } from "../../src/modules/documentos/render.js";

const RAIZ = process.cwd();
const lerJson = <T>(rel: string): T => JSON.parse(readFileSync(resolve(RAIZ, rel), "utf8")) as T;
const jsonsEm = (dir: string): string[] =>
  readdirSync(resolve(RAIZ, dir)).filter((f) => f.endsWith(".json")).sort().map((f) => `${dir}/${f}`);

// Termos proibidos (comparados sem acento e em minúsculas). " IA " e "IA:" entram pela fronteira \bia\b.
const TERMOS: readonly { termo: string; re: RegExp }[] = [
  { termo: "inteligencia artificial", re: /inteligencia artificial/ },
  { termo: "IA", re: /\bia\b/ },
  { termo: "algoritmo", re: /algoritmo/ },
  { termo: "gerado automaticamente", re: /gerado automaticamente/ },
  { termo: "sugere-se", re: /sugere-se/ },
  { termo: "sistema recomenda", re: /sistema recomenda/ },
  { termo: "modelo de linguagem", re: /modelo de linguagem/ },
  { termo: "LLM", re: /\bllm\b/ },
  { termo: "OncoAssist", re: /oncoassist/ },
  { termo: "ChatGPT", re: /chatgpt/ },
  { termo: "Claude", re: /\bclaude\b/ },
  { termo: "GPT", re: /\bgpt\b/ },
];

const normalizar = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** Texto que o leitor vê: sem CSS, sem tags, sem entidades. */
const textoVisivel = (html: string): string =>
  normalizar(html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " "));
const termosEm = (texto: string): string[] => TERMOS.filter(({ re }) => re.test(texto)).map(({ termo }) => termo);

// Dados sintéticos: nenhum nome real, nenhum identificador real.
const SINTETICO = {
  cabecalho: { nomeInstituicao: "Instituicao Exemplo Sintetica", linha2: "Linha de teste", cidadeUf: "Cidade Teste/UF", exemplo: true },
  medico: { nome: "Medico Sintetico", crm: "CRM-XX 000000", rqes: ["RQE 0000"] },
  paciente: { nome: "Paciente Sintetico Teste", nasc: "01/01/1900", cidade: "Cidade Teste", idade: "00", cpf: "000.000.000-00", cid: "X00" },
  dataImpressao: "01/01/2000",
};

interface Violacao { modelo: string; variante: string; termos: string[] }

function varianteKit(template: KitTemplate): Array<{ variante: string; entrada: EntradaKit }> {
  const itens = (template.itensReceita ?? []).map((x) => x.id);
  const exames = (template.exames ?? []).map((exame) => ({ exame, ciclos: [true, false, false, false] as const }));
  return [
    { variante: "preenchido-rascunho", entrada: { ...SINTETICO, itensSelecionados: itens, exames, datasCiclos: ["02/01/2000"],
      prazoAfastamento: "30 dias", dataInicioAfastamento: "03/01/2000", examesAdicionais: ["Exame sintetico"],
      alertasOperacionais: [], folhaOperacionalSalao: false } },
    { variante: "modelo-em-branco", entrada: { ...SINTETICO, modeloEmBranco: true } },
  ];
}

describe("W11-H5 · IA nunca aparece em nenhum documento", () => {
  it("kits impressos (corpus/templates/kit/*.json): nenhum termo de IA no texto visível", () => {
    const violacoes: Violacao[] = [];
    for (const rel of jsonsEm("corpus/templates/kit").filter((f) => !f.endsWith("apac-laudo.v1.json"))) {
      const template = lerJson<KitTemplate>(rel);
      for (const { variante, entrada } of varianteKit(template)) {
        const termos = termosEm(textoVisivel(renderizarKit(template, entrada).html));
        if (termos.length) violacoes.push({ modelo: rel, variante, termos });
      }
    }
    expect(violacoes).toEqual([]);
  });

  it("laudo APAC (corpus/templates/kit/apac-laudo.v1.json): nenhum termo de IA no texto visível", () => {
    const template = lerJson<TemplateApac>("corpus/templates/kit/apac-laudo.v1.json");
    const entradas: Array<{ variante: string; entrada: EntradaApac }> = [
      { variante: "preenchido-rascunho", entrada: { valores: { "cid-principal": "X00" }, modeloEmBranco: false } },
      { variante: "modelo-em-branco", entrada: { valores: {}, modeloEmBranco: true } },
    ];
    const violacoes: Violacao[] = [];
    for (const { variante, entrada } of entradas) {
      const termos = termosEm(textoVisivel(renderizarApacLaudo(template, entrada).html));
      if (termos.length) violacoes.push({ modelo: "corpus/templates/kit/apac-laudo.v1.json", variante, termos });
    }
    expect(violacoes).toEqual([]);
  });

  it("modelos raiz (corpus/templates/*.json) via renderizarDocumento: nenhum termo de IA nos títulos nem nos campos", () => {
    const violacoes: Violacao[] = [];
    for (const rel of jsonsEm("corpus/templates").filter((f) => !f.includes("/kit/"))) {
      const bruto = lerJson<{ id: string; versao: string; secoes: { id: string; titulo: string }[]; proibidoConter?: string[] }>(rel);
      const template: TemplateDocumento = {
        templateId: bruto.id, versao: bruto.versao,
        campos: bruto.secoes.map((s) => s.id),
        proibidoConter: bruto.proibidoConter ?? [],
      };
      const fatos: EntradaRender["fatos"] = bruto.secoes.map((s) => ({
        campo: s.id, valor: `Texto sintetico de ${s.titulo}`, revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO",
      }));
      const renderizado = renderizarDocumento({ template, fatos });
      const textoFinal = [...bruto.secoes.map((s) => s.titulo), ...Object.values(renderizado.campos)].join("\n");
      const termos = termosEm(normalizar(textoFinal));
      if (termos.length) violacoes.push({ modelo: rel, variante: "fatos-sinteticos", termos });
    }
    expect(violacoes).toEqual([]);
  });

  it("rascunho: kit e APAC não assinados seguem com a marca RASCUNHO", () => {
    const kit = renderizarKit(lerJson<KitTemplate>("corpus/templates/kit/orientacao-nutricional.v1.json"), SINTETICO);
    expect(kit.status).toBe("RASCUNHO");
    expect(kit.html).toContain("RASCUNHO — NÃO VÁLIDO");
    const apac = renderizarApacLaudo(lerJson<TemplateApac>("corpus/templates/kit/apac-laudo.v1.json"), { valores: {} });
    expect(apac.status).toBe("RASCUNHO");
    expect(apac.html).toContain("RASCUNHO — NÃO VÁLIDO");
  });
});
