import { describe, expect, it } from "vitest";
import { g27SaidaExternaLimpa } from "../../../src/kernel/harness/gates.js";
import { extrairMetadadosPdf, sanitizarArtefato } from "../../../src/kernel/llm/sanitizador.js";
import { sanitizarArtefato as viaDesidentificar } from "../../../src/kernel/llm/desidentificar.js";

const pdf = (extra = "") =>
  `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\n<< /Author (Paciente Teste 01) /Title <50616369656E7465> /Producer (Word \\(x\\)) /CreationDate (D:20261007) >>\nendobj\n` +
  `3 0 obj\n<?xpacket begin="" id="W5M0"?><x:xmpmeta><dc:creator>Paciente Teste 01</dc:creator></x:xmpmeta><?xpacket end="w"?>\nendobj\n${extra}trailer\n<< /Info 2 0 R >>\n%%EOF`;
const bytes = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const EM = "2026-10-07T10:00:00-03:00";

describe("G-27 · sanitizador de PDF", () => {
  it("também exportado por desidentificar.js (contrato do teste adversarial)", () => expect(viaDesidentificar).toBe(sanitizarArtefato));
  it("remove autor/título/produtor/XMP, preserva tamanho e emite relatório BAIXO", () => {
    const ent = bytes(pdf());
    expect(Object.keys(extrairMetadadosPdf(ent)).sort()).toEqual(["Author", "CreationDate", "Producer", "Title", "XMP"]);
    const r = sanitizarArtefato({ artefatoId: "a1", tipo: "PDF", bytes: ent, em: EM });
    expect(r.bytes!.length).toBe(ent.length);
    expect(Buffer.from(r.bytes!).toString("latin1")).not.toContain("Paciente Teste 01");
    expect(extrairMetadadosPdf(r.bytes!)).toEqual({});
    expect(r.report.riscoResidual).toBe("BAIXO");
    expect(r.report.removidos).toEqual(expect.arrayContaining(["Info/Author", "Info/Title", "XMP"]));
    expect(g27SaidaExternaLimpa({ artefato: { tipo: "PDF", metadados: extrairMetadadosPdf(r.bytes!) }, destino: "genspark", sanitizationReport: r.report }).decisao).toBe("PASSA");
  });
  it("risco ALTO: ObjStm, criptografado, não-PDF, bytes ausentes, tipos não suportados, PHI", () => {
    const alto = (x: Parameters<typeof sanitizarArtefato>[0]) => sanitizarArtefato({ em: EM, ...x }).report.riscoResidual;
    expect(alto({ artefatoId: "a", tipo: "PDF", bytes: bytes(pdf("<< /Type /ObjStm >>\n")) })).toBe("ALTO");
    expect(alto({ artefatoId: "a", tipo: "PDF", bytes: bytes(pdf("<< /Encrypt 9 0 R >>\n")) })).toBe("ALTO");
    expect(alto({ artefatoId: "a", tipo: "PDF", bytes: bytes("nao e pdf") })).toBe("ALTO");
    expect(alto({ artefatoId: "a", tipo: "PDF" })).toBe("ALTO");
    expect(alto({ artefatoId: "a", tipo: "DICOM", bytes: bytes("x") })).toBe("ALTO");
    expect(alto({ artefatoId: "a", tipo: "IMAGEM", bytes: bytes("x") })).toBe("ALTO");
    expect(alto({ artefatoId: "a", tipo: "PDF", bytes: bytes(pdf()), detectorPhi: () => true })).toBe("ALTO");
    expect(alto({ artefatoId: "a", tipo: "TEXTO", texto: "oi" })).toBe("ALTO"); // sem detector não há prova
    expect(alto({ artefatoId: "a", tipo: "TEXTO", texto: "oi", detectorPhi: () => false })).toBe("BAIXO");
  });
});

describe("G-27 · gate de saída externa", () => {
  const ok = { riscoResidual: "BAIXO", versaoSanitizador: "1.0.0" };
  const art = { tipo: "PDF", metadados: {} };
  it("sem relatório / relatório inválido / risco ALTO / metadado presente ⇒ BLOQUEIA_SAIDA", () => {
    for (const entrada of [
      { artefato: art, destino: "g", sanitizationReport: null },
      { artefato: art, destino: "g" },
      { artefato: art, destino: "g", sanitizationReport: { riscoResidual: "ALTO", versaoSanitizador: "1" } },
      { artefato: art, destino: "g", sanitizationReport: { riscoResidual: "baixo", versaoSanitizador: "1" } },
      { artefato: art, destino: "g", sanitizationReport: { riscoResidual: "BAIXO" } },
      { artefato: art, destino: "g", sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: " " } },
      { artefato: { tipo: "PDF", metadados: { autor: "Paciente Teste 01" } }, destino: "g", sanitizationReport: ok },
      { artefato: art, destino: "", sanitizationReport: ok },
      { artefato: art, sanitizationReport: ok },
      { destino: "g", sanitizationReport: ok },
      undefined as never,
    ]) expect(g27SaidaExternaLimpa(entrada).decisao).toBe("BLOQUEIA_SAIDA");
  });
  it("metadado vazio/NAO_INFORMADO não bloqueia; limpo passa", () =>
    expect(g27SaidaExternaLimpa({ artefato: { tipo: "PDF", metadados: { autor: "", titulo: "NAO_INFORMADO" } }, destino: "g", sanitizationReport: ok }).decisao).toBe("PASSA"));
});
