import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { renderizarKit, type KitTemplate } from "../../src/impressao/kit.js";

it("D-W9-41 imprime a redação corrigida e conserva a frase original do PDF como proveniência", () => {
  const template = JSON.parse(readFileSync("corpus/templates/kit/sinais-alarme.v1.json", "utf8")) as KitTemplate;
  // Frase verificada independentemente no PDF, página 2, por extração local pypdf (L3, 2026-10-09).
  const fraseOriginal = "FEBRE >= 37,8°C OU CALAFRIOS";
  expect(template.fonte).toMatchObject({ referencia: "docs/referencias/kit-oncologia-2026-05.pdf", pagina: 2 });
  expect(template.textoFonteOriginal).toContain(fraseOriginal);
  const antes = template.textoFonteOriginal;
  const documento = renderizarKit(template, { cabecalho: { nomeInstituicao: "Instituição Teste", linha2: "", cidadeUf: "" },
    medico: { nome: "Médico Teste", crm: "CRM-TESTE" }, paciente: { nome: "Paciente Teste 92" } });
  expect(documento.html).toContain("FEBRE ACIMA DE 37,8°C OU CALAFRIOS");
  expect(documento.html).not.toContain("FEBRE &gt;= 37,8°C OU CALAFRIOS");
  expect(template.textoFonteOriginal).toBe(antes);
});
