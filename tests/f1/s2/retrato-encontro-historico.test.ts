import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import { projetarRetrato, type ContextoRetrato } from "../../../src/kernel/projections/retrato/index.js";

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
});
