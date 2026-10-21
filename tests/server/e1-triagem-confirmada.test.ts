// Prova sintetica da regra existente; nao define novo limiar clinico.
import { expect, it } from "vitest";
import { abrirAmbiente, criarDiretorio, removerDiretorio, cadastrarPaciente, carregarConsulta,
  PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { presente, triagemBase, fonteSintetica } from "../fixtures/triagem.js";
it("RT03: triagem confirmada grau4 aparece como E1 na consulta e na agenda", async () => {
  const a = await abrirAmbiente(criarDiretorio());
  try {
    cadastrarPaciente(a);
    const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
    for (const [tipo, payload] of [
      ["Triagem", triagemBase({ patientId: PACIENTE, encounterId: ENCONTRO, grauCtcae: presente(4) })],
      ["AgendaEntry", { patientId: PACIENTE, encounterId: ENCONTRO, data: "2026-10-09", horario: "12:00" }],
    ] as const) {
      const id = `rt03-${tipo}`;
      salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "referencia-sintetica-local",
        payload: {}, revision: 0, diagnostics: [], criadoEm: AGORA });
      expect(executarConfirmacao(a.db, { ...contexto, operationId: id, reviewDecisionId: `review-${id}`,
        sessao: a.sessoes.obter(a.token)!, em: AGORA, registros: [{ draftId: id, expectedRevision: 0,
          eventId: id, tipo, payload, fontes: [fonteSintetica(id)], revisao: "CONFIRMADO" }] }).estado).toBe("GRAVADA");
    }
    const consulta = await carregarConsulta(a);
    expect(consulta.status).toBe(200);
    expect(consulta.data.alertas.some((a: { presentationOverride: boolean }) => a.presentationOverride)).toBe(true);
    const agenda = await a.request("/consulta/agenda", {});
    expect(agenda.status).toBe(200);
    expect(agenda.data.itens.find((i: { patientId: string }) => i.patientId === PACIENTE).temE1).toBe(true);
  } finally { await a.close(); removerDiretorio(a.dir); }
});
