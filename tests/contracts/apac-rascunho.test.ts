import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  ApacRascunhoConfirmadoSchema,
  ApacRascunhoPreparadoSchema,
  BaseApacRascunhoRespostaSchema,
  ConfirmarApacRascunhoPedidoSchema,
  EdicaoApacRascunhoSchema,
  PrepararApacRascunhoPedidoSchema,
} from "../../src/contracts/api/apacRascunho.js";
import { SaidasHttp } from "../../src/contracts/api/saidasHttp.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const contexto = { patientId: "paciente-sintetico-apac-07", encounterId: "encontro-sintetico-apac-07", tumorLotId: "lote-sintetico-apac-07" };
const hash = sha("ledger sintetico apac 07");

function edicao(overrides: Record<string, unknown> = {}) {
  return {
    competencia: "2026-10",
    campos: {
      procedimentoPrincipal: "PROC-SINTETICO-07",
      pacienteCns: null,
      nomeMae: null,
      nomeEstabelecimento: "Estabelecimento sintético",
      cnesSolicitante: null,
      solicitanteNome: null,
      solicitanteCns: null,
      justificativa: "Justificativa administrativa sintética.",
      descricaoDiagnostico: null,
      quantidadePrincipal: 1,
      pacienteNascimento: null,
      pacienteSexo: null,
    },
    ...overrides,
  };
}

function apac(overrides: Record<string, unknown> = {}) {
  return {
    apacId: "apac-sintetica-07",
    tumorLotId: contexto.tumorLotId,
    prescricaoAssinadaRef: { documentId: "documento-sintetico-07", documentVersion: 2 },
    dataGeracaoApp: "2026-10-20",
    competencia: "2026-10",
    campos: { cid: "C50.9", procedimentoPrincipal: "PROC-SINTETICO-07", qtEsquema: "Esquema sintético" },
    estado: "RASCUNHO",
    resultadoExterno: null,
    versao: 1,
    substituiApacId: null,
    ...overrides,
  };
}

function base(overrides: Record<string, unknown> = {}) {
  return {
    contexto,
    revisao: hash,
    prescricao: { documentId: "documento-sintetico-07", documentVersion: 2,
      protocoloId: "esquema-sintetico-07", dataPrevista: "2026-10-22" },
    sugestao: edicao(),
    camposClinicos: [{ chave: "cid", rotulo: "CID do lote", valor: "C50.9" },
      { chave: "nomePaciente", rotulo: "Paciente", valor: "Paciente sintético" }],
    existentes: [{ apacId: "apac-sintetica-anterior-07", versao: 1, competencia: "2026-09", estado: "RASCUNHO" }],
    pendencias: ["Procedimento depende de conferência local."],
    ...overrides,
  };
}

function preparado(overrides: Record<string, unknown> = {}) {
  return {
    contexto,
    draftId: "draft-apac-sintetico-07",
    revision: 0,
    conteudoHash: sha("conteudo apac preparado sintetico"),
    baseHash: hash,
    apac: apac(),
    texto: "APAC em rascunho para revisão médica.",
    pendencias: ["Falta conferir campo sintético."],
    avisos: ["Esta prévia não autoriza emissão."],
    permiteExportar: false,
    ...overrides,
  };
}

describe("contratos de APAC em rascunho Onda07", () => {
  it("aceita edição administrativa e resposta-base com fonte de prescrição ou fonte ausente", () => {
    expect(EdicaoApacRascunhoSchema.parse(edicao()).competencia).toBe("2026-10");
    expect(BaseApacRascunhoRespostaSchema.parse(base()).prescricao?.documentVersion).toBe(2);
    expect(BaseApacRascunhoRespostaSchema.parse(base({ prescricao: null })).prescricao).toBeNull();
  });

  it("mantém campos clínicos opcionais nulos e rejeita estados clínicos injetados pelo formulário", () => {
    expect(EdicaoApacRascunhoSchema.safeParse(edicao({ campos: {
      ...edicao().campos, pacienteCns: null, pacienteNascimento: null, pacienteSexo: null,
    } })).success).toBe(true);
    for (const campo of ["patientName", "cid", "finalidade", "qtEsquema", "prescricaoAssinadaRef",
      "estado", "resultadoExterno", "signature", "atorId"]) {
      const campos = { ...edicao().campos, [campo]: "valor sintético proibido" };
      expect(EdicaoApacRascunhoSchema.safeParse(edicao({ campos })).success, campo).toBe(false);
    }
    expect(EdicaoApacRascunhoSchema.safeParse({ ...edicao(), patientName: "Nome sintético" }).success).toBe(false);
  });

  it("rejeita competência inválida, quantidade não segura, data inválida e sexo fora do enum", () => {
    for (const competencia of ["2026-00", "2026-13", "26-10", "2026-1"])
      expect(EdicaoApacRascunhoSchema.safeParse(edicao({ competencia })).success).toBe(false);
    for (const quantidadePrincipal of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(EdicaoApacRascunhoSchema.safeParse(edicao({ campos: { ...edicao().campos, quantidadePrincipal } })).success).toBe(false);
    expect(EdicaoApacRascunhoSchema.safeParse(edicao({ campos: { ...edicao().campos, pacienteNascimento: "2026-02-30" } })).success).toBe(false);
    expect(EdicaoApacRascunhoSchema.safeParse(edicao({ campos: { ...edicao().campos, pacienteSexo: "X" } })).success).toBe(false);
  });

  it("valida SHA-256 e inteiros seguros nos pedidos de preparar e confirmar", () => {
    expect(PrepararApacRascunhoPedidoSchema.safeParse({ contexto, expectedBaseHash: hash,
      idempotencyKey: "apac-idempotencia-07", edicao: edicao() }).success).toBe(true);
    expect(PrepararApacRascunhoPedidoSchema.safeParse({ contexto, expectedBaseHash: "hash-curto",
      idempotencyKey: "apac-idempotencia-07", edicao: edicao() }).success).toBe(false);
    expect(ConfirmarApacRascunhoPedidoSchema.safeParse({ contexto, draftId: "draft-apac-sintetico-07",
      expectedRevision: Number.MAX_SAFE_INTEGER + 1, conteudoHash: hash, idempotencyKey: "confirmar-apac-07" }).success).toBe(false);
  });

  it("aceita somente preview RASCUNHO não exportável e confirmação sem resultado externo", () => {
    expect(ApacRascunhoPreparadoSchema.parse(preparado()).apac.estado).toBe("RASCUNHO");
    expect(ApacRascunhoConfirmadoSchema.parse({ codigo: "GRAVADA", apacId: "apac-sintetica-07", versao: 1,
      eventId: "evento-apac-sintetico-07", estado: "RASCUNHO", permiteExportar: false }).permiteExportar).toBe(false);
    for (const invalid of [
      preparado({ permiteExportar: true }),
      preparado({ apac: apac({ estado: "EMITIDA" }) }),
      preparado({ apac: apac({ resultadoExterno: { valor: "AUTORIZADA", comprovanteRef: "ref-sintetica",
        motivo: null, recebidoEm: "2026-10-20T15:00:00Z" } }) }),
      preparado({ conteudoHash: "não-sha" }),
    ]) expect(ApacRascunhoPreparadoSchema.safeParse(invalid).success).toBe(false);
    expect(ApacRascunhoConfirmadoSchema.safeParse({ codigo: "GRAVADA", apacId: "apac-sintetica-07", versao: 1,
      eventId: "evento-apac-sintetico-07", estado: "EMITIDA", permiteExportar: false }).success).toBe(false);
    expect(ApacRascunhoConfirmadoSchema.safeParse({ codigo: "GRAVADA", apacId: "apac-sintetica-07", versao: 1,
      eventId: "evento-apac-sintetico-07", estado: "RASCUNHO", permiteExportar: true }).success).toBe(false);
  });

  it("registra as três saídas HTTP com os schemas estritos de rascunho", () => {
    expect(SaidasHttp.baseApacRascunho?.safeParse(base()).success).toBe(true);
    expect(SaidasHttp.prepararApacRascunho?.safeParse(preparado()).success).toBe(true);
    expect(SaidasHttp.confirmarApacRascunho?.safeParse({ codigo: "REPLAY", apacId: "apac-sintetica-07",
      versao: 1, eventId: "evento-apac-sintetico-07", estado: "RASCUNHO", permiteExportar: false }).success).toBe(true);
  });
});
