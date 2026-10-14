import { expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { listarEventos } from "../../../src/kernel/ledger/ledger.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { executarConfirmacao, proporPrescricao } from "../../../src/kernel/comandos/index.js";
import { projetarRetrato } from "../../../src/kernel/projections/retrato/index.js";
import { hashCanonico } from "../../../src/rules/conteudoCanonico.js";
import { avaliarSetores } from "../../../src/modules/setores/index.js";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import type { PrescricaoProposta } from "../../../src/contracts/f1/prescricaoProposta.js";

/** A14: paciente e trajetória são SOFTWARE. Quantidades sentinela não são doses de tratamento.
 * Não substitui o caso cólon aceito nem comprova protocolo/conduta clínica do corpus privado. */
it("A14 mama RH+ HER2− estádio II até ciclo4: fontes, correção e estados de tratamento não se confundem", () => {
  const db = abrirLedger(":memory:");
  const patientId = "paciente-software-mama-a14", tumorLotId = "tumor-software-mama-a14";
  const biblioteca = { id: "biblioteca-software-sem-regras", versao: "1", hash: "software" };
  const dia = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
  const instante = (n: number) => `${dia(n)}T12:00:00-03:00`;
  const sessao = { medicoId: "medico-software-a14", crm: "CRM-SOFTWARE", emitidaEm: instante(1), expiraEm: instante(30) };
  const fonte = (id: string, n: number) => ({ sourceId: `fonte-${id}`, classe: "DOCUMENT" as const, localizador: "evidência sintética",
    dataClinica: dia(n), dataCaptura: instante(n), versao: "1", contentHash: hashCanonico({ id, dia: dia(n), software: true }) });
  const gravar = (id: string, n: number, encounterId: string, tipo: string, payload: unknown,
    revisao: "CONFIRMADO" | "ASSINADO" = "CONFIRMADO", supersedesEventId: string | null = null) => {
    salvarDraft(db, { draftId: id, patientId, sourceId: `fonte-${id}`, rawRef: "software", payload: { contexto: { patientId, encounterId, tumorLotId } }, diagnostics: [], revision: 0, criadoEm: instante(n) });
    const req = { patientId, encounterId, tumorLotId, operationId: `op-${id}`, reviewDecisionId: `review-${id}`, sessao, em: instante(n),
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload, fontes: [fonte(id, n)], revisao, supersedesEventId }] };
    expect(executarConfirmacao(db, req).estado).toBe("GRAVADA"); return req;
  };
  const ler = (n: number, encounterId: string) => projetarRetrato(listarEventos(db, patientId), {
    patientId, encounterId, tumorLotId, agora: instante(n), regras: [], biblioteca });
  try {
    gravar("agenda-diagnostico", 1, "e-diagnostico", "AgendaEntry", { patientId, encounterId: "e-diagnostico", data: dia(1), horario: "09:00" });
    gravar("diagnostico", 1, "e-diagnostico", "FATO", { campo: "extracao.diagnosis", valor: "Mama RH+ HER2 negativo estádio II — cenário sintético", factDate: dia(1) });
    gravar("comorbidade", 1, "e-diagnostico", "FATO", { campo: "comorbidades", valor: ["hipertensão informada na fixture"] });
    gravar("medicamentos", 1, "e-diagnostico", "FATO", { campo: "medicamentos", valor: ["losartana", "paroxetina"] });
    gravar("planejado", 1, "e-diagnostico", "FATO", { campo: "tratamento", valor: { camada: "PLANEJADO", descricao: "antraciclina seguida de taxano; sem doses definidas nesta fixture" } });
    const historicoInicial = ler(1, "e-diagnostico");
    const assinados: ClinicalEvent[] = [];
    for (let ciclo = 1; ciclo <= 4; ciclo++) {
      const n = 1 + ciclo * 2, encounterId = `e-ciclo-${ciclo}`;
      gravar(`agenda-${ciclo}`, n, encounterId, "AgendaEntry", { patientId, encounterId, data: dia(n), horario: "09:00" });
      const antes = ler(n, encounterId), id = `proposta-${ciclo}`;
      const proposta: PrescricaoProposta = { schema: "PrescricaoProposta@1", id, revisao: "1", estado: "DRAFT", templateId: null, templateVersao: null,
        correlacao: { patientId, encounterId, tumorLotId, operationId: `op-${id}`, revisaoFatos: antes.revisao, regras: [], biblioteca, proposta: { id, revisao: "1" } },
        itens: [{ drug: "substancia-software-a14", classe: "QT", sequence: 1, standardDose: null, doseBasis: "FIXED", calculatedDose: null,
          prescribedDose: 1, unit: "mg", adjustmentPercent: null, adjustmentReason: null, route: "SOFTWARE", diluent: null, finalVolumeMl: null,
          infusionTime: null, days: [], observacao: "Quantidade sentinela de software, não dose clínica", source: "MANUAL", overrideMotivo: "Fixture de software sem uso assistencial" }] };
      const quantidadeAntes = listarEventos(db, patientId).length;
      proporPrescricao(db, proposta, sessao, instante(n), null);
      expect(listarEventos(db, patientId)).toHaveLength(quantidadeAntes);
      expect(ler(n, encounterId).fatos.some(f => f.ref.eventId === id)).toBe(false);
      const docId = `prescricao-${ciclo}`, corpo = { documentId: docId, documentVersion: 1, contexto: { patientId, encounterId, tumorLotId },
        texto: `Prescrição sintética do ciclo ${ciclo}; um marcador de software; sem uso assistencial.`, tipoDocumento: "PRESCRICAO_SOFTWARE", origem: "FIXTURE_SOFTWARE" };
      gravar(docId, n, encounterId, "DOCUMENTO", { data: corpo, signature: { documentId: docId, documentVersion: 1,
        documentHash: hashCanonico(corpo), reviewDecisionId: `review-${docId}`, serverActorId: sessao.medicoId } }, "ASSINADO");
      assinados.push(listarEventos(db, patientId).find(e => e.eventId === docId)!);
      expect(listarEventos(db, patientId).filter(e => e.tipo === "TreatmentAdministration")).toHaveLength(ciclo - 1);
      const admin = gravar(`admin-${ciclo}`, n, encounterId, "TreatmentAdministration", { adminId: `admin-${ciclo}`, cicloId: `ciclo-${ciclo}`,
        prescricaoRef: { documentId: docId, documentVersion: 1 }, item: 1, droga: "substancia-software-a14",
        quantidadeEfetivaMg: ciclo === 3 ? 0 : 1, status: ciclo === 3 ? "OMITIDA" : "COMPLETA", motivo: ciclo === 3 ? "omissão explicitamente registrada na fixture" : null,
        inicio: instante(n), fim: instante(n), fonte: fonte(`admin-${ciclo}`, n) });
      expect(executarConfirmacao(db, admin).estado).toBe("REPLAY");
      if (ciclo === 3) gravar("toxicidade", n, encounterId, "FATO", { campo: "toxicidades", valor: { relato: "Diarreia grau 3 informada no cenário", ctcae_version: null, medidas: {} } });
      if (ciclo === 4) gravar("medicamentos-corrigidos", n, encounterId, "FATO", { campo: "medicamentos", valor: ["losartana"], motivo: "reconciliação explícita de software" }, "CONFIRMADO", "medicamentos");
      gravar(`consulta-${ciclo}`, n, encounterId, "ConsultaConfirmada", { dataClinica: dia(n), documentoIds: [{ documentId: docId, documentVersion: 1 }] });
      const r = ler(n, encounterId), c = { patientId, encounterId, tumorLotId, operationId: `avaliar-${ciclo}`, revisaoFatos: r.revisao, regras: [], biblioteca, proposta: null };
      expect(r.fatos.find(f => f.ref.eventId === "diagnostico")?.fontes[0]?.sourceId).toBe("fonte-diagnostico");
      expect(r.fatos.filter(f => f.tipo === "TreatmentAdministration")).toHaveLength(ciclo);
      const setores = avaliarSetores(r, c);
      expect(setores.every(s => s.lacunas.length > 0)).toBe(true);
      expect(setores.flatMap(s => s.achados).some(a => a.estado === "VERDE")).toBe(false);
      expect(setores.find(s => s.setor === "TRATAMENTO")?.lacunas.some(l => l.codigo === "CUMULATIVO_COBERTURA")).toBe(true);
    }
    const final = ler(9, "e-ciclo-4"), eventos = listarEventos(db, patientId);
    expect(final.fatos.some(f => f.ref.eventId === "medicamentos")).toBe(false);
    expect(final.fatos.some(f => f.ref.eventId === "medicamentos-corrigidos")).toBe(true);
    expect(final.fatos.find(f => f.ref.eventId === "admin-3")?.dados).toMatchObject({ status: "OMITIDA", quantidadeEfetivaMg: 0 });
    expect(ler(1, "e-diagnostico")).toEqual(historicoInicial);
    for (const assinado of assinados) expect(eventos.find(e => e.eventId === assinado.eventId)).toEqual(assinado);
    expect(eventos.filter(e => e.tipo === "TreatmentAdministration")).toHaveLength(4);
    console.info(JSON.stringify({ prova: "S12-A14", ciclos: 4, contratos: ["PrescricaoProposta@1", "DOCUMENTO", "TreatmentAdministration"],
      dosesClinicasValidadas: false, coberturaClinica: "PENDENTE_SEM_REGRAS", historicoImutavel: true }));
  } finally { db.close(); }
});
