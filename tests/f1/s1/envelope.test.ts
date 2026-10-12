import { describe, expect, it } from "vitest";
import { validarPayloadEvento } from "../../../src/contracts/envelope.js";

describe("F1-S1 registro do payload", () => {
  it("recusa tipo e versão desconhecidos sem incluir conteúdo no diagnóstico", () => {
    const r = validarPayloadEvento("Paciente@99", { nome: "segredo-sintetico" });
    expect(r).toMatchObject({ ok: false, motivo: "VERSAO_DESCONHECIDA" });
    expect(JSON.stringify(r)).not.toContain("segredo-sintetico");
    expect(validarPayloadEvento("NOVA_REGRA", {})).toMatchObject({ ok: false, motivo: "TIPO_DESCONHECIDO" });
  });
  it("não aceita envelope válido como prova de payload clínico válido", () => {
    expect(validarPayloadEvento("LabResult", { campo: "creatinina", valor: "alto" })).toMatchObject({ ok: false });
    expect(validarPayloadEvento("FATO@1", { campo: "alergias", valor: ["substancia-sintetica"] })).toEqual({ ok: true, schema: "FATO@1" });
  });
  it("schema legado conhecido recebe versão 1 explícita", () => {
    expect(validarPayloadEvento("LabResult", { campo: "cr", valor: 1.1, unidade: "mg/dL", data: "2026-10-12", sourceId: "source-1" }))
      .toEqual({ ok: true, schema: "LabResult@1" });
  });
});
