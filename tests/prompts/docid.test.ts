// W8/GLM-13 · DOCID@1.0.0: classificação de página, identificador com rótulo×valor separados e datas separadas (caso real 01, I1–I5 e T1).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const prompt = readFileSync(fileURLToPath(new URL("../../corpus/prompts/DOCID@1.0.0.md", import.meta.url)), "utf8");

describe("DOCID@1.0.0 (W8/GLM-13)", () => {
  it("classifica a página em exatamente as 5 classes do caso real 01", () => {
    for (const classe of ["FICHA_ADMIN", "LAUDO_PRIMARIO", "RESUMO_SECUNDARIO", "DOC_PESSOAL", "COMPROVANTE_TERCEIRO"])
      expect(prompt).toContain(classe);
    expect(prompt).toContain("uma classe por página");
    expect(prompt).toContain("corrobora ou conflita com o primário; nunca o substitui");
  });

  it("identificadores com rótulo e valor separados; tipo NUNCA decidido pelo rótulo (I1/I2)", () => {
    expect(prompt).toContain("identificadores[] { rotulo, valor }");
    expect(prompt).toContain("Nunca decidir o tipo do identificador pelo rótulo");
    expect(prompt).toContain('"Cartão SUS" pode conter um CPF');
    expect(prompt).toContain('"Matrícula" pode conter o CNS');
    expect(prompt).toContain("tarefa de código com fonte");
    expect(prompt).toContain("ligar o identificador a paciente em silêncio");
  });

  it("comprovante de terceiro não liga paciente; assinatura pode ser de acompanhante; papéis médicos distintos (I3/I4/I5)", () => {
    expect(prompt).toContain("é dado do paciente; não liga paciente");
    expect(prompt).toContain("acompanhante");
    expect(prompt).toContain("solicitante do exame, médico assistente, médico que assina o laudo");
    expect(prompt).toContain("nunca os funde");
  });

  it("datas separadas em 4 tipos; só a data clínica alimenta a linha do tempo; idade nunca copiada (T1/T2)", () => {
    for (const tipo of ["dataClinica", "dataEmissao", "dataAssinaturaDigital", "dataExtracaoSistema"])
      expect(prompt).toContain(tipo);
    expect(prompt).toContain("a única que alimenta linha do tempo");
    expect(prompt).toContain("nunca intercambiáveis");
    expect(prompt).toContain("Idade impressa no laudo **nunca** é extraída como dado");
  });

  it("validação por valor fica fora do LLM; universal BASE §47 presente", () => {
    expect(prompt).toContain("nunca resolve token, completa dígito, formata, corrige ou valida dígito verificador");
    expect(prompt).toContain("identificadores.v1.json");
    for (const frase of ["não inventar", "null quando ausente", "desidentificada", "Saída só JSON", "não escolher entre fontes"])
      expect(prompt).toContain(frase);
  });
});
