import { expect, it } from "vitest";
import { ContextoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { lerBasePrescricaoExecutavel } from "../../src/server/prescricaoExecutavel.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const EM = "2026-10-20T12:00:00.000Z";
const contexto = ContextoAcaoComposta.parse({ patientId: "paciente-a-sintetico",
  encounterId: "consulta-a-sintetica", tumorLotId: "lote-a-sintetico" });

function baseComPaciente(tipo: "Paciente" | "Paciente@1", payloadPatientId: string, nome: string) {
  const db = abrirLedger(":memory:");
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO",
    senha: "senha-sintetica-longa", duracaoMs: 60_000, agora: () => EM });
  const token = sessoes.login("senha-sintetica-longa")!.token;
  const sessao = sessoes.obter(token)!;
  const draftId = `draft-${tipo}-${payloadPatientId}`;
  salvarDraft(db, { draftId, patientId: contexto.patientId, sourceId: "fonte-paciente-sintetica",
    rawRef: "referencia-local-sintetica", payload: { contexto }, revision: 0, diagnostics: [], criadoEm: EM });
  const gravacao = executarConfirmacao(db, { operationId: `op-${draftId}`, patientId: contexto.patientId,
    tumorLotId: contexto.tumorLotId, encounterId: contexto.encounterId,
    reviewDecisionId: `revisao-${draftId}`, sessao, em: EM,
    registros: [{ draftId, expectedRevision: 0, eventId: `evento-${draftId}`, tipo,
      payload: { patientId: payloadPatientId, identificadores: [], nome, nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false },
      fontes: [fonteSintetica(`fonte-${draftId}`)], revisao: "CONFIRMADO" }] });
  expect(gravacao.estado).toBe("GRAVADA");
  return db;
}

it("não expõe nem aceita cadastro cujo patientId diverge do paciente do evento", () => {
  const db = baseComPaciente("Paciente", "paciente-b-sintetico", "Nome B sintético");
  try {
    const base = lerBasePrescricaoExecutavel(db, contexto, EM);
    expect(base.pacienteNome).toBe(contexto.patientId);
    expect(base.pendencias).toContain("PACIENTE_AUSENTE_OU_AMBIGUO");
  } finally { db.close(); }
});

it("aceita alias legado Paciente@1 quando o payload identifica o mesmo paciente do evento", () => {
  const db = baseComPaciente("Paciente@1", contexto.patientId, "Nome A sintético");
  try {
    const base = lerBasePrescricaoExecutavel(db, contexto, EM);
    expect(base.pacienteNome).toBe("Nome A sintético");
    expect(base.pendencias).not.toContain("PACIENTE_AUSENTE_OU_AMBIGUO");
  } finally { db.close(); }
});
