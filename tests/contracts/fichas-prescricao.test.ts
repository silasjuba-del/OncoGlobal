import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CatalogoFichasRespostaSchema,
  FichaProtocoloCatalogoSchema,
  InstanciacaoFichaRespostaSchema,
  InstanciarFichaPedidoSchema,
  RevisaoFichaProtocoloSchema,
  RevisarFichaPedidoSchema,
} from "../../src/contracts/api/fichasPrescricao.js";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const contentHash = sha("ficha sintética v1");
const reviewHash = sha("revisão médica sintética v1");
const fatosHash = sha("ledger sintético v1");
const contexto = { patientId: "paciente-sintetico", encounterId: "consulta-sintetica", tumorLotId: "lote-sintetico" };

function item(overrides: Record<string, unknown> = {}) {
  return { itemId: "item-1", item: {
    drug: "Medicamento sintético", classe: "QT", sequence: 1, standardDose: 100,
    doseBasis: "FIXED", calculatedDose: 100, prescribedDose: 100, unit: "mg", adjustmentPercent: null,
    adjustmentReason: null, route: "EV", diluent: null, finalVolumeMl: null, infusionTime: null,
    days: ["d1"], observacao: null, source: "PROTOCOL", overrideMotivo: null,
  }, ...overrides };
}

function template(overrides: Record<string, unknown> = {}) {
  return { templateId: "ficha-sintetica", tumor: "neoplasia sintética", nome: "Protocolo sintético",
    cenario: "Primeira linha", versao: "1.0", hash: "rotulo-ficha", codigoInstitucional: null,
    intervaloDias: 21, ciclos: 6, itens: [item().item], limiaresBula: null,
    fonte: "Fonte documental sintética", status: "RASCUNHO", ...overrides };
}

function revisao(overrides: Record<string, unknown> = {}) {
  return { templateId: "ficha-sintetica", versao: "1.0", revision: 1, decisao: "CONFERIR",
    medicoId: "medico-sintetico", em: "2026-10-20T15:00:00-03:00", motivo: "Conferência sintética",
    contentHash, reviewHash, ...overrides };
}

function ficha(overrides: Record<string, unknown> = {}) {
  return { template: template(), contentHash, revision: 1, revisao: revisao(), estado: "CONFERIDA",
    bloqueios: [], ...overrides };
}

function instancia(overrides: Record<string, unknown> = {}) {
  return { contexto, origemProposta: { draftId: "draft-proposta", revision: 2, hash: sha("proposta") },
    template: template(), contentHash, revisionFicha: 1, revisaoFatos: fatosHash,
    itens: [item()], pendencias: [], avisos: [],
    dadosCorporais: { pesoKg: 70, alturaCm: 170, bsaM2: 1.82, clcr: null, medidoEm: "2026-10-01" },
    ...overrides };
}

describe("contratos das fichas de prescrição", () => {
  it("aceita revisões e fichas de catálogo coerentes por identidade, hash e estado", () => {
    expect(RevisaoFichaProtocoloSchema.parse(revisao()).decisao).toBe("CONFERIR");
    const conferida = FichaProtocoloCatalogoSchema.parse(ficha());
    expect(conferida.estado).toBe("CONFERIDA");
    expect(conferida.template.status).toBe("RASCUNHO");
    expect(conferida.template.hash).toBe("rotulo-ficha");
    expect(FichaProtocoloCatalogoSchema.parse(ficha({
      revision: 0, revisao: null, estado: "PENDENTE",
    })).estado).toBe("PENDENTE");
    expect(FichaProtocoloCatalogoSchema.parse(ficha({
      revisao: revisao({ decisao: "INATIVAR" }), estado: "INATIVA",
    })).estado).toBe("INATIVA");
    expect(FichaProtocoloCatalogoSchema.parse(ficha({
      template: template({ status: "CONFERIDA_MEDICO" }), revisao: null, estado: "PENDENTE",
    })).estado).toBe("PENDENTE");
  });

  it("recusa revisão que aponta para outra versão, conteúdo, revisão ou decisão local", () => {
    expect(FichaProtocoloCatalogoSchema.safeParse(ficha({
      revisao: revisao({ templateId: "outra-ficha" }),
    })).success).toBe(false);
    expect(FichaProtocoloCatalogoSchema.safeParse(ficha({
      revisao: revisao({ versao: "2.0" }),
    })).success).toBe(false);
    expect(FichaProtocoloCatalogoSchema.safeParse(ficha({
      revisao: revisao({ revision: 2 }),
    })).success).toBe(false);
    expect(FichaProtocoloCatalogoSchema.safeParse(ficha({
      revisao: revisao({ contentHash: sha("conteúdo antigo") }),
    })).success).toBe(false);
    expect(FichaProtocoloCatalogoSchema.safeParse(ficha({
      revisao: revisao({ decisao: "INATIVAR" }), estado: "CONFERIDA",
    })).success).toBe(false);
    expect(FichaProtocoloCatalogoSchema.safeParse(ficha({
      estado: "PENDENTE",
    })).success).toBe(false);
  });

  it("rejeita identidade duplicada da mesma versão no catálogo", () => {
    expect(CatalogoFichasRespostaSchema.safeParse({ fichas: [ficha(), ficha()] }).success).toBe(false);
  });

  it("aceita pedidos válidos e impede que cliente injete ator ou data de revisão", () => {
    expect(RevisarFichaPedidoSchema.safeParse({ templateId: "ficha-sintetica", versao: "1.0",
      expectedContentHash: contentHash, expectedRevision: 0, decisao: "CONFERIR",
      motivo: "Revisão sintética", idempotencyKey: "revisao-1" }).success).toBe(true);
    expect(RevisarFichaPedidoSchema.safeParse({ templateId: "ficha-sintetica", versao: "1.0",
      expectedContentHash: contentHash, expectedRevision: 0, decisao: "CONFERIR",
      motivo: "Revisão sintética", idempotencyKey: "revisao-1", medicoId: "medico-cliente" }).success).toBe(false);
    expect(RevisarFichaPedidoSchema.safeParse({ templateId: "ficha-sintetica", versao: "1.0",
      expectedContentHash: contentHash, expectedRevision: 0, decisao: "CONFERIR",
      motivo: "Revisão sintética", idempotencyKey: "revisao-1", em: "2026-10-20T15:00:00Z" }).success).toBe(false);
    expect(InstanciarFichaPedidoSchema.safeParse({ contexto, templateId: "ficha-sintetica", versao: "1.0",
      expectedContentHash: contentHash, expectedRevision: 1, idempotencyKey: "instancia-1" }).success).toBe(true);
  });

  it("não aceita revisões inseguras, hashes inválidos, data impossível ou propriedade undefined", () => {
    expect(RevisaoFichaProtocoloSchema.safeParse(revisao({ revision: Number.MAX_SAFE_INTEGER + 1 })).success).toBe(false);
    expect(RevisaoFichaProtocoloSchema.safeParse(revisao({ revision: 0 })).success).toBe(false);
    expect(RevisaoFichaProtocoloSchema.safeParse(revisao({ contentHash: "a".repeat(63) })).success).toBe(false);
    expect(RevisaoFichaProtocoloSchema.safeParse(revisao({ em: "2026-02-30T15:00:00Z" })).success).toBe(false);
    expect(RevisarFichaPedidoSchema.safeParse({ templateId: "ficha-sintetica", versao: "1.0",
      expectedContentHash: contentHash, expectedRevision: Number.MAX_SAFE_INTEGER + 1, decisao: "CONFERIR",
      motivo: "Revisão sintética", idempotencyKey: "revisao-1" }).success).toBe(false);
    expect(RevisarFichaPedidoSchema.safeParse({ templateId: "ficha-sintetica", versao: "1.0",
      expectedContentHash: contentHash, expectedRevision: 0, decisao: "CONFERIR",
      motivo: "Revisão sintética", idempotencyKey: "revisao-1", observacao: undefined }).success).toBe(false);
  });

  it("aceita instância vinculada a ficha conferida e dados corporais finitos", () => {
    expect(InstanciacaoFichaRespostaSchema.parse(instancia()).template.templateId).toBe("ficha-sintetica");
  });

  it("preserva o template original da ficha e recusa dados corporais não finitos", () => {
    const resposta = InstanciacaoFichaRespostaSchema.parse(instancia());
    expect(resposta.template.status).toBe("RASCUNHO");
    expect(resposta.template.hash).toBe("rotulo-ficha");
    expect(InstanciacaoFichaRespostaSchema.safeParse(instancia({ revisionFicha: 0 })).success).toBe(false);
    expect(InstanciacaoFichaRespostaSchema.safeParse(instancia({
      dadosCorporais: { pesoKg: Number.NaN, alturaCm: 170, bsaM2: 1.82, clcr: null, medidoEm: null },
    })).success).toBe(false);
    expect(InstanciacaoFichaRespostaSchema.safeParse(instancia({
      dadosCorporais: { pesoKg: 70, alturaCm: 170, bsaM2: Number.POSITIVE_INFINITY, clcr: null, medidoEm: null },
    })).success).toBe(false);
  });

  it("rejeita itemId e sequência duplicados no resultado da instanciação", () => {
    const primeiro = item();
    const segundoMesmoId = item({ item: { ...primeiro.item, sequence: 2 } });
    expect(InstanciacaoFichaRespostaSchema.safeParse(instancia({ itens: [primeiro, segundoMesmoId] })).success).toBe(false);
    const segundoMesmaSequencia = item({ itemId: "item-2" });
    expect(InstanciacaoFichaRespostaSchema.safeParse(instancia({ itens: [primeiro, segundoMesmaSequencia] })).success).toBe(false);
  });
});
