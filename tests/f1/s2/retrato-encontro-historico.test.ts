import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import { hashCanonico, projetarRetrato, type ContextoRetrato } from "../../../src/kernel/projections/retrato/index.js";

const agora = "2026-10-12T12:00:00-03:00";
const contexto: ContextoRetrato = { patientId: "p", encounterId: "e0", tumorLotId: "t0", agora,
  regras: [], biblioteca: { id: "biblioteca", versao: "1", hash: "sintetico" } };
function evento(id: string, encounterId: string, tipo: string, data: Record<string, unknown>,
  extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "p", encounterId, tumorLotId: "t0",
    tipo, payload: { data }, fontes: [], revisao: "CONFIRMADO", criadoEm: agora,
    criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: null, ...extra };
}
const agenda = (id: string, encounterId: string, data: string) => evento(id, encounterId, "AgendaEntry",
  { patientId: "p", encounterId, data, horario: "09:00" });
const consulta = (id: string, encounterId: string, dataClinica: string) => evento(id, encounterId, "ConsultaConfirmada@1",
  { dataClinica, documentoIds: [{ documentId: `doc-${id}`, documentVersion: 1 }] });
const fato = (id: string, encounterId: string, factDate: string, extra: Partial<ClinicalEvent> = {}) =>
  evento(id, encounterId, "FATO", { campo: "extracao.lab:HB", domain: "lab", factDate,
    valor: { marker: "HB", value: 8.2, unit: "g/dL" } }, extra);
const ids = (r: ReturnType<typeof projetarRetrato>) => r.fatos.map(f => f.ref.eventId).sort();
const agendas = () => [agenda("agenda-e0", "e0", "2026-10-05"), agenda("agenda-e1", "e1", "2026-10-12")];
function assinaturaFlash(id: string, dia: string): [ClinicalEvent, ClinicalEvent] {
  const em = `${dia}T12:00:00-03:00`, reviewDecisionId = `review-${id}`, operationId = `assinar-${id}`;
  const corpo = { documentId: `doc-${id}`, documentVersion: 1, origem: "CONSULTA_FLASH", tipoDocumento: "FLASH_EVOLUCAO",
    contexto: { patientId: "p", encounterId: "e0", tumorLotId: "t0" }, texto: "Documento sintético exibido e assinado" };
  const documento = evento(`documento-${id}`, "e0", "DOCUMENTO", {}, { operationId, criadoEm: em, revisao: "ASSINADO",
    payload: { reviewDecisionId, data: { data: corpo, signature: { documentId: corpo.documentId, documentVersion: 1,
      documentHash: hashCanonico(corpo), reviewDecisionId, serverActorId: "medico-sintetico" } } } });
  const marco = evento(`fechamento-${id}`, "e0", "ConsultaConfirmada", {}, { operationId, criadoEm: em,
    payload: { reviewDecisionId, data: { dataClinica: dia, documentoIds: [{ documentId: corpo.documentId, documentVersion: 1 }] } } });
  return [marco, documento];
}

describe("S2 corte civil do encontro histórico", () => {
  it("exclui Hb posterior de E0 mesmo com cadastro, agendas e Hb registrados juntos; E1 consome Hb", () => {
    const cadastro = evento("cadastro", "e0", "Paciente", { patientId: "p", nome: "Pessoa sintética" }, { tumorLotId: null });
    const eventos = [...agendas(), cadastro, fato("hb-e1", "e1", "2026-10-12")];
    const historico = projetarRetrato(eventos, contexto);
    expect(ids(historico)).toEqual(["cadastro"]);
    expect(ids(projetarRetrato(eventos, { ...contexto, encounterId: "e1" }))).toEqual(["cadastro", "hb-e1"]);
    expect(historico.geradoEm).toBe(agora);
    expect(historico.resumo.some(f => f.texto.includes("extracao.lab:HB"))).toBe(false);
  });

  it("barra fato de origem posterior mesmo retrodatado e data clínica posterior mesmo em E0", () => {
    const r = projetarRetrato([...agendas(), fato("hb-retrodatada", "e1", "2026-10-01"),
      fato("hb-futura", "e0", "2026-10-06"), fato("hb-e0", "e0", "2026-10-05")], contexto);
    expect(ids(r)).toEqual(["hb-e0"]);
  });

  it("mantém alergias e medicamentos de encontro anterior entre tumores, mas exclui futuros", () => {
    const sist = (id: string, encontro: string, campo: string, dia: string) => evento(id, encontro, "FATO",
      { campo, valor: "literal sintético", dataClinica: dia }, { tumorLotId: "outro-tumor" });
    const r = projetarRetrato([...agendas(), agenda("agenda-previa", "previo", "2026-10-01"),
      sist("alergia-anterior", "previo", "alergias", "2026-10-01"),
      sist("medicamento-anterior", "previo", "medicamentos", "2026-10-01"),
      sist("diagnostico-outro-tumor", "previo", "diagnostico", "2026-10-01"),
      sist("alergia-futura", "e1", "alergias", "2026-10-01"),
      sist("medicamento-futuro", "e1", "medicamentos", "2026-10-01")], contexto);
    expect(ids(r)).toEqual(["alergia-anterior", "medicamento-anterior"]);
    expect(r.fatos.every(f => f.escopo === "PACIENTE")).toBe(true);
  });

  it("filtra antes de supersession para preservar o fato anterior no histórico", () => {
    const antigo = fato("hb-antiga", "e0", "2026-10-05", { criadoEm: "2026-10-12T11:00:00-03:00" });
    const novo = fato("hb-corrigida", "e1", "2026-10-05", { supersedesEventId: antigo.eventId });
    const eventos = [...agendas(), antigo, novo];
    expect(ids(projetarRetrato(eventos, contexto))).toEqual(["hb-antiga"]);
    expect(ids(projetarRetrato(eventos, { ...contexto, encounterId: "e1" }))).toEqual(["hb-corrigida"]);
  });

  it("prefere a data da consulta confirmada ao agendamento sem fabricar horário de fechamento", () => {
    const r = projetarRetrato([agenda("agendada", "e0", "2026-10-12"), consulta("confirmada", "e0", "2026-10-05"),
      fato("hb-depois", "e0", "2026-10-06"), fato("hb-mesmo-dia", "e0", "2026-10-05T18:00:00-03:00")], contexto);
    expect(ids(r)).toEqual(["hb-mesmo-dia"]);
    expect(r.geradoEm).toBe(agora);
  });

  it.each(["AgendaEntry", "ConsultaConfirmada@1"])("datas divergentes de %s ficam pendentes, sem eleger fatos", tipo => {
    const criar = tipo === "AgendaEntry" ? agenda : consulta;
    const eventos = [criar("marco-a", "e0", "2026-10-05"), criar("marco-b", "e0", "2026-10-12"), fato("hb", "e0", "2026-10-05")];
    const r = projetarRetrato(eventos, contexto);
    expect(ids(r)).toEqual([]);
    expect(r.integridade).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventoId: "marco-a", motivo: "DATA_ENCONTRO_AMBIGUA" }),
      expect.objectContaining({ eventoId: "marco-b", motivo: "DATA_ENCONTRO_AMBIGUA" }),
    ]));
    expect(projetarRetrato([...eventos].reverse(), contexto)).toEqual(r);
  });

  it("não usa data impossível de consulta nem agenda com identidade divergente", () => {
    const invalida = consulta("confirmada-invalida", "e0", "2026-02-30");
    const r = projetarRetrato([invalida, fato("hb", "e0", "2026-10-05")], contexto);
    expect(ids(r)).toEqual([]);
    expect(r.integridade).toContainEqual(expect.objectContaining({ eventoId: invalida.eventId, motivo: "DATA_ENCONTRO_INVALIDA" }));
    for (const divergente of [{ patientId: "outro" }, { encounterId: "outro" }]) {
      const marco = evento("agenda-divergente", "e0", "AgendaEntry", { patientId: "p", encounterId: "e0", data: "2026-10-12", horario: "09:00", ...divergente });
      const incoerente = projetarRetrato([marco, fato("hb", "e0", "2026-10-12")], contexto);
      expect(ids(incoerente)).toEqual([]);
      expect(incoerente.integridade).toContainEqual(expect.objectContaining({ eventoId: marco.eventId, motivo: "CONTEXTO_ENCONTRO_DIVERGENTE" }));
    }
  });

  it("origem com data ambígua não atravessa para o encontro alvo", () => {
    const r = projetarRetrato([agenda("alvo", "e0", "2026-10-05"), agenda("origem-a", "e1", "2026-10-01"),
      agenda("origem-b", "e1", "2026-10-12"), fato("hb", "e1", "2026-10-01")], contexto);
    expect(ids(r)).toEqual([]);
    expect(r.integridade.some(i => i.motivo === "DATA_ENCONTRO_AMBIGUA")).toBe(true);
  });

  it("agendas com a mesma data são compatíveis e outras pessoas, RAW ou registros futuros não ancoram", () => {
    const r = projetarRetrato([agenda("a", "e0", "2026-10-05"), agenda("b", "e0", "2026-10-05"),
      { ...agenda("outra-pessoa", "e0", "2026-10-12"), patientId: "outra-pessoa" },
      { ...agenda("rascunho", "e0", "2026-10-12"), revisao: "RAW" },
      { ...agenda("registro-futuro", "e0", "2026-10-12"), criadoEm: "2026-10-13T12:00:00-03:00" },
      fato("hb", "e0", "2026-10-05")], contexto);
    expect(ids(r)).toEqual(["hb"]);
    expect(r.integridade).toEqual([]);
  });

  it("sem âncora mantém os limites legados de registro/data clínica e não cria corrupção", () => {
    const r = projetarRetrato([fato("hb-legada", "anterior-sem-agenda", "2026-10-01"),
      fato("hb-futura", "e0", "2026-10-13"), fato("registro-futuro", "e0", "2026-10-01", { criadoEm: "2026-10-13T12:00:00-03:00" })], contexto);
    expect(ids(r)).toEqual(["hb-legada"]);
    expect(r.integridade).toEqual([expect.objectContaining({ eventoId: "hb-futura", motivo: "TEMPO_CLINICO_FUTURO" })]);
    expect(r.geradoEm).toBe(agora);
  });

  it("assinaturas correlacionadas em dias diferentes não mudam a data da agenda nem apagam fatos", () => {
    const entrada = [agenda("agenda", "e0", "2026-10-05"), ...assinaturaFlash("primeira", "2026-10-12"),
      ...assinaturaFlash("segunda", "2026-10-13"), fato("hb-e0", "e0", "2026-10-05"), fato("depois-consulta", "e0", "2026-10-06")];
    const ctx = { ...contexto, agora: "2026-10-13T12:00:00-03:00" };
    const r = projetarRetrato(entrada, ctx);
    expect(ids(r)).toEqual(["documento-primeira", "documento-segunda", "hb-e0"]);
    expect(r.integridade).toEqual([]);
    expect(projetarRetrato([...entrada].reverse(), ctx)).toEqual(r);
  });

  it("uma data clínica independente prevalece sobre agenda e assinaturas posteriores", () => {
    const r = projetarRetrato([agenda("agenda", "e0", "2026-10-12"), consulta("clinica", "e0", "2026-10-05"),
      ...assinaturaFlash("assinada", "2026-10-12"), fato("hb-e0", "e0", "2026-10-05"), fato("depois-consulta", "e0", "2026-10-06")], contexto);
    expect(ids(r)).toEqual(["documento-assinada", "hb-e0"]);
    expect(r.integridade).toEqual([]);
  });

  it("sem agenda, re-assinatura mantém o teto observacional mais restritivo com pendência explícita", () => {
    const fatos = [fato("hb-observada", "e0", "2026-10-12"), fato("posterior", "e0", "2026-10-13")];
    const ctx = { ...contexto, agora: "2026-10-13T12:00:00-03:00" };
    const antes = projetarRetrato([...assinaturaFlash("primeira", "2026-10-12"), ...fatos], ctx);
    const depois = projetarRetrato([...assinaturaFlash("primeira", "2026-10-12"), ...assinaturaFlash("segunda", "2026-10-13"), ...fatos], ctx);
    expect(ids(antes).filter(id => !id.startsWith("documento-"))).toEqual(["hb-observada"]);
    expect(ids(depois).filter(id => !id.startsWith("documento-"))).toEqual(["hb-observada"]);
    expect(depois.fatos.find(f => f.ref.eventId === "hb-observada")).toEqual(antes.fatos.find(f => f.ref.eventId === "hb-observada"));
    expect(depois.integridade).toEqual(["primeira", "segunda"].map(id => ({ eventoId: `fechamento-${id}`, tipo: "ConsultaConfirmada", motivo: "DATA_ENCONTRO_AUSENTE_LIMITE_ASSINATURA" })));
    expect(depois.geradoEm).toBe(ctx.agora);
    expect(fatos[0]!.payload).toEqual({ data: { campo: "extracao.lab:HB", domain: "lab", factDate: "2026-10-12", valor: { marker: "HB", value: 8.2, unit: "g/dL" } } });
  });

  it.each(["agenda", "clinica"])("assinaturas técnicas não resolvem conflito real de %s", origem => {
    const criar = origem === "agenda" ? agenda : consulta;
    const r = projetarRetrato([criar("real-a", "e0", "2026-10-05"), criar("real-b", "e0", "2026-10-06"),
      ...assinaturaFlash("assinada", "2026-10-12"), fato("hb-e0", "e0", "2026-10-05")], contexto);
    expect(r.fatos).toEqual([]);
    expect(r.integridade.map(p => [p.eventoId, p.motivo])).toEqual([["real-a", "DATA_ENCONTRO_AMBIGUA"], ["real-b", "DATA_ENCONTRO_AMBIGUA"]]);
  });

  it.each(["patientId", "encounterId", "tumorLotId", "operationId", "sem-assinatura", "hash", "autor", "referencia", "conjunto-incompleto"])(
    "tentativa de fechamento inválida (%s) não vira data clínica nem amplia E0 com somente agenda", falha => {
      const [marco, documento] = assinaturaFlash("falso", "2026-10-12");
      const payload = documento.payload as { reviewDecisionId: string; data: { data: Record<string, unknown>; signature: Record<string, unknown> } };
      if (["patientId", "encounterId", "tumorLotId", "operationId"].includes(falha)) (documento as unknown as Record<string, unknown>)[falha] = "outro-contexto";
      else if (falha === "sem-assinatura") documento.revisao = "CONFIRMADO";
      else if (falha === "hash") payload.data.signature.documentHash = "hash-divergente";
      else if (falha === "autor") payload.data.signature.serverActorId = "outro-medico";
      else if (falha === "referencia") payload.data.signature.documentVersion = 2;
      const extras = falha === "conjunto-incompleto" ? [{ ...documento, eventId: "documento-nao-referenciado" }] : [];
      for (const ancora of [agenda("agenda-e0", "e0", "2026-10-05"), consulta("clinica", "e0", "2026-10-05")]) {
        const r = projetarRetrato([ancora, marco, documento, ...extras,
          fato("hb-e0", "e0", "2026-10-05"), fato("hb-depois", "e0", "2026-10-06")], contexto);
        expect(ids(r)).toContain("hb-e0");
        expect(ids(r)).not.toContain("hb-depois");
        expect(r.integridade).toContainEqual({ eventoId: marco.eventId, tipo: "ConsultaConfirmada", motivo: "FECHAMENTO_FLASH_CORRELACAO_INVALIDA" });
      }
    });

  it("data adulterada em fechamento reconhecível fica pendente e não vira marco clínico independente", () => {
    const [marco, documento] = assinaturaFlash("documentada", "2026-10-12");
    (marco.payload as { data: { dataClinica: string } }).data.dataClinica = "2026-10-06";
    const r = projetarRetrato([agenda("agenda", "e0", "2026-10-05"), marco, documento,
      fato("hb-e0", "e0", "2026-10-05"), fato("hb-depois", "e0", "2026-10-06")], contexto);
    expect(ids(r)).toContain("hb-e0"); expect(ids(r)).not.toContain("hb-depois");
    expect(r.integridade.some(p => p.eventoId === marco.eventId && p.motivo === "FECHAMENTO_FLASH_CORRELACAO_INVALIDA")).toBe(true);
  });

  it("identidade determinística reconhece tentativa sem documento; não confere validade nem amplia a agenda", () => {
    const [marco] = assinaturaFlash("sem-documentos", "2026-10-12");
    marco.eventId = createHash("sha256").update(`${marco.operationId}:consulta-confirmada`).digest("hex");
    const r = projetarRetrato([agenda("agenda", "e0", "2026-10-05"), marco,
      fato("hb-e0", "e0", "2026-10-05"), fato("hb-depois", "e0", "2026-10-06")], contexto);
    expect(ids(r)).toEqual(["hb-e0"]);
    expect(r.integridade).toContainEqual({ eventoId: marco.eventId, tipo: "ConsultaConfirmada", motivo: "FECHAMENTO_FLASH_CORRELACAO_INVALIDA" });
  });

  it("operação com documento adicional de outro paciente não é validada pelo subconjunto do paciente atual", () => {
    const [marco, documento] = assinaturaFlash("operacao-parcial", "2026-10-12");
    const estranho = { ...documento, eventId: "documento-outro-paciente", patientId: "outro-paciente" };
    const r = projetarRetrato([agenda("agenda", "e0", "2026-10-05"), marco, documento, estranho,
      fato("hb-e0", "e0", "2026-10-05"), fato("hb-depois", "e0", "2026-10-06")], contexto);
    expect(ids(r)).toContain("hb-e0"); expect(ids(r)).not.toContain("hb-depois");
    expect(r.integridade).toContainEqual({ eventoId: marco.eventId, tipo: "ConsultaConfirmada", motivo: "FECHAMENTO_FLASH_CORRELACAO_INVALIDA" });
  });

  it("sem agenda, tentativa inválida não substitui o teto de assinatura válida nem cria horizonte sem suporte", () => {
    const valida = assinaturaFlash("valida", "2026-10-12"), [invalida] = assinaturaFlash("invalida", "2026-10-13");
    invalida.eventId = createHash("sha256").update(`${invalida.operationId}:consulta-confirmada`).digest("hex");
    const fatos = [fato("observado", "e0", "2026-10-12"), fato("posterior", "e0", "2026-10-13")];
    const ctx = { ...contexto, agora: "2026-10-13T12:00:00-03:00" };
    const r = projetarRetrato([...valida, invalida, ...fatos], ctx);
    expect(ids(r)).toContain("observado"); expect(ids(r)).not.toContain("posterior");
    expect(projetarRetrato([invalida, ...fatos], ctx).fatos).toEqual([]);
  });
});
