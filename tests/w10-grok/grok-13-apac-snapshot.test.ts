// GROK-13 · emissão APAC persistível e alinhamento estrutural da projeção.
import { describe, expect, it } from "vitest";
import { validarCns } from "../../src/modules/apac/cns.js";
import {
  avaliarAdiantamento,
  avaliarCnes,
  classificarFinalidade,
  lerTabelaEmissao,
  validarEmissaoPersistida,
  type PacienteEmissao,
  type TabelaEmissao,
} from "../../src/modules/apac/emissao.js";
import { alinharSnapshotProjecao } from "../../src/modules/consulta/alinharSnapshot.js";

const TABELA = lerTabelaEmissao();

function paciente(parcial: Partial<PacienteEmissao> & Pick<PacienteEmissao, "apacId" | "pacienteId">): PacienteEmissao {
  return {
    competencia: "2026-10",
    cid: "C50",
    esquema: "ESQ",
    estado: "RASCUNHO",
    artefato: "PRONTO",
    modalidadeFaturamento: "APAC",
    motivoBloqueio: null,
    dataEmissao: "2026-10-02",
    referencia: "2026-10-02",
    modalidade: "QT",
    finalidadeEscolhida: "Adjuvante",
    intencao: null,
    cns: "700000000000005",
    cnesInformado: "1234567",
    ...parcial,
  };
}

function emitir(pacientes: PacienteEmissao[], cnesConfigurado: string | null = "1234567", tabela: TabelaEmissao = TABELA) {
  return validarEmissaoPersistida({
    batchId: "lote-13",
    geradoEm: "2026-10-02T15:00:00-03:00",
    criterio: { competencia: null, cid: null, esquema: null, estado: null },
    cnesConfigurado,
    pacientes,
  }, tabela);
}

describe("GROK-13 CNS e-SUS", () => {
  it("provisório com DV válido não prova identidade", () => {
    const r = validarCns("700.0000.0000.000-5");
    expect(r).toEqual({ valido: true, tipo: "PROVISORIO", aviso: "DV_VALIDO_NAO_PROVA_IDENTIDADE" });
  });

  it("DV errado, prefixo fora e formato incompleto não passam", () => {
    expect(validarCns("700000000000004")).toEqual({ valido: false, motivo: "DV" });
    expect(validarCns("300000000000000")).toEqual({ valido: false, motivo: "PREFIXO" });
    expect(validarCns("12345678901234X")).toEqual({ valido: false, motivo: "FORMATO" });
  });

  it("definitivo com resto 10 usa o ramo 001", () => {
    expect(validarCns("100000000060018")).toEqual({
      valido: true,
      tipo: "DEFINITIVO",
      aviso: "DV_VALIDO_NAO_PROVA_IDENTIDADE",
    });
    expect(validarCns("100000000060008")).toEqual({ valido: false, motivo: "DV" });
  });
});

describe("GROK-13 finalidade, CNES e fuso", () => {
  it("a tabela traz o fuso −03:00, o aviso de 1 dia e as listas D-W9-12", () => {
    expect(TABELA.fusoOffsetMinutos).toBe(-180);
    expect(TABELA.avisoAdiantadoDias).toBe(1);
    expect(TABELA.finalidades.QT).toContain("Para Controle Temporário");
    expect(TABELA.finalidades.QT).toContain("Curativa");
    expect(TABELA.finalidades.RT).toContain("Anti-hemorrágica");
  });

  it("intenção não preenche finalidade ausente e código desconhecido não é mapeado", () => {
    const ausente = classificarFinalidade("QT", null, "Paliativa", TABELA.finalidades);
    expect(ausente.estado).toBe("PENDENTE");
    expect(ausente.finalidade).toBeNull();
    expect(ausente.motivo).toContain("D-W9-12");
    expect(classificarFinalidade("QT", "PREVIA", null, TABELA.finalidades).estado).toBe("RECUSADA");
    expect(classificarFinalidade("QT", "Radical", null, TABELA.finalidades).estado).toBe("RECUSADA");
    expect(classificarFinalidade("RT", "Anti-hemorrágica", "curativa", TABELA.finalidades).finalidade)
      .toBe("Anti-hemorrágica");
  });

  it("lista injetada troca a finalidade aceita", () => {
    const lista = { QT: ["Experimental"], RT: ["Radical"] };
    expect(classificarFinalidade("QT", "Experimental", null, lista).estado).toBe("OK");
    expect(classificarFinalidade("QT", "Adjuvante", null, lista).estado).toBe("RECUSADA");
  });

  it("CNES ausente fica pendente e outro número de 7 dígitos vale se for o configurado", () => {
    expect(avaliarCnes(null, "2605473").estado).toBe("PENDENTE");
    expect(avaliarCnes("7654321", null).motivo).toContain("não configurado");
    expect(avaliarCnes("7654321", "7654321").cnes).toBe("7654321");
    expect(avaliarCnes("2605473", "7654321").estado).toBe("BLOQUEADO");
    expect(avaliarCnes("12.345-67", "1234567").estado).toBe("OK");
  });

  it("1 dia civil no fuso −03:00 avisa; 0 não avisa; 2 não entra no aviso; data ausente não vira zero", () => {
    const um = avaliarAdiantamento("2026-10-02T00:30:00-03:00", "2026-10-02T02:30:00Z", -180, 1);
    expect(um.estado).toBe("AVISO");
    expect(um.dias).toBe(1);
    expect(um.aviso).toBe(true);

    const zero = avaliarAdiantamento("2026-10-02T00:30:00-03:00", "2026-10-02T03:30:00Z", -180, 1);
    expect(zero.estado).toBe("OK");
    expect(zero.dias).toBe(0);
    expect(zero.aviso).toBe(false);

    const dois = avaliarAdiantamento("2026-10-03", "2026-10-01", -180, 1);
    expect(dois.estado).toBe("FORA");
    expect(dois.aviso).toBe(false);
    expect(dois.dias).toBe(2);

    const ausente = avaliarAdiantamento(null, "2026-10-02", -180, 1);
    expect(ausente.estado).toBe("PENDENTE");
    expect(ausente.dias).toBeNull();

    const outroFuso = avaliarAdiantamento("2026-10-02T02:30:00Z", "2026-10-01", 0, 1);
    expect(outroFuso.dias).toBe(1);
    expect(avaliarAdiantamento("2026-10-02T02:30:00Z", "2026-10-01", -180, 1).dias).toBe(0);
  });
});

describe("GROK-13 lote persistível", () => {
  it("vários pacientes na mesma competência formam um registro pronto, sem gravar ledger", () => {
    const r = emitir([
      paciente({ apacId: "apac-a", pacienteId: "p1" }),
      paciente({ apacId: "apac-b", pacienteId: "p2", finalidadeEscolhida: "paliativa" }),
    ]);
    expect(r.incluidos).toEqual(["apac-a", "apac-b"]);
    expect(r.competenciaLote).toBe("2026-10");
    expect(r.documento).toBe("PRONTO");
    expect(r.consultaSegue).toBe(true);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.trava).toBe(false);
    expect(r.gravadoNoLedger).toBe(false);
    expect(r.itens[1]?.finalidade).toBe("Paliativa");
    expect(r.fatosPersistiveis.some((fato) => fato.includes("competência 2026-10"))).toBe(true);
  });

  it("outra competência continua nomeada e não derruba quem ficou no lote", () => {
    const r = emitir([
      paciente({ apacId: "apac-a", pacienteId: "p1" }),
      paciente({ apacId: "apac-b", pacienteId: "p2", competencia: "2026-11" }),
    ]);
    expect(r.incluidos).toEqual(["apac-a"]);
    expect(r.excluidos[0]?.motivo).toContain("outra competência (2026-11)");
    expect(r.documento).toBe("PRONTO");
    expect(r.itens[1]?.documento).toBe("EXCLUIDO");
  });

  it("aviso de 1 dia não bloqueia a consulta nem apaga CNS pendente", () => {
    const r = emitir([
      paciente({
        apacId: "apac-a",
        pacienteId: "p1",
        dataEmissao: "2026-10-02T00:30:00-03:00",
        referencia: "2026-10-02T02:30:00Z",
        cns: null,
        intencao: "curativa",
      }),
    ]);
    const item = r.itens[0];
    expect(item?.documento).toBe("PENDENTE");
    expect(item?.alertas.some((alerta) => alerta.codigo === "ADIANTAMENTO")).toBe(true);
    expect(item?.pendencias.some((pendencia) => pendencia.codigo === "CNS")).toBe(true);
    expect(item?.finalidade).toBe("Adjuvante");
    expect(item?.intencaoIgnorada).toBe("curativa");
    expect(r.consultaSegue).toBe(true);
    expect(r.bloqueiaSalvar).toBe(false);
  });

  it("CNS inválido bloqueia o documento e a consulta segue", () => {
    const r = emitir([paciente({ apacId: "apac-a", pacienteId: "p1", cns: "700000000000004" })]);
    expect(r.documento).toBe("BLOQUEADO");
    expect(r.consultaSegue).toBe(true);
    expect(r.itens[0]?.conflitos.some((conflito) => conflito.texto.includes("DV"))).toBe(true);
  });

  it("adiantamento acima de 1 dia não passa como aviso", () => {
    const r = emitir([
      paciente({ apacId: "apac-a", pacienteId: "p1", dataEmissao: "2026-10-04", referencia: "2026-10-02" }),
    ]);
    expect(r.documento).toBe("BLOQUEADO");
    expect(r.itens[0]?.alertas.some((alerta) => alerta.codigo === "ADIANTAMENTO")).toBe(false);
    expect(r.itens[0]?.conflitos[0]?.texto).toContain("D-W5-02");
  });
});

describe("GROK-13 snapshot", () => {
  it("projeção CONFIRMED vira fato e ausente rotulado de verde continua pendente", () => {
    const r = alinharSnapshotProjecao({
      kind: "CONFIRMED",
      patientId: "p1",
      tumorLotId: "lot-1",
      encounterId: "enc-1",
      projectionVersion: "w10",
      contentHash: "abc",
      campos: {
        estadio: { valor: "cT2", eventIds: ["e1"], estado: "VERDE" },
        peso: { valor: null, eventIds: ["e2"], estado: "VERDE" },
        sitio: { valor: "", eventIds: [], estado: "PENDENTE" },
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.kind).toBe("CONFIRMED");
    expect(r.snapshot.contentHash).toBe("abc");
    expect(r.snapshot.fatos).toEqual([{ campo: "estadio", valor: "cT2", estado: "VERDE", eventIds: ["e1"] }]);
    expect(r.snapshot.pendencias.map((item) => item.campo)).toEqual(["peso", "sitio"]);
    expect(r.snapshot.fatos.some((fato) => fato.valor === "")).toBe(false);
  });

  it("conflito permanece e proposta não vira fato", () => {
    const r = alinharSnapshotProjecao({
      kind: "CONFIRMED",
      patientId: "p1",
      tumorLotId: null,
      encounterId: "enc-1",
      projectionVersion: "w10",
      contentHash: "def",
      campos: {
        cid: {
          valor: null,
          eventIds: ["e1", "e2"],
          estado: "VERMELHO",
          candidatos: [
            { valor: "C50", eventId: "e1" },
            { valor: "C34", eventId: "e2" },
          ],
        },
        dose: {
          valor: "80mg",
          eventIds: ["e3"],
          estado: "VERDE",
          proposta: { valor: "100mg", sourceId: "ia-1" },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.conflitos[0]?.candidatos).toHaveLength(2);
    expect(r.snapshot.fatos.map((fato) => fato.valor)).toEqual(["80mg"]);
    expect(r.snapshot.propostasIgnoradas).toEqual([{ campo: "dose", sourceId: "ia-1" }]);
  });

  it("CURRENT não produz snapshot confirmado", () => {
    const r = alinharSnapshotProjecao({
      kind: "CURRENT",
      patientId: "p1",
      tumorLotId: null,
      encounterId: "enc-1",
      projectionVersion: "w10",
      contentHash: "ghi",
      campos: {
        nota: { valor: "rascunho", eventIds: [], estado: "PENDENTE", proposta: { valor: "texto", sourceId: "ia" } },
      },
    });
    expect(r).toEqual({
      ok: false,
      codigo: "CURRENT",
      motivo: "snapshot CURRENT não vira fato confirmado",
    });
  });
});
