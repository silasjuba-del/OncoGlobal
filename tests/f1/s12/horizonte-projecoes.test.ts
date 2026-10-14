import { expect, it } from "vitest";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import { projetarContextoClinico, projetarHistoricoClinico } from "../../../src/server/f0c/contextoClinico.js";
import { projetarCumulativoClinico } from "../../../src/server/f0c/cumulativoClinico.js";
import { projetarCondicionaisClinicas } from "../../../src/server/f0c/condicionaisClinicas.js";
import { projetarInstrumentosClinicos } from "../../../src/server/f0c/instrumentosClinicos.js";
import { avaliarInteracoesCondicionadasDaConsulta } from "../../../src/server/f0c/interacoesCondicionadas.js";
import { fonteSintetica } from "../../fixtures/triagem.js";

const base = { patientId: "paciente-horizonte-sintetico", tumorLotId: "lote-a", encounterId: "encontro-a", agora: "2026-10-14T12:00:00-03:00" };
const antigo = "2026-10-01T12:00:00-03:00", novo = "2026-10-10T12:00:00-03:00";
function evento(id: string, tipo: string, data: unknown, extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { ...base, eventId: id, operationId: `op-${id}`, eventIndex: 0, tipo, payload: { data },
    fontes: [fonteSintetica(id)], revisao: "CONFIRMADO", criadoEm: antigo,
    criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: null, ...extra };
}
const marcadores = () => [evento("abertura-a", "Paciente", {}), evento("abertura-b", "Paciente", {}, { encounterId: "encontro-b", criadoEm: novo })];

it("Flash histórica não usa laboratório de outro encontro nem retificação posterior", () => {
  const a = evento("lab-a", "LabResult", { campo: "creatinina", valor: 1, unidade: "mg/dL", data: "2026-10-01", sourceId: "lab-a" });
  const b = evento("lab-b", "LabResult", { campo: "creatinina", valor: 9, unidade: "mg/dL", data: "2026-10-10", sourceId: "lab-b" },
    { encounterId: "encontro-b", criadoEm: novo, supersedesEventId: a.eventId });
  const eventos = [...marcadores(), a, b];
  expect(projetarContextoClinico({ ...base, eventos }).flash.laboratorios.map(l => l.eventId)).toEqual(["lab-a"]);
  expect(projetarContextoClinico({ ...base, encounterId: "encontro-b", eventos }).flash.laboratorios.map(l => l.eventId)).toEqual(["lab-b"]);
});
it("histórico cirúrgico reaberto não incorpora cirurgia confirmada no encontro seguinte", () => {
  const cx = evento("cirurgia-b", "Surgery", { tipo: "CIRURGIA", id: "cx", data: "2026-10-09", procedimento: "Procedimento sintético", observacao: null },
    { encounterId: "encontro-b", criadoEm: novo });
  expect(projetarHistoricoClinico({ ...base, eventos: [...marcadores(), cx] }).linhas).toEqual([]);
});
it("exposição cumulativa futura não redefine o total de um encontro reaberto", () => {
  const dado = { patientId: base.patientId, droga: "droga-sintetica", administracoes: [], historicoCompleto: true, fonteCompletude: "fonte-sintetica" };
  const e = evento("exposicao-b", "FATO", { campo: "exposicaoCumulativa", valor: dado }, { encounterId: "encontro-b", criadoEm: novo });
  const r = projetarCumulativoClinico({ ...base, eventos: [...marcadores(), e], programados: ["droga-sintetica"], limites: [] });
  expect(r.avaliacoes[0]?.eventIds).toEqual([]);
  expect(r.pendencias).toContain("droga-sintetica:EXPOSICAO_AUSENTE");
});
it("condicionais antigas não usam retificação registrada depois do próximo encontro", () => {
  const a = evento("cond-a", "FATO", { campo: "condicionaisCiclo", valor: {} });
  const b = evento("cond-b", "FATO", { campo: "condicionaisCiclo", valor: {} }, { criadoEm: novo, supersedesEventId: a.eventId });
  const r = projetarCondicionaisClinicas({ ...base, eventos: [...marcadores(), a, b], programados: [], regras: [] });
  expect(r.eventIds).toEqual(["cond-a"]);
});
it("instrumento antigo conserva a versão anterior à retificação tardia", () => {
  const valor = { aplicavel: true, fonteDados: "fonte-sintetica", kpsDocumentado: 80 };
  const a = evento("kps-a", "FATO", { campo: "instrumento.KPS", valor });
  const b = evento("kps-b", "FATO", { campo: "instrumento.KPS", valor: { ...valor, kpsDocumentado: 40 } }, { criadoEm: novo, supersedesEventId: a.eventId });
  const r = projetarInstrumentosClinicos({ ...base, eventos: [...marcadores(), a, b], regras: [] });
  expect(r.avaliacoes[0]?.eventIds).toEqual(["kps-a"]);
});
it("contexto de interação não é substituído por revisão posterior ao encontro", () => {
  const a = evento("inter-a", "FATO", { campo: "interacoesContexto", valor: {} });
  const b = evento("inter-b", "FATO", { campo: "interacoesContexto", valor: {} }, { criadoEm: novo, supersedesEventId: a.eventId });
  const r = avaliarInteracoesCondicionadasDaConsulta({ ...base, eventos: [...marcadores(), a, b], regrasInteracoes: [] });
  expect(r.eventIds).toEqual(["inter-a"]);
});
