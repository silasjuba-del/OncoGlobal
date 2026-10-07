import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const templates = ["orientacao-nutricional", "sinais-alarme", "receita-sintomaticos", "requisicao-exames-ciclos", "relatorio-pericial"];

describe("templates do kit clínico", () => {
  it("carrega cinco templates G-17 com proveniência DECISAO_MEDICA e aviso de acentuação separado", () => {
    for (const id of templates) {
      const t = JSON.parse(readFileSync(resolve(root, `corpus/templates/kit/${id}.v1.json`), "utf8"));
      expect(t.id).toBe(id);
      expect(t.header).toMatchObject({ id, versao: "1.0.0", vigenteDesde: "2026-10-05", aprovadoEm: "2026-10-05", curador: "Dr. Silas Negrão" });
      expect(t.header.fonte).toMatchObject({ tipo: "DECISAO_MEDICA", referencia: expect.stringContaining("ADENDO-W6-W7.md"), trecho: null, edicao: null });
      expect(t.fonte).toEqual({ tipo: "DECISAO_MEDICA", referencia: "docs/referencias/kit-oncologia-2026-05.pdf", pagina: templates.indexOf(id) + 1 });
      expect(t.verificacaoAcentuacao).toMatchObject({ necessaria: true, metadadoSomente: true });
      const text = JSON.stringify(t.secoes);
      expect(text).not.toContain("[VERIFICAR acentuacao]");
    }
  });

  it("mantém seleções de receita literais e campos do médico para afastamento", () => {
    const receita = JSON.parse(readFileSync(resolve(root, "corpus/templates/kit/receita-sintomaticos.v1.json"), "utf8"));
    expect(receita.selecao).toMatchObject({ selecionavelPeloMedico: true, doseLiteralSemCalculoOuAlteracao: true });
    expect(receita.itensReceita.length).toBeGreaterThan(0);
    const relatorio = JSON.parse(readFileSync(resolve(root, "corpus/templates/kit/relatorio-pericial.v1.json"), "utf8"));
    expect(relatorio.afastamento).toMatchObject({ prazo: expect.stringContaining("campo do médico"), dataInicio: "campo do médico" });
    const exames = JSON.parse(readFileSync(resolve(root, "corpus/templates/kit/requisicao-exames-ciclos.v1.json"), "utf8"));
    expect(exames.exames).toContain("HEMOGRAMA");
    expect(exames.gradeExames).toMatchObject({ ciclos: [1, 2, 3, 4], adicionaisLivres: true });
  });

  it("mapeia os rótulos APAC na ordem literal do TXT", () => {
    const txt = readFileSync(resolve(root, "docs/referencias/apac-laudo-campos.txt"), "utf8").split(/\r?\n/).filter(Boolean).map(x => x.trim());
    const apac = JSON.parse(readFileSync(resolve(root, "corpus/templates/kit/apac-laudo.v1.json"), "utf8"));
    expect(txt.every((line: string) => apac.textoFonteOriginal.includes(line))).toBe(true);
    const labels = apac.campos.map((x: { campo: string }) => x.campo);
    expect(labels).toContain("CID10 PRINCIPAL");
    expect(labels).toContain("CID10 SECUNDÁRIO");
    expect(labels).toContain("CNES");
    expect(labels).toContain("CEP"); expect(labels).toContain("UF"); expect(labels).toContain("CÓD. IBGE MUNICÍPIO");
  });
});
