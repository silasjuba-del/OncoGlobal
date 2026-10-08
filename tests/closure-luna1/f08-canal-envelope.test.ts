import { expect, it } from "vitest";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { lerCanal } from "../../src/server/leituras.js";
import { ambienteHttp } from "../server/http-fixture.js";

it("não projeta mensagem para outro paciente quando envelope e payload divergem", async () => {
  const ambiente = await ambienteHttp();
  try {
    const em = "2026-10-08T12:00:00Z";
    let seq = 0;
    const persistir = (patientId: string, encounterId: string, tipo: string, payload: unknown) => {
      const n = ++seq;
      const draftId = `draft-f08-${n}`;
      salvarDraft(ambiente.db, { draftId, patientId, sourceId: `source-f08-${n}`,
        rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: em });
      confirmar(ambiente.db, { operationId: `op-f08-${n}`, patientId, tumorLotId: null, encounterId,
        reviewDecisionId: `review-f08-${n}`, sessao: ambiente.sessoes.obter(ambiente.token)!, em,
        registros: [{ draftId, expectedRevision: 0, eventId: `event-f08-${n}`, tipo, payload,
          fontes: [], revisao: "CONFIRMADO" }] });
    };
    const pacienteA = "paciente-f08-a", pacienteB = "paciente-f08-b";
    persistir(pacienteA, "encontro-f08-a", "Paciente", { patientId: pacienteA,
      identificadores: [], nome: "Paciente Sintético A", nascimento: null,
      sexoCadastral: "NAO_INFORMADO", divergencia: false });
    persistir(pacienteB, "encontro-f08-b", "Paciente", { patientId: pacienteB,
      identificadores: [], nome: "Paciente Sintético B", nascimento: null,
      sexoCadastral: "NAO_INFORMADO", divergencia: false });
    persistir(pacienteA, "encontro-f08-a", "Contato", { contatoId: "contato-f08-a",
      canal: "WHATSAPP_SERVICO", endereco: "sintetico", patientId: pacienteA,
      relacao: "PACIENTE", vinculadoEm: em, revogadoEm: null });
    persistir(pacienteB, "encontro-f08-b", "CanalMessage", { mensagemId: "mensagem-f08-mismatch",
      contatoId: "contato-f08-a", patientId: pacienteA, texto: "mensagem sintética",
      em, redFlag: false });

    expect(lerCanal(ambiente.db).mensagens).toMatchObject([{
      mensagemId: "mensagem-f08-mismatch", patientId: null, nomePaciente: null,
      estadoVinculo: "CONFLITO",
    }]);
  } finally {
    await ambiente.close();
  }
});
