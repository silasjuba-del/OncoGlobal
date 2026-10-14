import { describe, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { listarEventos } from "../../../src/kernel/ledger/ledger.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { executarConfirmacao, proporPrescricao } from "../../../src/kernel/comandos/index.js";
import { criarMotorF1 } from "../../../src/kernel/orquestracao/runtime.js";
import { listarEstimulos } from "../../../src/kernel/orquestracao/estimulos/gravar.js";
import { avaliarSetores } from "../../../src/modules/setores/index.js";
import { reconciliar } from "../../../src/modules/reconciliador/index.js";
import type { PrescricaoProposta } from "../../../src/contracts/f1/prescricaoProposta.js";

const em = "2026-10-12T12:00:00-03:00", ctx = { patientId: "p-software-gatilhos", encounterId: "e-software-gatilhos", tumorLotId: null };
const biblioteca = { id: "biblioteca-sem-regras-software", versao: "1", hash: "software" };
const sessao = { medicoId: "medico-software", crm: "CRM-SOFTWARE", emitidaEm: "2026-10-12T09:00:00-03:00", expiraEm: "2026-10-12T19:00:00-03:00" };
const fonte = { sourceId: "fonte-software-gatilhos", classe: "MANUAL" as const, localizador: "software", dataClinica: "2026-10-12", dataCaptura: em, versao: "1", contentHash: "software" };
export const GATILHOS_A15 = [
  { nome: "esquema", campo: "proposta.itens.drug", estimulo: "PRESCRICAO_PROPOSTA" },
  { nome: "dose", campo: "proposta.itens.prescribedDose", estimulo: "PRESCRICAO_PROPOSTA" },
  { nome: "medicamento", campo: "medicamentos", estimulo: "MED_RECONCILIADO" },
  { nome: "comorbidade", campo: "comorbidades", estimulo: "FATO_CONFIRMADO" },
  { nome: "exame", campo: "extracao.lab:SOFTWARE", estimulo: "FATO_CONFIRMADO" },
  { nome: "toxicidade", campo: "toxicidades", estimulo: "FATO_CONFIRMADO" },
  { nome: "peso", campo: "peso", estimulo: "FATO_CONFIRMADO" },
] as const;
function proposta(revisaoFatos: string): PrescricaoProposta {
  return { schema: "PrescricaoProposta@1", id: "proposta-software", revisao: "1", correlacao: { ...ctx, operationId: "op-proposta-1", revisaoFatos,
    regras: [], biblioteca, proposta: { id: "proposta-software", revisao: "1" } }, templateId: null, templateVersao: null, estado: "DRAFT",
    itens: [{ drug: "substancia-software-a", classe: "NAO_ONCOLOGICA", sequence: 1, standardDose: null, doseBasis: "FIXED", calculatedDose: null,
      prescribedDose: 1, unit: "mg", adjustmentPercent: null, adjustmentReason: null, route: "SOFTWARE", diluent: null, finalVolumeMl: null,
      infusionTime: null, days: [], observacao: "Sentinela de software, sem uso assistencial", source: "MANUAL", overrideMotivo: null }] };
}
describe("S12 A15/A16: sete mudanças reais invalidam resultados anteriores", () => {
  it.each(GATILHOS_A15)("$nome passa pelo writer, emite $estimulo e não reutiliza visão antiga", async gatilho => {
    const db = abrirLedger(":memory:");
    try {
      const motor = criarMotorF1(db, () => em, () => ({ regras: [], biblioteca }));
      let antes = await motor.consultar(ctx);
      let repetir: () => unknown;
      if (gatilho.nome === "esquema" || gatilho.nome === "dose") {
        const p = proposta(antes.retrato.revisao); proporPrescricao(db, p, sessao, em, null);
        antes = await motor.consultar(ctx);
        const nova = structuredClone(p); nova.revisao = "2"; nova.correlacao.operationId = "op-proposta-2";
        nova.correlacao.proposta!.revisao = "2";
        if (gatilho.nome === "esquema") nova.itens[0]!.drug = "substancia-software-b";
        else nova.itens[0]!.prescribedDose = 2;
        repetir = () => proporPrescricao(db, nova, sessao, em, 0); repetir();
      } else {
        const id = `gatilho-${gatilho.nome}`;
        salvarDraft(db, { draftId: id, patientId: ctx.patientId, sourceId: fonte.sourceId, rawRef: "software", payload: { contexto: ctx }, diagnostics: [], revision: 0, criadoEm: em });
        const req = { ...ctx, operationId: id, reviewDecisionId: `review-${id}`, sessao, em, registros: [{ draftId: id, expectedRevision: 0,
          eventId: id, tipo: "FATO", payload: { campo: gatilho.campo, valor: gatilho.nome === "medicamento" ? ["substancia-software-a"] : "dado sintético atualizado" }, fontes: [fonte], revisao: "CONFIRMADO" as const }] };
        repetir = () => executarConfirmacao(db, req); repetir();
      }
      const depois = await motor.consultar(ctx);
      expect(depois.visaoIntegrada).not.toBeNull(); expect(antes.visaoIntegrada).not.toBeNull();
      expect(depois.visaoIntegrada!.correlacao).not.toEqual(antes.visaoIntegrada!.correlacao);
      expect(listarEstimulos(db).some(e => e.tipo === gatilho.estimulo)).toBe(true);
      const antiga = avaliarSetores(antes.retrato, antes.visaoIntegrada!.correlacao);
      const tardia = reconciliar(antiga.map(s => ({ id: s.setor, resultado: "ok" as const, tentativas: 1, saida: s })), depois.retrato, depois.visaoIntegrada!.correlacao);
      expect(tardia.achados).toEqual([]); expect(tardia.cobertura.setoresAvaliados).toEqual([]);
      expect(tardia.lacunas.some(l => l.codigo === "DESATUALIZADO")).toBe(true);
      const eventos = listarEventos(db, ctx.patientId), estimulos = listarEstimulos(db).length;
      repetir(); expect(listarEventos(db, ctx.patientId)).toEqual(eventos); expect(listarEstimulos(db)).toHaveLength(estimulos);
      if (gatilho.nome === "esquema" || gatilho.nome === "dose") expect(eventos).toEqual([]);
    } finally { db.close(); }
  });
  it("publica a cobertura atual dos gatilhos sem fingir fan-out seletivo", () => {
    expect(GATILHOS_A15).toHaveLength(7);
    console.info(JSON.stringify({ prova: "S12-A15-A16", gatilhos: GATILHOS_A15, consumoAtual: "sete setores e reconciliador", seletivoPorDominio: false }));
  });
});
