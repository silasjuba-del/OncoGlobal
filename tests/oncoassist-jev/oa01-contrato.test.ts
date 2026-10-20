import { describe, expect, it } from "vitest";
import {
  CodigoRespostaOncoassist, RespostaOncoassist,
  classificarCapacidade, classificarFontes, mensagemCapacidade, mensagemResultadoTecnico, rotuloCategoria,
} from "../../src/contracts/api/oncoassist.js";

describe("OA-01 — contrato OncoAssist e estados operacionais", () => {
  it("capacidade distingue configuração ausente de pendência do provedor", () => {
    expect(classificarCapacidade(null, false)).toBe("CONFIGURACAO");
    expect(classificarCapacidade({ status: "PENDENTE", motivo: "DESABILITADO" }, true)).toBe("CAPACIDADE_PENDENTE");
    expect(mensagemCapacidade("CAPACIDADE_PENDENTE", "CHAVE_AUSENTE")).toMatch(/credencial local/);
    expect(mensagemCapacidade("CAPACIDADE_PENDENTE", undefined)).toMatch(/motivo não informado/);
    expect(classificarCapacidade({ status: "DISPONIVEL" }, true)).toBe("PRONTO");
  });

  it("fontes vazias distinguem ausência de vínculo pendente", () => {
    expect(classificarFontes([], [])).toBe("FONTE_AUSENTE");
    expect(classificarFontes([], [{ draftId: "d", sourceId: "s", segmentId: null, exceptionId: "e",
      rotulo: "Trecho", criadoEm: "2026-10-07", revision: 0, textoOriginal: "" }])).toBe("VINCULO_PENDENTE");
    expect(mensagemCapacidade("VINCULO_PENDENTE")).toMatch(/vínculo/);
  });

  it.each(CodigoRespostaOncoassist.options)("%s tem mensagem operacional sem expor segredo", (codigo) => {
    const resposta = RespostaOncoassist.parse({ status: codigo === "DESABILITADO" || codigo === "CHAVE_AUSENTE" || codigo === "DICIONARIO_AUSENTE" || codigo === "SEM_MARCADORES" ? "PENDENTE" : "ERRO", codigo });
    const texto = mensagemResultadoTecnico(resposta);
    expect(texto).toBeTruthy();
    expect(texto).not.toMatch(/api[_-]?key|typesafe|jev-|token|secret/i);
    expect(rotuloCategoria(resposta)).toBeNull();
  });

  it("categoria só aparece com proposta válida", () => {
    const proposta = RespostaOncoassist.parse({
      status: "PROPOSTA", revisaoObrigatoria: true, categoria: "LAB",
      fonte: { id: "fonte-sintetica", sha256: "abc" },
    });
    expect(rotuloCategoria(proposta)).toBe("Laboratório");
    expect(mensagemResultadoTecnico(proposta)).toMatch(/sugestão para revisão/);
  });

  it("código legado desconhecido permanece no contrato com mensagem genérica", () => {
    const resposta = RespostaOncoassist.parse({ status: "PENDENTE", codigo: "ANTERIOR" });
    expect(mensagemResultadoTecnico(resposta)).toBe("Classificação pendente. O documento foi preservado.");
    expect(rotuloCategoria(resposta)).toBeNull();
  });
});
