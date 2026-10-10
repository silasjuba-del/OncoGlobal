import { expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { projetarContextoClinico, projetarHistoricoClinico } from "../../src/server/f0c/contextoClinico.js";
import { ausente, fonteSintetica } from "../fixtures/triagem.js";
const agora = "2026-10-10T12:00:00-03:00";
const base = { patientId: "paciente-sintetico", tumorLotId: "lote-a", encounterId: "consulta-a", agora };
function evento(id: string, tipo: string, data: unknown, extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { eventId: id, operationId: `op-${id}`, eventIndex: 0, ...base, tipo, payload: { data },
    fontes: [fonteSintetica(id)], revisao: "CONFIRMADO", criadoEm: agora, criadoPor: { tipo: "SESSAO", id: "medico-sintetico" },
    supersedesEventId: null, ...extra };
}
const lab = (id: string, valor: number, data = "2026-10-09", extra: Partial<ClinicalEvent> = {}) =>
  evento(id, "LabResult", { campo: "creatinina", valor, unidade: "mg/dL", data, sourceId: id }, extra);
it("filtra paciente, lote, RAW e futuro, preservando conflito de laboratório e fonte sem fraseLaudo", () => {
  const r = projetarContextoClinico({ ...base, eventos: [lab("a", 1), lab("b", 2), lab("antigo", .8, "2026-10-01"),
    lab("estranho", 20, "2026-10-09", { patientId: "outro" }), lab("outro-lote", 50, "2026-10-09", { tumorLotId: "lote-b" }),
    lab("raw", 99, "2026-10-09", { revisao: "RAW" }), lab("futuro", 3, "2026-10-11") ] });
  expect(r.flash.laboratorios.map(x => x.eventId)).toEqual(["a", "b"]);
  expect(r.flash.laboratorios.every(x => x.conflito && x.situacao === "SEM_REFERENCIA")).toBe(true);
  expect(r.flash.laboratorios[0]?.sourceIds).toEqual(["a"]);
  expect(r.laboratoriosFonte).toHaveLength(3);
  expect(r.pendencias).toContain("LABORATORIOS_DIVERGENTES");
});
it("não transforma vazio em negação e preserva negação explícita, conflito e fontes", () => {
  expect(projetarContextoClinico({ ...base, eventos: [] }).flash.alergia).toBe("Não informada");
  const negada = evento("negada", "FATO", { campo: "alergias", valor: { negated: true } });
  expect(projetarContextoClinico({ ...base, eventos: [negada] }).flash.alergia).toBe("Negada explicitamente");
  const r = projetarContextoClinico({ ...base, eventos: [negada, evento("positiva", "FATO", { campo: "alergias", valor: ["dipirona"] })] });
  expect(r.campos.alergias.estado).toBe("VERMELHO");
  expect(r.campos.alergias.sourceIds.sort()).toEqual(["negada", "positiva"]);
  expect(r.flash.alergia).toContain("A CONFERIR");
});
it("toxicidades só da consulta atual e explicitamente presentes; negações e incerteza não são sintomas", () => {
  const tox = (id: string, valor: unknown, extra: Record<string, unknown> = {}) => evento(id, "FATO", {
    campo: `extracao.toxicity:${id}`, factId: id, valor, domain: "toxicity", sourceType: "medical_note", sourceId: id,
    evidence: "EXPLICIT", rawEvidence: "texto sintético", confidence: 1, requiresConfirmation: false, ...extra });
  const r = projetarContextoClinico({ ...base, eventos: [tox("atual", { nome: "diarreia", grau: 2 }),
    tox("negado", { nome: "vômito", negated: true }), tox("incerto", "náusea", { evidence: "UNCERTAIN" }),
    evento("antigo", "FATO", { campo: "toxicidades", valor: ["mucosite"] }, { encounterId: "consulta-antiga" }),
    evento("atual-fato", "FATO", { campo: "toxicidades", valor: [{ nome: "vômito", grau: 1 }] })] });
  expect(r.flash.toxicidades).toEqual(["diarreia"]);
  expect(r.pendencias).toContain("TOXICIDADES_DIVERGENTES");
  expect(r.toxicidadesFonte[0]?.eventId).toBe("atual");
});
it("biópsia/imagem mantêm origem e data, sem misturar outro tumor ou inferir resultado", () => {
  const r = projetarContextoClinico({ ...base, eventos: [evento("biopsia", "Biopsy", { nome: "Biópsia", dataClinica: "2026-10-01", fraseLaudo: "Laudo sintético" }),
    evento("imagem", "ImagingReport", { nome: "TC", dataClinica: "2026-10-05", fraseLaudo: "Resposta descrita" }),
    evento("sem-frase", "ImagingReport", { nome: "TC", dataClinica: "2026-10-05" }),
    evento("outro", "Biopsy", { dataClinica: "2026-10-01", fraseLaudo: "Outro tumor" }, { tumorLotId: "lote-b" })] });
  expect(r.flash.exames.map(x => x.eventId)).toEqual(["imagem", "biopsia"]);
});
const episodio = { episodioId: "ep", tumorLotId: "lote-a", modalidade: "QT", intencao: "ADJUVANTE", intentModifier: null,
  linha: 1, esquemaId: "CAPOX", inicio: ausente(), fim: ausente() };
const ciclo = { cicloId: "c3", episodioId: "ep", numero: 3, previstoEm: "2026-10-10", pesoKg: ausente(), origemPeso: null,
  ciclosSemPesoConsecutivos: 0, prescricaoRef: null, itens: [], comMedico: true };
it("prescrito não é administrado; última administração preserva status parcial e ciclo correspondente", () => {
  const c2 = { ...ciclo, cicloId: "c2", numero: 2 };
  const eventos = [evento("ciclo2", "Ciclo", c2), evento("ciclo3", "Ciclo", ciclo)];
  const entrada = { ...base, eventos, episodio, ciclo };
  expect(projetarContextoClinico(entrada).flash.ultimoAdministrado).toBeUndefined();
  const admin = { adminId: "admin2", cicloId: "c2", prescricaoRef: { documentId: "prescricao2", documentVersion: 1 },
    item: 1, droga: "oxaliplatina", quantidadeEfetivaMg: 100, status: "PARCIAL", motivo: "interrupção documentada", inicio: "2026-09-19T12:00:00-03:00",
    fim: "2026-09-19T13:00:00-03:00", fonte: fonteSintetica("admin2") };
  const r = projetarContextoClinico({ ...entrada, eventos: [...eventos, evento("administrada", "TreatmentAdministration", admin)] });
  expect(r.flash).toMatchObject({ protocolo: "CAPOX", cicloAtual: 3, ultimoAdministrado: "C2 em 2026-09-19 (PARCIAL)" });
  expect(r.flash.ciclosPrevistos).toBeUndefined();
});
it("cirurgia/RT usam contrato validado; um payload inválido não apaga outro evento válido", () => {
  const r = projetarHistoricoClinico({ ...base, eventos: [evento("cx", "Surgery", { tipo: "CIRURGIA", id: "original", data: "2026-08-01", procedimento: "Colectomia", observacao: null }),
    evento("rt", "Radiotherapy", { tipo: "RT", id: "original-rt", inicio: "2026-09-01", fim: null, fracoes: null, doseTotalGy: null,
      boost: null, topografia: "pelve", medicoResponsavel: null, local: null, observacao: null }),
    evento("invalido", "Surgery", { data: "2026-02-30" })] });
  expect(r.linhas).toHaveLength(2);
  expect(r.linhas[1]?.estado).toBe("PENDENTE");
  expect(r.pendencias).toEqual(["invalido"]);
  expect(r.origens.cx).toEqual(["cx"]);
});
import { item, template } from "../rules-prescricao/_fixtures.js";
it("resolve total só por templateId exato curado ou dado explícito do episódio; versões ambíguas não elegem", () => {
  const t = { ...template([item({ drug: "droga-sintetica" })]), templateId: "CAPOX", nome: "CAPOX curado", ciclos: 8 };
  const entrada = { ...base, eventos: [], episodio, ciclo };
  expect(projetarContextoClinico({ ...entrada, templates: [t] }).flash).toMatchObject({ ciclosPrevistos: 8, protocolo: "CAPOX curado" });
  expect(projetarContextoClinico({ ...entrada, templates: [{ ...t, templateId: "outro", nome: "CAPOX" }] }).flash.ciclosPrevistos).toBeUndefined();
  expect(projetarContextoClinico({ ...entrada, templates: [{ ...t, status: "RASCUNHO" }] }).flash.ciclosPrevistos).toBeUndefined();
  expect(projetarContextoClinico({ ...entrada, templates: [t, { ...t, versao: "2", ciclos: 6 }] }).pendencias).toContain("TEMPLATE_AMBIGUO");
  const explicito = evento("total", "FATO", { campo: "ciclosPrevistos", episodioId: "ep", valor: 6 });
  expect(projetarContextoClinico({ ...entrada, eventos: [explicito] }).flash.ciclosPrevistos).toBe(6);
  expect(projetarContextoClinico({ ...entrada, eventos: [explicito], templates: [t] }).pendencias).toContain("TOTAL_CICLOS_DIVERGENTE");
});
it("data civil do serviço impede resultado de amanhã ao cruzar meia-noite UTC", () => {
  const r = projetarContextoClinico({ ...base, agora: "2026-10-10T01:00:00Z", eventos: [
    lab("futuro-local", 4, "2026-10-10", { criadoEm: "2026-10-09T22:00:00-03:00" }),
    lab("atual-local", 1, "2026-10-09", { criadoEm: "2026-10-09T22:00:00-03:00" })] });
  expect(r.flash.laboratorios.map(l => l.eventId)).toEqual(["atual-local"]);
});
