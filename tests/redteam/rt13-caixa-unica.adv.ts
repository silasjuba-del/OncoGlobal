// RT-13 · Caixa única e conversão (S1/S2) — FALHAS reais.
// 1) PDF DIGITAL com camada de texto vira PENDENTE embora a dependência pdfjs-dist esteja
//    aprovada (D-W9-58) e instalada — D-W9-18 manda converter PDF digital localmente.
// 2) DOCX gravado em Latin-1 (encoding errado) vira PRONTO com texto mojibake: corrupção
//    silenciosa de dado clínico em vez de PENDENTE.
// Dono provável: src/leitura/caixa-unica.ts (equipe interna/W7) + extrator.
import { describe, expect, it } from "vitest";
import { converterEntradaLocal } from "../../src/leitura/caixa-unica.js";
import { montarDocxLatin1 } from "../fixtures/redteam/docx.js";

const leitura = (tipo: Parameters<typeof converterEntradaLocal>[0]["tipo"], conteudo: string | Uint8Array) =>
  converterEntradaLocal({ id: "doc-rt13-adv", tipo, conteudo, recebidoEm: "2030-01-01T09:00:00-03:00" });

describe("RT-13 · conversão local incompleta e encoding", () => {
  it("SEM_IMPLEMENTACAO: PDF digital com camada de texto é convertido localmente (pdfjs-dist)", async () => {
    const mod = (await import("../../src/leitura/caixa-unica.js")) as Record<string, unknown>;
    const fn = mod["converterPdfDigital"] ?? mod["converterPdf"] ?? mod["lerPdf"];
    expect(fn,
      "D-W9-18: 'PDF digital e Word convertidos localmente'; D-W9-58 aprovou pdfjs-dist (instalada " +
      "em package.json). Todo PDF vira PENDENTE 'sem conversor local aprovado' — o caixa única " +
      "descarta a camada de texto que o próprio PC tem. Falha de fluxo (S2) e desperdício de " +
      "revisão humana. Dono provável: src/leitura/caixa-unica.ts (W7/equipe interna).")
      .toBeTypeOf("function");
  });

  it("PROVA DE FALHA (S2): DOCX em Latin-1 vira PRONTO com mojibake (deveria ser PENDENTE)", () => {
    const saida = leitura("DOCX", montarDocxLatin1(["Creatinina sérica 1,4 mg/dL - estável"]));
    expect(saida.status,
      "DOCX é UTF-8 por especificação; um documento gravado em Latin-1 chega ao leitor, infla sem " +
      "erro e o texto sai com U+FFFD em cada caractere acentuado como PRONTO. Corrupção silenciosa " +
      "de dado clínico ('Creatinina s\uFFFDrica 1,4'). Deveria ser PENDENTE (ilegível) ou detectar encoding.")
      .toBe("PENDENTE");
  });
});
