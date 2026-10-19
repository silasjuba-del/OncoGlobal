import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { SessaoProfissionalSetorF6 } from "../../src/contracts/f6/multiusuarioSetores.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { validarFronteiraWorkStudyF6 } from "../../src/modules/setores/rbacSetorialF6.js";
import {
  consultarEstatisticaServicoF6,
  enviarMensagemChatSetorialF6,
  lerMensagensChatSetorialF6,
  listarAvisosMedicoSemPhiF6,
  obterFatiaSetorialNoServidorF6,
  registrarAvisoMedicoSemPhiF6,
  verificarEAuditarAcessoSetorialF6,
} from "../../src/server/f6MultiusuarioSetores.js";

const AGORA = "2026-10-18T16:00:00.000Z";
const EXPIRA = "2026-10-18T22:00:00.000Z";

const SESSAO_MEDICO: SessaoProfissionalSetorF6 = {
  sessaoId: "sess-med-1",
  profissionalId: "dr-silas",
  papel: "MEDICO",
  setor: "MEDICO",
  registroConselho: "CRM-PB-17341",
  territorio: "WORK",
  emitidaEm: AGORA,
  expiraEm: EXPIRA,
};

const SESSAO_ENFERMAGEM: SessaoProfissionalSetorF6 = {
  sessaoId: "sess-enf-1",
  profissionalId: "enf-salao-1",
  papel: "ENFERMAGEM_SALAO",
  setor: "TRIAGEM",
  registroConselho: "COREN-PB-1001",
  territorio: "WORK",
  emitidaEm: AGORA,
  expiraEm: EXPIRA,
};

const SESSAO_FARMACIA: SessaoProfissionalSetorF6 = {
  sessaoId: "sess-farm-1",
  profissionalId: "farm-onco-1",
  papel: "FARMACIA",
  setor: "FARMACIA",
  registroConselho: "CRF-PB-2002",
  territorio: "WORK",
  emitidaEm: AGORA,
  expiraEm: EXPIRA,
};

const SESSAO_SECRETARIA: SessaoProfissionalSetorF6 = {
  sessaoId: "sess-sec-1",
  profissionalId: "sec-fatur-1",
  papel: "SECRETARIA_FATURAMENTO",
  setor: "SECRETARIA",
  registroConselho: null,
  territorio: "WORK",
  emitidaEm: AGORA,
  expiraEm: EXPIRA,
};

const pastas: string[] = [];
const abertos: DatabaseSync[] = [];

function ledger(): { db: DatabaseSync; caminho: string } {
  const pasta = mkdtempSync(join(tmpdir(), "setores-f6-"));
  pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite");
  const db = abrirLedger(caminho);
  abertos.push(db);
  return { db, caminho };
}

function reabrir(caminho: string): DatabaseSync {
  const db = abrirLedger(caminho);
  abertos.push(db);
  return db;
}

afterEach(() => {
  for (const db of abertos.splice(0)) {
    try { db.close(); } catch { /* ja fechado */ }
  }
  for (const pasta of pastas.splice(0)) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe("FASE F6 · Multiusuário, RBAC por Setor, Avisos sem PHI, Estatísticas com Denominadores e Isolamento WORK×STUDY", () => {
  it("1 · RBAC server-side: vínculo por ID não concede permissão; separa atribuições de médico, enfermagem, farmácia e secretaria/faturamento e audita tudo no SQLite", () => {
    const { db } = ledger();

    // 1. Enfermagem tentando ler prontuário completo ou assinar prescrição, mesmo enviando patientId conhecido -> NEGADA por VINCULO_POR_ID_NAO_CONCEDE_PERMISSAO
    const enfTentaProntuario = verificarEAuditarAcessoSetorialF6(db, {
      sessaoCandidata: SESSAO_ENFERMAGEM,
      operacao: "LER_PRONTUARIO_COMPLETO",
      vinculoIdAlegadoPeloCliente: "pt-conhecido-01",
      agora: AGORA,
    });
    expect(enfTentaProntuario).toEqual({
      permitida: false,
      motivoCodigo: "VINCULO_POR_ID_NAO_CONCEDE_PERMISSAO",
    });

    expect(
      verificarEAuditarAcessoSetorialF6(db, {
        sessaoCandidata: SESSAO_ENFERMAGEM,
        operacao: "ASSINAR_DOCUMENTO_OU_PRESCRICAO",
        agora: AGORA,
      }),
    ).toEqual({
      permitida: false,
      motivoCodigo: "PERMISSAO_NEGADA_PARA_PAPEL_OU_SETOR",
    });

    // 2. Farmácia pode conferir/pedir correção, mas NUNCA editar prescrição (nem mesmo o médico pode usar EDITAR_PRESCRICAO_NA_FARMACIA)
    expect(
      verificarEAuditarAcessoSetorialF6(db, {
        sessaoCandidata: SESSAO_FARMACIA,
        operacao: "CONFERIR_OU_PEDIR_CORRECAO_FARMACIA",
        agora: AGORA,
      }).permitida,
    ).toBe(true);

    expect(
      verificarEAuditarAcessoSetorialF6(db, {
        sessaoCandidata: SESSAO_FARMACIA,
        operacao: "EDITAR_PRESCRICAO_NA_FARMACIA",
        agora: AGORA,
      }),
    ).toEqual({
      permitida: false,
      motivoCodigo: "OPERACAO_PROIBIDA_POR_INVARIANTE",
    });

    // 3. Cada setor vê apenas a sua fatia; o médico vê todas as fatias
    const dadosCompletos = {
      patientId: "pt-f6-01",
      encounterId: "enc-f6-01",
      evolucaoClinicaCompleta: "Evolução oncológica detalhada exclusiva do prontuário médico.",
      triagemFilaSalao: { destino: "SALAO", poltrona: "P-04" },
      prescricaoAssinadaFarmacia: { documentId: "rx-f6-1", esquema: "FOLFOX" },
      agendaEFaturamentoApac: { horario: "09:00", competenciaApac: "2026-10" },
    };

    const fatiaEnf = obterFatiaSetorialNoServidorF6(db, { sessao: SESSAO_ENFERMAGEM, agora: AGORA, dadosCompletos });
    const fatiaFarm = obterFatiaSetorialNoServidorF6(db, { sessao: SESSAO_FARMACIA, agora: AGORA, dadosCompletos });
    const fatiaSec = obterFatiaSetorialNoServidorF6(db, { sessao: SESSAO_SECRETARIA, agora: AGORA, dadosCompletos });
    const fatiaMed = obterFatiaSetorialNoServidorF6(db, { sessao: SESSAO_MEDICO, agora: AGORA, dadosCompletos });

    expect(fatiaEnf.ok && fatiaFarm.ok && fatiaSec.ok && fatiaMed.ok).toBe(true);
    if (!fatiaEnf.ok || !fatiaFarm.ok || !fatiaSec.ok || !fatiaMed.ok) return;

    expect(fatiaEnf.fatiaAutorizada.evolucaoClinicaCompleta).toBeNull();
    expect(fatiaEnf.fatiaAutorizada.triagemFilaSalao).toEqual({ destino: "SALAO", poltrona: "P-04" });
    expect(fatiaEnf.fatiaAutorizada.prescricaoAssinadaFarmacia).toBeNull();

    expect(fatiaFarm.fatiaAutorizada.evolucaoClinicaCompleta).toBeNull();
    expect(fatiaFarm.fatiaAutorizada.prescricaoAssinadaFarmacia).toEqual({ documentId: "rx-f6-1", esquema: "FOLFOX" });
    expect(fatiaFarm.fatiaAutorizada.agendaEFaturamentoApac).toBeNull();

    expect(fatiaSec.fatiaAutorizada.evolucaoClinicaCompleta).toBeNull();
    expect(fatiaSec.fatiaAutorizada.agendaEFaturamentoApac).toEqual({ horario: "09:00", competenciaApac: "2026-10" });

    expect(fatiaMed.fatiaAutorizada.evolucaoClinicaCompleta).toContain("Evolução oncológica");
    expect(fatiaMed.fatiaAutorizada.triagemFilaSalao).toBeTruthy();
    expect(fatiaMed.fatiaAutorizada.prescricaoAssinadaFarmacia).toBeTruthy();
    expect(fatiaMed.fatiaAutorizada.agendaEFaturamentoApac).toBeTruthy();

    // Auditoria append-only registrou todas as decisões PERMITIDA e NEGADA
    const nAudits = (db.prepare("SELECT COUNT(*) AS n FROM audit_event").get() as { n: number }).n;
    expect(Number(nAudits)).toBeGreaterThanOrEqual(8);
  });

  it("2 · comunicação operacional por setor (chat isolado por fatia, sem promoção automática ao prontuário) e avisos ao médico estritamente sem PHI", () => {
    const { db, caminho } = ledger();

    // Enfermagem escreve no chat TRIAGEM -> permitido; Enfermagem tenta ler chat FARMACIA -> bloqueado
    const msgTriagem = enviarMensagemChatSetorialF6(db, {
      sessao: SESSAO_ENFERMAGEM,
      patientId: "pt-f6-01",
      encounterId: "enc-f6-01",
      setor: "TRIAGEM",
      textoOperacional: "Paciente aguardando reavaliação de PA na poltrona 2.",
      agora: AGORA,
    });
    expect(msgTriagem.ok).toBe(true);
    if (!msgTriagem.ok) return;
    expect(msgTriagem.mensagem.promovidaAoProntuarioAutomaticamente).toBe(false);

    expect(
      lerMensagensChatSetorialF6(db, {
        sessao: SESSAO_ENFERMAGEM,
        patientId: "pt-f6-01",
        encounterId: "enc-f6-01",
        setor: "FARMACIA",
        agora: AGORA,
      }),
    ).toEqual({ ok: false, codigo: "CHAT_SETOR_FORA_DA_PERMISSAO" });

    // Médico lê todos os setores de chat
    const lidoPeloMedico = lerMensagensChatSetorialF6(db, {
      sessao: SESSAO_MEDICO,
      patientId: "pt-f6-01",
      encounterId: "enc-f6-01",
      setor: "TRIAGEM",
      agora: AGORA,
    });
    expect(lidoPeloMedico).toMatchObject({
      ok: true,
      mensagens: [expect.objectContaining({ textoOperacional: "Paciente aguardando reavaliação de PA na poltrona 2." })],
    });

    // Nenhuma linha foi promovida automaticamente a clinical_event
    const nClinicalEvents = (db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n;
    expect(Number(nClinicalEvents)).toBe(0);

    // Avisos ao médico sem PHI (Q55/Q59)
    const dic = { nomes: ["Maria Paciente Sintetica"], identificadores: ["CPF-SINTETICO-999"] };
    const aviso = registrarAvisoMedicoSemPhiF6(db, {
      sessaoEmissora: SESSAO_ENFERMAGEM,
      urgencia: "EMERGENCIA_E1",
      codigoEventoOpaco: "EMERGENCIA_E1_NO_SALAO",
      identificadorInternoParaHashOpaco: "pt-f6-01:enc-f6-01",
      dicionarioVerificacaoPhi: dic,
      agora: AGORA,
    });
    expect(aviso.ok).toBe(true);
    if (!aviso.ok) return;
    expect(aviso.aviso.contemPhi).toBe(false);
    expect(JSON.stringify(aviso.aviso)).not.toContain("pt-f6-01");
    expect(JSON.stringify(aviso.aviso)).not.toContain("Maria Paciente Sintetica");

    // Persistência após fechar e reabrir SQLite
    db.close();
    const dbReaberto = reabrir(caminho);
    expect(listarAvisosMedicoSemPhiF6(dbReaberto)).toHaveLength(1);
    expect(
      lerMensagensChatSetorialF6(dbReaberto, {
        sessao: SESSAO_MEDICO,
        patientId: "pt-f6-01",
        encounterId: "enc-f6-01",
        setor: "TRIAGEM",
        agora: AGORA,
      }),
    ).toMatchObject({ ok: true, mensagens: [expect.objectContaining({ mensagemId: msgTriagem.mensagem.mensagemId })] });
  });

  it("3 · estatísticas do serviço com denominadores e exclusões explícitos (D-W9-44) e separação estrita WORK × STUDY (Q54)", () => {
    const { db } = ledger();

    // Semeia 2 pacientes com fatos confirmados e 1 administração efetiva no ledger para testar denominadores
    const sessaoMedicaLedger = {
      medicoId: "dr-silas",
      crm: "CRM-PB-17341",
      emitidaEm: AGORA,
      expiraEm: EXPIRA,
    };

    salvarDraft(db, {
      draftId: "d-stat-1",
      patientId: "pt-stat-1",
      sourceId: "src-stat-1",
      rawRef: "local:1",
      payload: {},
      diagnostics: [],
      revision: 0,
      criadoEm: AGORA,
    });
    confirmar(db, {
      operationId: "op-stat-1",
      patientId: "pt-stat-1",
      tumorLotId: "lot-stat-1",
      encounterId: "enc-stat-1",
      reviewDecisionId: "rev-stat-1",
      sessao: sessaoMedicaLedger,
      em: AGORA,
      registros: [
        {
          draftId: "d-stat-1",
          expectedRevision: 0,
          eventId: "ev-stat-1",
          tipo: "FATO",
          payload: { campo: "estadiamento", valor: "IIA", dataClinica: "2026-10-10" },
          fontes: [],
          revisao: "CONFIRMADO",
        },
      ],
    });

    // Enfermagem não tem permissão para estatística consolidada do serviço; Médico e Secretaria/Faturamento têm
    expect(
      consultarEstatisticaServicoF6(db, {
        sessao: SESSAO_ENFERMAGEM,
        agora: AGORA,
      }),
    ).toEqual({ ok: false, codigo: "PERMISSAO_NEGADA_PARA_PAPEL_OU_SETOR" });

    const statMed = consultarEstatisticaServicoF6(db, {
      sessao: SESSAO_MEDICO,
      agora: AGORA,
    });
    expect(statMed.ok).toBe(true);
    if (!statMed.ok) return;
    expect(statMed.estatistica.denominadorPacientes).toBe(1);
    expect(statMed.estatistica.totalPacientes).toBe(1);
    expect(statMed.estatistica.eventosPorCategoria.FATO).toBe(1);
    expect(statMed.estatistica.exclusoes).toBeDefined();

    // Separação estrita WORK × STUDY: qualquer tentativa de transferir prontuário/PHI ou cruzar territórios é bloqueada
    expect(
      validarFronteiraWorkStudyF6({
        territorioOrigem: "WORK",
        territorioDestino: "STUDY",
        contemProntuarioOuPhi: true,
      }),
    ).toEqual({
      permitido: false,
      territorioOrigem: "WORK",
      territorioDestino: "STUDY",
      motivoCodigo: "BLOQUEADO_PHI_OU_PRONTUARIO_NA_FRONTEIRA",
      prontuarioOuPhiTransferido: false,
    });

    expect(
      validarFronteiraWorkStudyF6({
        territorioOrigem: "WORK",
        territorioDestino: "STUDY",
        contemProntuarioOuPhi: false,
      }),
    ).toEqual({
      permitido: false,
      territorioOrigem: "WORK",
      territorioDestino: "STUDY",
      motivoCodigo: "TERRITORIOS_WORK_E_STUDY_ESTRITAMENTE_SEPARADOS",
      prontuarioOuPhiTransferido: false,
    });
  });
});
