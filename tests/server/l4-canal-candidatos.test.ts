import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { lerMensagensOperacionaisCanal } from "../../src/server/canalOperacao.js";
import { receberTransporteSintetico } from "../../src/server/canalEntrada.js";
import { EM, ambiente } from "../bateria2/fixtures.js";

const contextoA = {
  patientId: "paciente-l4-candidato-a",
  encounterId: "encontro-l4-candidato-a",
  tumorLotId: null,
};
const contextoB = {
  patientId: "paciente-l4-candidato-b",
  encounterId: "encontro-l4-candidato-b",
  tumorLotId: null,
};

it("limita candidatos da mensagem sem vínculo ao paciente selecionado sem alterar o vínculo global", () => {
  const a = ambiente();
  const texto = "Mensagem sintética sem identificador de paciente.";
  const remetente = "5500000001212";

  try {
    for (const [contexto, nome] of [
      [contextoA, "Paciente A sintético"],
      [contextoB, "Paciente B sintético"],
    ] as const) {
      a.seed("Paciente", {
        patientId: contexto.patientId,
        nome,
        identificadores: [],
        nascimento: null,
        sexoCadastral: "NAO_INFORMADO",
        divergencia: false,
      }, "CONFIRMADO", contexto);
      a.seed("AgendaEntry", {
        patientId: contexto.patientId,
        encounterId: contexto.encounterId,
        horario: "10:00",
        data: EM.slice(0, 10),
      }, "CONFIRMADO", contexto);
    }

    const ingresso = receberTransporteSintetico(a.db, {
      accountId: "conta-l4-candidatos-sintetica",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "mensagem-l4-candidatos-sintetica",
      senderRef: remetente,
      providerSentAt: EM,
      ingestedAt: EM,
      conteudo: {
        tipo: "TEXT",
        texto,
        contentSha256: createHash("sha256").update(texto).digest("hex"),
      },
      cadastros: [],
    });
    expect(ingresso.ok).toBe(true);
    if (!ingresso.ok) throw new Error("INGRESSO_SINTETICO_NEGADO");

    const quantidadeEventosClinicos = () => (a.db.prepare(
      "SELECT COUNT(*) AS n FROM clinical_event",
    ).get() as { n: number }).n;
    const eventosAntesDaLeitura = quantidadeEventosClinicos();
    const acesso = a.acesso;
    const linhasGlobaisAntes = a.db.prepare(
      "SELECT vinculoClasse, vinculoPatientId FROM canal_mensagem WHERE mensagemId = ?",
    ).get(ingresso.reciboId) as { vinculoClasse: string; vinculoPatientId: string | null } | undefined;

    expect(linhasGlobaisAntes).toEqual({ vinculoClasse: "DESCONHECIDO", vinculoPatientId: null });

    acesso.sessoes.selecionarConsulta(acesso.token, null);
    const semContexto = lerMensagensOperacionaisCanal(a.db, acesso);
    expect(semContexto).toContainEqual(expect.objectContaining({
      mensagemId: ingresso.reciboId,
      patientId: null,
      estadoVinculo: "SEM_VINCULO",
      candidatos: [],
    }));

    acesso.sessoes.selecionarConsulta(acesso.token, contextoA);
    const contextoPacienteA = lerMensagensOperacionaisCanal(a.db, acesso);
    expect(contextoPacienteA).toContainEqual(expect.objectContaining({
      mensagemId: ingresso.reciboId,
      patientId: null,
      estadoVinculo: "SEM_VINCULO",
      candidatos: [{
        patientId: contextoA.patientId,
        nome: "Paciente A sintético",
        encounterId: contextoA.encounterId,
        tumorLotId: null,
      }],
    }));

    acesso.sessoes.selecionarConsulta(acesso.token, contextoB);
    const contextoPacienteB = lerMensagensOperacionaisCanal(a.db, acesso);
    expect(contextoPacienteB).toContainEqual(expect.objectContaining({
      mensagemId: ingresso.reciboId,
      patientId: null,
      estadoVinculo: "SEM_VINCULO",
      candidatos: [{
        patientId: contextoB.patientId,
        nome: "Paciente B sintético",
        encounterId: contextoB.encounterId,
        tumorLotId: null,
      }],
    }));

    expect(quantidadeEventosClinicos()).toBe(eventosAntesDaLeitura);
    expect(a.db.prepare(
      "SELECT vinculoClasse, vinculoPatientId FROM canal_mensagem WHERE mensagemId = ?",
    ).get(ingresso.reciboId)).toEqual(linhasGlobaisAntes);
  } finally {
    a.db.close();
  }
});
