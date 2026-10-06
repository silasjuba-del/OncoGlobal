// KIMI-13 · G-27 · SAIDA_EXTERNA_LIMPA (PLANO Parte 0 §0.5; N25; MATRIZ docs/w5/MATRIZ.md).
// Regra: qualquer artefato a caminho de serviço externo (Genspark, pesquisa, LLM) passa por
// FN-24 + limpeza de metadados/DICOM/pixels; com risco residual ⇒ HALTED da saída (trabalho
// local segue). N25: PDF com metadado de autor/paciente a caminho do Genspark ⇒ HALTED.
// ESTADO: SEM_IMPLEMENTACAO — SanitizationReport (C-21) é só schema; não há sanitizador de
// PDF/DICOM/pixel nem gate de saída (MATRIZ G-27). Dono provável: kernel/llm (Claude) + harness.
// Severidade: latentemente S0 (INV-12/PHI) — mitigado hoje porque TODA saída externa é recusada
// em src/server/autorizacao.ts (CANAL_EXTERNO_NAO_HABILITADO / DESTINO_NAO_PERMITIDO); vira S0
// explícito no dia em que qualquer saída for habilitada sem o sanitizador.
import { describe, expect, it } from "vitest";

interface VereditoLike { gate?: string; decisao?: string; motivo?: string }

async function gateG27(): Promise<((input: unknown) => VereditoLike) | null> {
  const mod = (await import("../../src/kernel/harness/gates.js")) as Record<string, unknown>;
  const fn = mod["g27SaidaExternaLimpa"] ?? mod["g27"] ?? mod["saidaExternaLimpa"];
  return typeof fn === "function" ? (fn as (input: unknown) => VereditoLike) : null;
}

async function sanitizador(): Promise<((input: unknown) => unknown) | null> {
  const mod = (await import("../../src/kernel/llm/desidentificar.js")) as Record<string, unknown>;
  const fn = mod["sanitizarArtefato"] ?? mod["sanitizar"] ?? mod["limparMetadados"];
  return typeof fn === "function" ? (fn as (input: unknown) => unknown) : null;
}

describe("G-27 / N25 · saída externa limpa (sanitizador + gate HALTED)", () => {
  it("G-27 · SEM_IMPLEMENTACAO: sanitizador de artefato existe em src/kernel/llm", async () => {
    expect(await sanitizador(),
      "G-27 não implementado: SanitizationReport é só schema; não existe função que remova " +
      "metadado de autor/paciente de PDF/DICOM/pixel antes de qualquer saída (MATRIZ G-27)").not.toBeNull();
  });

  it("G-27 · SEM_IMPLEMENTACAO: gate de saída externa limpa existe no harness", async () => {
    expect(await gateG27(),
      "G-27 não implementado: nenhum gate avalia SanitizationReport antes de autorizar saída; " +
      "N25 (PDF com metadado ⇒ HALTED) não tem enforcement").not.toBeNull();
  });

  it("N25 · positivo: PDF com metadado de autor/paciente a caminho de serviço externo ⇒ HALTED da saída", async () => {
    const g27 = await gateG27();
    if (!g27) return;
    const v = g27({ artefato: { tipo: "PDF", metadados: { autor: "Paciente Teste 01" } },
      destino: "genspark", sanitizationReport: { riscoResidual: "ALTO" } });
    expect(v.decisao).toBe("BLOQUEIA_SAIDA");
    expect(v.gate).toBe("G-27");
  });

  it("G-27 · negativo: artefato sanitizado (risco BAIXO) com relatório válido passa", async () => {
    const g27 = await gateG27();
    if (!g27) return;
    expect(g27({ artefato: { tipo: "PDF", metadados: {} }, destino: "genspark",
      sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: "1.0.0" } }).decisao).toBe("PASSA");
  });

  it("G-27 · negativo: saída sem relatório de sanitização ⇒ PENDENTE/HALTED, nunca PASSA", async () => {
    const g27 = await gateG27();
    if (!g27) return;
    expect(g27({ artefato: { tipo: "PDF" }, destino: "genspark", sanitizationReport: null }).decisao)
      .not.toBe("PASSA");
  });
});
