// F6 · Servidor multiusuário e setores no monólito local SQLite (sem arquitetura distribuída):
// - RBAC aplicado no servidor por profissional e setor com auditoria append-only (permitido e negado);
// - Visões fatiadas por setor (Enfermagem/Salão, Farmácia, Secretaria/Faturamento, Médico);
// - Chat operacional por paciente e setor (nunca promovido automaticamente ao prontuário);
// - Avisos ao médico sem PHI;
// - Estatísticas do serviço com denominadores e exclusões explícitos;
// - Separação estrita WORK × STUDY.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  AvisoMedicoSemPhiF6,
  MensagemOperacionalSetorF6,
  type CodigoEventoAvisoMedicoOpaco,
  type OperacaoSetorialF6,
  type SessaoProfissionalSetorF6,
} from "../contracts/f6/multiusuarioSetores.js";
import { auditar, listarEventos } from "../kernel/comandos/portas.js";
import { transacao } from "../kernel/ledger/db.js";
import { contemPhiResidual, type DicionarioPaciente } from "../kernel/llm/desidentificar.js";
import { projetarEstatisticaLedger } from "../kernel/projections/estatistica.js";
import type { OpcoesEstatistica, ProjecaoEstatistica } from "../modules/estatistica/projetar.js";
import {
  autorizarOperacaoSetorialF6,
  criarAvisoMedicoSemPhiF6,
} from "../modules/setores/rbacSetorialF6.js";

export function garantirSchemaF6(db: DatabaseSync): void {
  if (!db.isTransaction) {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS f6_chat_operacional (
      mensagemId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      encounterId TEXT NOT NULL,
      setor TEXT NOT NULL CHECK (setor IN ('TRIAGEM','FARMACIA','SECRETARIA','MEDICO')),
      autorProfissionalId TEXT NOT NULL,
      autorPapel TEXT NOT NULL,
      mensagemJson TEXT NOT NULL,
      criadoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS f6_chat_operacional_no_update BEFORE UPDATE ON f6_chat_operacional
      BEGIN SELECT RAISE(ABORT, 'f6_chat_operacional append-only'); END;
    CREATE TRIGGER IF NOT EXISTS f6_chat_operacional_no_delete BEFORE DELETE ON f6_chat_operacional
      BEGIN SELECT RAISE(ABORT, 'f6_chat_operacional append-only'); END;

    CREATE TABLE IF NOT EXISTS f6_aviso_medico_sem_phi (
      avisoId TEXT PRIMARY KEY,
      setorOrigem TEXT NOT NULL,
      urgencia TEXT NOT NULL,
      codigoEventoOpaco TEXT NOT NULL,
      avisoJson TEXT NOT NULL,
      criadoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS f6_aviso_medico_no_update BEFORE UPDATE ON f6_aviso_medico_sem_phi
      BEGIN SELECT RAISE(ABORT, 'f6_aviso_medico_sem_phi append-only'); END;
    CREATE TRIGGER IF NOT EXISTS f6_aviso_medico_no_delete BEFORE DELETE ON f6_aviso_medico_sem_phi
      BEGIN SELECT RAISE(ABORT, 'f6_aviso_medico_sem_phi append-only'); END;
  `);
}

/**
 * Executa verificação RBAC no servidor e grava AuditEvent append-only tanto para PERMITIDA quanto para NEGADA (INV-20).
 */
export function verificarEAuditarAcessoSetorialF6(
  db: DatabaseSync,
  entrada: {
    sessaoCandidata: unknown;
    operacao: OperacaoSetorialF6;
    setorChatAlvo?: "TRIAGEM" | "FARMACIA" | "SECRETARIA" | "MEDICO";
    vinculoIdAlegadoPeloCliente?: string | null;
    agora: string;
  },
) {
  garantirSchemaF6(db);
  const decisao = autorizarOperacaoSetorialF6(entrada);
  const atorId = decisao.permitida
    ? `${decisao.sessao.papel}:${decisao.sessao.profissionalId}`
    : typeof (entrada.sessaoCandidata as { profissionalId?: unknown } | null)?.profissionalId === "string"
      ? String((entrada.sessaoCandidata as { profissionalId: string }).profissionalId)
      : "anonimo";

  auditar(db, {
    ator: { tipo: "SESSAO", id: atorId },
    acaoPedida: entrada.setorChatAlvo ? `${entrada.operacao}:${entrada.setorChatAlvo}` : entrada.operacao,
    decisao: decisao.permitida ? "PERMITIDA" : "NEGADA",
    motivoCodigo: decisao.motivoCodigo,
    politicaVersao: "F6-RBAC-1.0",
    em: entrada.agora,
  });

  return decisao;
}

/**
 * Retorna a visão fatiada de um paciente/encontro de acordo com o papel e setor autenticado no servidor (Q40):
 * - ENFERMAGEM_SALAO: vê apenas triagem, fila e administrações do salão (sem evolução médica completa e sem APAC);
 * - FARMACIA: vê apenas a prescrição assinada e o chip de estoque (sem evolução médica e sem triagem/APAC);
 * - SECRETARIA_FATURAMENTO: vê apenas dados administrativos/agenda/lotes APAC (sem evolução clínica e sem prescrição detalhada);
 * - MEDICO: vê todas as fatias integradas.
 */
export function obterFatiaSetorialNoServidorF6(
  db: DatabaseSync,
  entrada: {
    sessao: SessaoProfissionalSetorF6;
    agora: string;
    dadosCompletos: {
      patientId: string;
      encounterId: string;
      evolucaoClinicaCompleta: string;
      triagemFilaSalao: Record<string, unknown>;
      prescricaoAssinadaFarmacia: Record<string, unknown>;
      agendaEFaturamentoApac: Record<string, unknown>;
    };
  },
):
  | { ok: false; codigo: string }
  | {
    ok: true;
    papel: SessaoProfissionalSetorF6["papel"];
    fatiaAutorizada: {
      patientId: string;
      encounterId: string;
      evolucaoClinicaCompleta: string | null;
      triagemFilaSalao: Record<string, unknown> | null;
      prescricaoAssinadaFarmacia: Record<string, unknown> | null;
      agendaEFaturamentoApac: Record<string, unknown> | null;
    };
  } {
  const operacaoPorPapel: Record<SessaoProfissionalSetorF6["papel"], OperacaoSetorialF6> = {
    MEDICO: "LER_PRONTUARIO_COMPLETO",
    ENFERMAGEM_SALAO: "LER_FILA_E_POLTRONAS_SALAO",
    FARMACIA: "LER_PRESCRICAO_ASSINADA_FARMACIA",
    SECRETARIA_FATURAMENTO: "LER_AGENDA_E_CADASTRO_SECRETARIA",
  };

  const op = operacaoPorPapel[entrada.sessao.papel];
  const veredito = verificarEAuditarAcessoSetorialF6(db, {
    sessaoCandidata: entrada.sessao,
    operacao: op,
    agora: entrada.agora,
  });
  if (!veredito.permitida) return { ok: false, codigo: veredito.motivoCodigo };

  const d = entrada.dadosCompletos;
  if (entrada.sessao.papel === "MEDICO") {
    return {
      ok: true,
      papel: "MEDICO",
      fatiaAutorizada: {
        patientId: d.patientId,
        encounterId: d.encounterId,
        evolucaoClinicaCompleta: d.evolucaoClinicaCompleta,
        triagemFilaSalao: d.triagemFilaSalao,
        prescricaoAssinadaFarmacia: d.prescricaoAssinadaFarmacia,
        agendaEFaturamentoApac: d.agendaEFaturamentoApac,
      },
    };
  }

  if (entrada.sessao.papel === "ENFERMAGEM_SALAO") {
    return {
      ok: true,
      papel: "ENFERMAGEM_SALAO",
      fatiaAutorizada: {
        patientId: d.patientId,
        encounterId: d.encounterId,
        evolucaoClinicaCompleta: null,
        triagemFilaSalao: d.triagemFilaSalao,
        prescricaoAssinadaFarmacia: null,
        agendaEFaturamentoApac: null,
      },
    };
  }

  if (entrada.sessao.papel === "FARMACIA") {
    return {
      ok: true,
      papel: "FARMACIA",
      fatiaAutorizada: {
        patientId: d.patientId,
        encounterId: d.encounterId,
        evolucaoClinicaCompleta: null,
        triagemFilaSalao: null,
        prescricaoAssinadaFarmacia: d.prescricaoAssinadaFarmacia,
        agendaEFaturamentoApac: null,
      },
    };
  }

  return {
    ok: true,
    papel: "SECRETARIA_FATURAMENTO",
    fatiaAutorizada: {
      patientId: d.patientId,
      encounterId: d.encounterId,
      evolucaoClinicaCompleta: null,
      triagemFilaSalao: null,
      prescricaoAssinadaFarmacia: null,
      agendaEFaturamentoApac: d.agendaEFaturamentoApac,
    },
  };
}

/**
 * Grava mensagem operacional no chat do setor (`TRIAGEM | FARMACIA | SECRETARIA | MEDICO`).
 * Nunca promove a mensagem automaticamente ao prontuário (`clinical_event`).
 */
export function enviarMensagemChatSetorialF6(
  db: DatabaseSync,
  entrada: {
    mensagemId?: string;
    sessao: unknown;
    patientId: string;
    encounterId: string;
    setor: "TRIAGEM" | "FARMACIA" | "SECRETARIA" | "MEDICO";
    textoOperacional: string;
    agora: string;
  },
): { ok: false; codigo: string } | { ok: true; mensagem: MensagemOperacionalSetorF6 } {
  const rbac = verificarEAuditarAcessoSetorialF6(db, {
    sessaoCandidata: entrada.sessao,
    operacao: "ESCREVER_CHAT_SETOR",
    setorChatAlvo: entrada.setor,
    vinculoIdAlegadoPeloCliente: entrada.patientId,
    agora: entrada.agora,
  });
  if (!rbac.permitida) return { ok: false, codigo: rbac.motivoCodigo };

  const msg = MensagemOperacionalSetorF6.parse({
    mensagemId: entrada.mensagemId ?? `chat-f6-${randomUUID()}`,
    patientId: entrada.patientId,
    encounterId: entrada.encounterId,
    setor: entrada.setor,
    autorProfissionalId: rbac.sessao.profissionalId,
    autorPapel: rbac.sessao.papel,
    textoOperacional: entrada.textoOperacional.trim(),
    promovidaAoProntuarioAutomaticamente: false,
    criadoEm: entrada.agora,
  });

  transacao(db, () => {
    db.prepare(`
      INSERT INTO f6_chat_operacional (
        mensagemId, patientId, encounterId, setor, autorProfissionalId, autorPapel, mensagemJson, criadoEm
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.mensagemId,
      msg.patientId,
      msg.encounterId,
      msg.setor,
      msg.autorProfissionalId,
      msg.autorPapel,
      JSON.stringify(msg),
      msg.criadoEm,
    );
  });

  return { ok: true, mensagem: msg };
}

export function lerMensagensChatSetorialF6(
  db: DatabaseSync,
  entrada: {
    sessao: unknown;
    patientId: string;
    encounterId: string;
    setor: "TRIAGEM" | "FARMACIA" | "SECRETARIA" | "MEDICO";
    agora: string;
  },
): { ok: false; codigo: string } | { ok: true; mensagens: MensagemOperacionalSetorF6[] } {
  const rbac = verificarEAuditarAcessoSetorialF6(db, {
    sessaoCandidata: entrada.sessao,
    operacao: "LER_CHAT_SETOR",
    setorChatAlvo: entrada.setor,
    vinculoIdAlegadoPeloCliente: entrada.patientId,
    agora: entrada.agora,
  });
  if (!rbac.permitida) return { ok: false, codigo: rbac.motivoCodigo };

  const rows = db.prepare(`
    SELECT mensagemJson FROM f6_chat_operacional
    WHERE patientId = ? AND encounterId = ? AND setor = ?
    ORDER BY criadoEm, mensagemId
  `).all(entrada.patientId, entrada.encounterId, entrada.setor) as Array<{ mensagemJson: string }>;

  return {
    ok: true,
    mensagens: rows.map((r) => MensagemOperacionalSetorF6.parse(JSON.parse(r.mensagemJson))),
  };
}

/**
 * Registra e retorna aviso ao médico sem PHI (Q55 / Q59), verificando com `contemPhiResidual`
 * que nenhum identificador do dicionário vaza no objeto serializado.
 */
export function registrarAvisoMedicoSemPhiF6(
  db: DatabaseSync,
  entrada: {
    avisoId?: string;
    sessaoEmissora: unknown;
    urgencia: "ROTINA" | "PRIORITARIO" | "EMERGENCIA_E1";
    codigoEventoOpaco: CodigoEventoAvisoMedicoOpaco;
    identificadorInternoParaHashOpaco: string;
    dicionarioVerificacaoPhi: DicionarioPaciente;
    agora: string;
  },
): { ok: false; codigo: string } | { ok: true; aviso: AvisoMedicoSemPhiF6 } {
  garantirSchemaF6(db);
  const parsedSessao = autorizarOperacaoSetorialF6({
    sessaoCandidata: entrada.sessaoEmissora,
    operacao: "LER_CHAT_SETOR",
    agora: entrada.agora,
  });
  if (!parsedSessao.permitida) return { ok: false, codigo: parsedSessao.motivoCodigo };

  const aviso = criarAvisoMedicoSemPhiF6({
    ...(entrada.avisoId ? { avisoId: entrada.avisoId } : {}),
    setorOrigem: parsedSessao.sessao.setor,
    urgencia: entrada.urgencia,
    codigoEventoOpaco: entrada.codigoEventoOpaco,
    identificadorInternoParaHashOpaco: entrada.identificadorInternoParaHashOpaco,
    criadoEm: entrada.agora,
  });

  if (contemPhiResidual(JSON.stringify(aviso), entrada.dicionarioVerificacaoPhi)) {
    return { ok: false, codigo: "PHI_DETECTADA_NO_AVISO" };
  }

  transacao(db, () => {
    db.prepare(`
      INSERT INTO f6_aviso_medico_sem_phi (
        avisoId, setorOrigem, urgencia, codigoEventoOpaco, avisoJson, criadoEm
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      aviso.avisoId,
      aviso.setorOrigem,
      aviso.urgencia,
      aviso.codigoEventoOpaco,
      JSON.stringify(aviso),
      aviso.criadoEm,
    );
  });

  return { ok: true, aviso };
}

export function listarAvisosMedicoSemPhiF6(db: DatabaseSync): AvisoMedicoSemPhiF6[] {
  garantirSchemaF6(db);
  const rows = db.prepare(
    "SELECT avisoJson FROM f6_aviso_medico_sem_phi ORDER BY criadoEm, avisoId",
  ).all() as Array<{ avisoJson: string }>;
  return rows.map((r) => AvisoMedicoSemPhiF6.parse(JSON.parse(r.avisoJson)));
}

/**
 * Consulta estatísticas cumulativas do serviço (D-W9-44) com denominadores e exclusões explícitos,
 * exigindo permissão RBAC (`LER_ESTATISTICA_SERVICO`) e garantindo zero PHI.
 */
export function consultarEstatisticaServicoF6(
  db: DatabaseSync,
  entrada: {
    sessao: unknown;
    opcoes?: OpcoesEstatistica;
    agora: string;
  },
): { ok: false; codigo: string } | { ok: true; estatistica: ProjecaoEstatistica; totalEventosBrutosLedger: number } {
  const rbac = verificarEAuditarAcessoSetorialF6(db, {
    sessaoCandidata: entrada.sessao,
    operacao: "LER_ESTATISTICA_SERVICO",
    agora: entrada.agora,
  });
  if (!rbac.permitida) return { ok: false, codigo: rbac.motivoCodigo };

  const estatistica = projetarEstatisticaLedger(db, entrada.opcoes ?? {});
  const rowCount = db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number };
  void listarEventos;
  return {
    ok: true,
    estatistica,
    totalEventosBrutosLedger: Number(rowCount.n),
  };
}
