// F3 · Persistência, eventos operacionais, liberação justificada, administração efetiva e contingência impressa do Salão.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { Instante, Sessao } from "../contracts/base.js";
import type { Destino } from "../contracts/estados.js";
import {
  EventoInterrupcaoSalao,
  ExcecaoLiberacaoMedicaSalao,
  FolhaContingenciaSalao,
  type DesfechoPesoSalao,
  RegistroAdministracaoEfetivaSalao,
  type TipoEventoInterrupcaoSalao,
} from "../contracts/f3/salaoOperacional.js";
import type { Pesagem, SalaoRuleset } from "../contracts/regras.js";
import { g06E1Destaque } from "../kernel/harness/gates.js";
import { transacao } from "../kernel/ledger/db.js";
import { rotearDutos } from "./dutos.js";
import { listarEventos } from "../kernel/comandos/portas.js";
import { administrations } from "../kernel/projections/series.js";
import { dadosDoEvento } from "../kernel/projections/snapshot.js";
import {
  avaliarDesfechoPesoSalao,
  criarEventoInterrupcaoSalao,
} from "../modules/salao/operacaoSalao.js";
import type { GerenciadorSessao } from "./sessao.js";

export type AcessoSalao = { sessoes: GerenciadorSessao; token: string; agora: string };

function obterSessaoValida(acesso: AcessoSalao): Sessao | null {
  const s = Sessao.safeParse(acesso.sessoes.obter(acesso.token));
  if (!s.success || !Instante.safeParse(acesso.agora).success) return null;
  return Date.parse(s.data.expiraEm) > Date.parse(acesso.agora) ? s.data : null;
}

export function garantirSchemaSalaoF3(db: DatabaseSync): void {
  if (!db.isTransaction) {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS salao_evento_interrupcao (
      eventoSalaoId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      encounterId TEXT NOT NULL,
      cicloId TEXT,
      tipo TEXT NOT NULL,
      eventoJson TEXT NOT NULL,
      registradoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS salao_evento_interrupcao_no_update BEFORE UPDATE ON salao_evento_interrupcao
      BEGIN SELECT RAISE(ABORT, 'salao_evento_interrupcao append-only'); END;
    CREATE TRIGGER IF NOT EXISTS salao_evento_interrupcao_no_delete BEFORE DELETE ON salao_evento_interrupcao
      BEGIN SELECT RAISE(ABORT, 'salao_evento_interrupcao append-only'); END;

    CREATE TABLE IF NOT EXISTS salao_desfecho_peso (
      desfechoId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      encounterId TEXT NOT NULL,
      desfechoJson TEXT NOT NULL,
      registradoEm TEXT NOT NULL,
      UNIQUE (patientId, encounterId)
    );

    CREATE TABLE IF NOT EXISTS salao_excecao_liberacao (
      liberacaoId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      encounterId TEXT NOT NULL,
      triagemDraftId TEXT NOT NULL,
      triagemRevision INTEGER NOT NULL,
      liberacaoJson TEXT NOT NULL,
      registradoEm TEXT NOT NULL,
      UNIQUE (patientId, encounterId, triagemDraftId, triagemRevision)
    );
    CREATE TRIGGER IF NOT EXISTS salao_excecao_liberacao_no_update BEFORE UPDATE ON salao_excecao_liberacao
      BEGIN SELECT RAISE(ABORT, 'salao_excecao_liberacao append-only'); END;
    CREATE TRIGGER IF NOT EXISTS salao_excecao_liberacao_no_delete BEFORE DELETE ON salao_excecao_liberacao
      BEGIN SELECT RAISE(ABORT, 'salao_excecao_liberacao append-only'); END;

    CREATE TABLE IF NOT EXISTS salao_administracao_efetiva (
      adminId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      encounterId TEXT NOT NULL,
      tumorLotId TEXT,
      administracaoJson TEXT NOT NULL,
      registradoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS salao_administracao_efetiva_no_update BEFORE UPDATE ON salao_administracao_efetiva
      BEGIN SELECT RAISE(ABORT, 'salao_administracao_efetiva append-only'); END;
    CREATE TRIGGER IF NOT EXISTS salao_administracao_efetiva_no_delete BEFORE DELETE ON salao_administracao_efetiva
      BEGIN SELECT RAISE(ABORT, 'salao_administracao_efetiva append-only'); END;

    CREATE TABLE IF NOT EXISTS salao_folha_contingencia (
      folhaId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      encounterId TEXT NOT NULL,
      folhaJson TEXT NOT NULL,
      geradoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS salao_folha_contingencia_no_update BEFORE UPDATE ON salao_folha_contingencia
      BEGIN SELECT RAISE(ABORT, 'salao_folha_contingencia append-only'); END;
    CREATE TRIGGER IF NOT EXISTS salao_folha_contingencia_no_delete BEFORE DELETE ON salao_folha_contingencia
      BEGIN SELECT RAISE(ABORT, 'salao_folha_contingencia append-only'); END;
  `);
}

export function registrarInterrupcaoSalaoF3(
  db: DatabaseSync,
  acesso: AcessoSalao,
  entrada: {
    eventoSalaoId?: string;
    patientId: string;
    encounterId: string;
    cicloId?: string | null;
    tipo: TipoEventoInterrupcaoSalao;
    descricaoClinica: string;
  },
): { ok: true; evento: EventoInterrupcaoSalao } | { ok: false; codigo: "SESSAO_INVALIDA" | "EVENTO_INVALIDO" } {
  const sessao = obterSessaoValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  try {
    garantirSchemaSalaoF3(db);
    const evento = criarEventoInterrupcaoSalao({
      ...(entrada.eventoSalaoId ? { eventoSalaoId: entrada.eventoSalaoId } : {}),
      patientId: entrada.patientId,
      encounterId: entrada.encounterId,
      cicloId: entrada.cicloId ?? null,
      tipo: entrada.tipo,
      descricaoClinica: entrada.descricaoClinica,
      registradoPor: sessao.medicoId,
      registradoEm: acesso.agora,
    });
    transacao(db, () => {
      db.prepare(`
        INSERT INTO salao_evento_interrupcao (eventoSalaoId, patientId, encounterId, cicloId, tipo, eventoJson, registradoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        evento.eventoSalaoId,
        evento.patientId,
        evento.encounterId,
        evento.cicloId,
        evento.tipo,
        JSON.stringify(evento),
        evento.registradoEm,
      );
    });
    return { ok: true, evento };
  } catch {
    return { ok: false, codigo: "EVENTO_INVALIDO" };
  }
}

export function listarInterrupcoesSalaoF3(
  db: DatabaseSync,
  patientId?: string,
): EventoInterrupcaoSalao[] {
  garantirSchemaSalaoF3(db);
  const rows = (patientId
    ? db.prepare("SELECT eventoJson FROM salao_evento_interrupcao WHERE patientId = ? ORDER BY registradoEm, eventoSalaoId").all(patientId)
    : db.prepare("SELECT eventoJson FROM salao_evento_interrupcao ORDER BY registradoEm, eventoSalaoId").all()) as Array<{ eventoJson: string }>;
  return rows.map((r) => EventoInterrupcaoSalao.parse(JSON.parse(r.eventoJson)));
}

export function registrarDesfechoPesoSalaoF3(
  db: DatabaseSync,
  acesso: AcessoSalao,
  entrada: {
    patientId: string;
    encounterId: string;
    pesagens: readonly Pesagem[];
    hoje: string;
    ruleset: SalaoRuleset;
  },
): { ok: true; desfecho: DesfechoPesoSalao } | { ok: false; codigo: "SESSAO_INVALIDA" } {
  const sessao = obterSessaoValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  garantirSchemaSalaoF3(db);
  const desfecho = avaliarDesfechoPesoSalao(entrada);
  transacao(db, () => {
    db.prepare(`
      INSERT INTO salao_desfecho_peso (desfechoId, patientId, encounterId, desfechoJson, registradoEm)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(patientId, encounterId) DO UPDATE SET
        desfechoJson = excluded.desfechoJson,
        registradoEm = excluded.registradoEm
    `).run(
      `peso-${entrada.patientId}-${entrada.encounterId}`,
      entrada.patientId,
      entrada.encounterId,
      JSON.stringify(desfecho),
      acesso.agora,
    );
  });
  return { ok: true, desfecho };
}

export function registrarLiberacaoComCorteSalaoF3(
  db: DatabaseSync,
  acesso: AcessoSalao,
  entrada: {
    liberacaoId?: string;
    patientId: string;
    encounterId: string;
    triagemDraftId: string;
    triagemRevision: number;
    motivoJustificado: string;
  },
):
  | { ok: true; liberacao: ExcecaoLiberacaoMedicaSalao; replay: boolean }
  | { ok: false; codigo: "SESSAO_INVALIDA" | "MOTIVO_OBRIGATORIO" | "CONFLITO_MOTIVO_LIBERACAO" } {
  const sessao = obterSessaoValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  if (!entrada.motivoJustificado || !entrada.motivoJustificado.trim()) {
    return { ok: false, codigo: "MOTIVO_OBRIGATORIO" };
  }
  garantirSchemaSalaoF3(db);

  const existenteRow = db.prepare(`
    SELECT liberacaoJson FROM salao_excecao_liberacao
    WHERE patientId = ? AND encounterId = ? AND triagemDraftId = ? AND triagemRevision = ?
  `).get(
    entrada.patientId,
    entrada.encounterId,
    entrada.triagemDraftId,
    entrada.triagemRevision,
  ) as { liberacaoJson: string } | undefined;

  if (existenteRow) {
    const existente = ExcecaoLiberacaoMedicaSalao.parse(JSON.parse(existenteRow.liberacaoJson));
    if (existente.motivoJustificado === entrada.motivoJustificado.trim()) {
      return { ok: true, liberacao: existente, replay: true };
    }
    return { ok: false, codigo: "CONFLITO_MOTIVO_LIBERACAO" };
  }

  const liberacao = ExcecaoLiberacaoMedicaSalao.parse({
    liberacaoId: entrada.liberacaoId ?? `lib-salao-${randomUUID()}`,
    patientId: entrada.patientId,
    encounterId: entrada.encounterId,
    triagemDraftId: entrada.triagemDraftId,
    triagemRevision: entrada.triagemRevision,
    motivoJustificado: entrada.motivoJustificado.trim(),
    autorMedicoId: sessao.medicoId,
    autorCrm: sessao.crm,
    registradoEm: acesso.agora,
  });

  transacao(db, () => {
    db.prepare(`
      INSERT INTO salao_excecao_liberacao (
        liberacaoId, patientId, encounterId, triagemDraftId, triagemRevision, liberacaoJson, registradoEm
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      liberacao.liberacaoId,
      liberacao.patientId,
      liberacao.encounterId,
      liberacao.triagemDraftId,
      liberacao.triagemRevision,
      JSON.stringify(liberacao),
      liberacao.registradoEm,
    );
  });

  return { ok: true, liberacao, replay: false };
}

export function registrarAdministracaoEfetivaSalaoF3(
  db: DatabaseSync,
  acesso: AcessoSalao,
  entrada: RegistroAdministracaoEfetivaSalao,
):
  | { ok: true; administracao: RegistroAdministracaoEfetivaSalao["administracao"] }
  | { ok: false; codigo: string } {
  const sessao = obterSessaoValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  const parsed = RegistroAdministracaoEfetivaSalao.safeParse(entrada);
  if (!parsed.success) return { ok: false, codigo: "ADMINISTRACAO_INVALIDA" };
  const p = parsed.data;
  // Um único escritor, a mesma sessão/contexto e a mesma verificação de prescrição da rota HTTP.
  const resultado = rotearDutos({db, sessoes: acesso.sessoes, agora: () => acesso.agora}, acesso.token,
    '/salao/registrar-administracao', {
      contexto: {patientId:p.patientId,encounterId:p.encounterId,tumorLotId:p.tumorLotId,
        operationId:`salao-admin-${p.administracao.adminId}`},
      prescricao: {documentId:p.prescricaoAssinadaRef.documentId,documentVersion:p.prescricaoAssinadaRef.documentVersion},
      administracao:p.administracao,
    }, sessao);
  const body = resultado?.body as {codigo?:string;eventId?:string} | undefined;
  if (resultado?.status !== 200) return {ok:false,codigo:body?.codigo ?? 'ADMINISTRACAO_NAO_GRAVADA'};
  const evento = listarEventos(db,p.patientId).find(e=>e.eventId===body?.eventId);
  const gravada = evento ? dadosDoEvento(evento) : null;
  if (!gravada) return {ok:false,codigo:'ADMINISTRACAO_NAO_GRAVADA'};
  return {ok:true,administracao:gravada as RegistroAdministracaoEfetivaSalao['administracao']};
}

export function listarAdministracoesEfetivasSalaoF3(
  db: DatabaseSync,
  patientId: string,
): Array<RegistroAdministracaoEfetivaSalao["administracao"]> {
  // Tabela F3 legada preservada para auditoria; não promover registros sem assinatura verificada.
  return administrations(listarEventos(db,patientId));
}

/** Arquivo anterior preservado: exige reconciliação, sem desaparecer nem virar administração confirmada. */
export function avisosAdministracoesLegadasF3(db:DatabaseSync):{patientId:string;texto:string}[] {
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='salao_administracao_efetiva'").get())return [];
  const rows=db.prepare('SELECT patientId,adminId FROM salao_administracao_efetiva').all() as {patientId:string;adminId:string}[];
  return rows.filter(r=>!listarAdministracoesEfetivasSalaoF3(db,r.patientId).some(a=>a.adminId===r.adminId))
    .map(r=>({patientId:r.patientId,texto:`Administração legada ${r.adminId} preservada, aguardando conferência de prescrição e origem antes de entrar no cumulativo.`}));
}

/**
 * S-F3-04 · Gera e persiste a folha operacional de contingência do salão (INV-08 / K-12 / G-06).
 * Se houver emergência E1 ativa, exige o banner de destaque E1 na folha operacional;
 * a evolução clínica nunca recebe objetos Alerta.
 */
export function gerarFolhaContingenciaSalaoF3(
  db: DatabaseSync,
  acesso: AcessoSalao,
  entrada: {
    folhaId?: string;
    patientId: string;
    nomePaciente: string;
    encounterId: string;
    dataImpressao: string;
    destino: Destino;
    emergenciaAtiva: boolean;
    alertasOperacionaisE1: readonly string[];
    resumoTriagem: Record<string, string>;
  },
):
  | { ok: true; folha: FolhaContingenciaSalao }
  | { ok: false; codigo: "SESSAO_INVALIDA" | "G-06_E1_DESTAQUE_AUSENTE" | "ERRO_RENDERIZACAO_FOLHA" | "FOLHA_ID_CONFLITANTE" } {
  const sessao = obterSessaoValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  garantirSchemaSalaoF3(db);

  const alertasE1 = entrada.alertasOperacionaisE1.filter((a) => a.trim().length > 0);
  const gate = g06E1Destaque({
    templateId: "folha-operacional-salao",
    emergenciaAtiva: entrada.emergenciaAtiva,
    destaqueE1Presente: entrada.emergenciaAtiva && alertasE1.length > 0,
  });
  if (gate.decisao === "BLOQUEIA_ARTEFATO") {
    return { ok: false, codigo: "G-06_E1_DESTAQUE_AUSENTE" };
  }

  try {
    const templateRaw = JSON.parse(
      readFileSync(resolve(process.cwd(), "corpus/templates/folha-operacional-salao.v1.json"), "utf8"),
    ) as { id: string; versao: string };

    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);
    const blocoE1 = entrada.emergenciaAtiva
      ? `<section class="operacional e1-destaque" aria-label="E1 — Emergência ativa"><strong>E1 — EMERGÊNCIA ATIVA</strong>${alertasE1.map((a) => `<div>${esc(a)}</div>`).join("")}</section>`
      : "";
    const camposHtml = Object.entries(entrada.resumoTriagem)
      .map(([k, v]) => `<div class="campo"><strong>${esc(k)}:</strong> ${esc(v)}</div>`)
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(templateRaw.id)}</title></head><body><main class="documento"><header><strong>Serviço de Oncologia Local</strong><div>${esc(sessao.medicoId)} · ${esc(sessao.crm)}</div></header><h1>Folha Operacional do Salão</h1><div><strong>Paciente:</strong> ${esc(entrada.nomePaciente)}</div><div><strong>Identificador:</strong> ${esc(entrada.patientId)}</div><div><strong>Encontro:</strong> ${esc(entrada.encounterId)}</div><div><strong>Data:</strong> ${esc(entrada.dataImpressao)}</div><div><strong>Destino:</strong> ${esc(entrada.destino)}</div>${blocoE1}<section>${camposHtml}</section></main></body></html>`;

    const folha = FolhaContingenciaSalao.parse({
      folhaId: entrada.folhaId ?? `folha-salao-${entrada.patientId}-${entrada.encounterId}`,
      patientId: entrada.patientId,
      encounterId: entrada.encounterId,
      dataImpressao: entrada.dataImpressao,
      destino: entrada.destino,
      emergenciaAtiva: entrada.emergenciaAtiva,
      alertasOperacionaisE1: [...alertasE1],
      htmlImprimivel: html,
      hashDocumento: createHash("sha256").update(html, "utf8").digest("hex"),
      evolucaoClinicaContemAlerta: false,
      geradoEm: acesso.agora,
    });

    return transacao(db, () => {
      const inserida = db.prepare(`
        INSERT INTO salao_folha_contingencia (folhaId, patientId, encounterId, folhaJson, geradoEm)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(folhaId) DO NOTHING
      `).run(folha.folhaId, folha.patientId, folha.encounterId, JSON.stringify(folha), folha.geradoEm);
      if (Number(inserida.changes) === 0) {
        const row = db.prepare("SELECT folhaJson FROM salao_folha_contingencia WHERE folhaId = ?")
          .get(folha.folhaId) as { folhaJson: string };
        const persistida = FolhaContingenciaSalao.parse(JSON.parse(row.folhaJson));
        if (persistida.patientId !== folha.patientId || persistida.encounterId !== folha.encounterId
          || persistida.hashDocumento !== folha.hashDocumento
          || persistida.destino !== folha.destino || persistida.emergenciaAtiva !== folha.emergenciaAtiva
          || persistida.dataImpressao !== folha.dataImpressao) {
          return { ok: false as const, codigo: "FOLHA_ID_CONFLITANTE" as const };
        }
        return { ok: true as const, folha: persistida };
      }
      return { ok: true as const, folha };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "G-06_E1_DESTAQUE_AUSENTE") {
      return { ok: false, codigo: "G-06_E1_DESTAQUE_AUSENTE" };
    }
    return { ok: false, codigo: "ERRO_RENDERIZACAO_FOLHA" };
  }
}

export function listarFolhasContingenciaSalaoF3(
  db: DatabaseSync,
  patientId?: string,
): FolhaContingenciaSalao[] {
  garantirSchemaSalaoF3(db);
  const rows = (patientId
    ? db.prepare("SELECT folhaJson FROM salao_folha_contingencia WHERE patientId = ? ORDER BY geradoEm, folhaId").all(patientId)
    : db.prepare("SELECT folhaJson FROM salao_folha_contingencia ORDER BY geradoEm, folhaId").all()) as Array<{ folhaJson: string }>;
  return rows.map((r) => FolhaContingenciaSalao.parse(JSON.parse(r.folhaJson)));
}
